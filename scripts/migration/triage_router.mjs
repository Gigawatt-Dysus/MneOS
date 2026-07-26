import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017";
const DB_NAME = "LifeOS";

const IS_DRY_RUN = process.argv.includes('--dry-run');

console.log(`\n=========================================`);
console.log(`[INIT] MneOS Sovereign Triage Router`);
console.log(`[INIT] Mode: ${IS_DRY_RUN ? 'DRY RUN (Analysis Only)' : 'PRODUCTION (Moving Silos)'}`);
console.log(`=========================================\n`);

function isScreenshot(originalName) {
    if (!originalName) return false;
    const name = originalName.trim();
    const lower = name.toLowerCase();

    if (/^Screenshot \d{4}-\d{2}-\d{2}/.test(name)) return true;
    if (/^\d{4}-\d{2}-\d{2}\.png$/i.test(name)) return true;
    if (/^\d{4}-\d{2}-\d{2}\s*\(\d+\)\.png$/i.test(name)) return true;
    if (lower.includes('screenshot') || lower.includes('snip') || lower.includes('capture')) return true;

    return false;
}

function getCategory(doc) {
    const name = (doc.originalName || '').toLowerCase();
    const fileType = (doc.fileType || '').toLowerCase();
    
    if (name.match(/\.(pdf|txt|doc|docx|xls|xlsx|csv|rtf|md|json|xml|ppt|pptx)$/i)) {
        return 'documents_archive';
    }
    
    if (name.match(/\.(mp4|mov|avi|mkv|webm|wmv|flv|m4v|3gp)$/i) || fileType.startsWith('video/')) {
        return 'video_archive';
    }
    
    if (isScreenshot(doc.originalName)) {
        return 'screenshots_archive';
    }
    
    return 'pending_accessions';
}

async function run() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('pending_accessions');

        console.log("🔍 Sweeping the Airlock for structural analysis...");
        const cursor = collection.find();

        const stats = {
            'documents_archive': { count: 0, bytes: 0 },
            'video_archive': { count: 0, bytes: 0 },
            'screenshots_archive': { count: 0, bytes: 0 },
            'pending_accessions': { count: 0, bytes: 0 } // Survivors
        };

        let totalScanned = 0;
        let movedCount = 0;

        for await (const doc of cursor) {
            totalScanned++;
            const cat = getCategory(doc);
            
            stats[cat].count++;
            stats[cat].bytes += (doc.size || 0);

            if (!IS_DRY_RUN && cat !== 'pending_accessions') {
                try {
                    // Move to specific silo collection
                    await db.collection(cat).insertOne(doc);
                    // Remove from pending_accessions
                    await collection.deleteOne({ _id: doc._id });
                    movedCount++;
                    
                    if (movedCount % 1000 === 0) {
                        console.log(`⏳ Routed ${movedCount} assets into silos...`);
                    }
                } catch (e) {
                    console.error(`❌ Failed to route document ${doc._id} to ${cat}:`, e.message);
                }
            }
        }

        console.log(`\n📊 GRAND AIRLOCK MATHEMATICS:`);
        console.log(`   Total Records Scanned: ${totalScanned}\n`);
        
        for (const [cat, data] of Object.entries(stats)) {
            const gb = (data.bytes / 1024 / 1024 / 1024).toFixed(2);
            console.log(`   📦 ${cat.padEnd(28)} | Count: ${data.count.toString().padEnd(7)} | Space: ${gb.padStart(7)} GB`);
        }

        console.log(`\n=========================================`);
        if (IS_DRY_RUN) {
            console.log(`✅ DRY RUN COMPLETE. This was a pure mathematical sweep. No data was moved.`);
        } else {
            console.log(`🎉 SILO ROUTING COMPLETE! Successfully relocated ${movedCount} assets out of the pending_accessions airlock.`);
        }
        console.log(`=========================================\n`);

    } finally {
        await client.close();
    }
}

run().catch(console.error);
