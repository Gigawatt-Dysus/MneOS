import { MongoClient } from 'mongodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Configuration
const MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017";
const DB_NAME = "LifeOS"; // Corrected this back to LifeOS as it is the real DB name.

const B2_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';
const B2_REGION = process.env.B2_REGION || 'us-east-005';
const B2_BUCKET = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET || 'LifeOS-Media';

const IS_DRY_RUN = process.argv.includes('--dry-run');

console.log(`\n=========================================`);
console.log(`[INIT] MneOS Screenshot Purger (Hardened v2)`);
console.log(`[INIT] Mode: ${IS_DRY_RUN ? 'DRY RUN' : 'PRODUCTION'}`);
console.log(`=========================================\n`);

const s3Client = new S3Client({
    endpoint: B2_ENDPOINT,
    region: B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    },
});

function extractB2KeyFromUrl(url) {
    if (!url) return null;
    const bucketPrefix = `/file/${B2_BUCKET}/`;
    const idx = url.indexOf(bucketPrefix);
    if (idx !== -1) {
        return url.substring(idx + bucketPrefix.length);
    }
    return null;
}

function isScreenshot(originalName) {
    if (!originalName) return false;
    const name = originalName.trim();
    const lower = name.toLowerCase();

    // 1. Modern Windows Snipping Tool / ShareX style (PNG)
    if (/^Screenshot \d{4}-\d{2}-\d{2}/.test(name)) return "Pattern: Modern Windows Screenshot";

    // 2. Strict older date-based screenshots (PNG only — protects JPG photos)
    if (/^\d{4}-\d{2}-\d{2}\.png$/i.test(name)) return "Pattern: Date.png";
    if (/^\d{4}-\d{2}-\d{2}\s*\(\d+\)\.png$/i.test(name)) return "Pattern: Date(N).png";

    // 3. Generic safety net (very conservative)
    if (lower.includes('screenshot')) return "Keyword: screenshot";
    if (lower.includes('snip')) return "Keyword: snip";
    if (lower.includes('capture')) return "Keyword: capture";

    return false;
}

async function run() {
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('pending_accessions');

        console.log("🔍 Scanning for screenshots...");
        const cursor = collection.find({}, { 
            projection: { _id: 1, originalName: 1, size: 1, url: 1 } 
        });

        let totalScanned = 0;
        let screenshots = [];

        for await (const doc of cursor) {
            totalScanned++;
            const reason = isScreenshot(doc.originalName);
            if (reason) {
                doc.matchReason = reason;
                screenshots.push(doc);
            }
        }

        console.log(`\n📊 SUMMARY:`);
        console.log(`   Total Records Scanned: ${totalScanned}`);
        console.log(`   Screenshots Detected: ${screenshots.length}`);
        
        const totalBytes = screenshots.reduce((sum, d) => sum + (d.size || 0), 0);
        console.log(`   Estimated Space Recovery: ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)} GB`);

        console.log(`=========================================\n`);

        if (IS_DRY_RUN) {
            console.log("✅ DRY RUN COMPLETE.");
            if (screenshots.length > 0) {
                const fs = await import('fs');
                console.log("👁️ Generating visual audit log of 100 random samples...");
                
                // Shuffle for random sampling
                const shuffled = [...screenshots].sort(() => 0.5 - Math.random());
                const sample = shuffled.slice(0, 100);
                
                let html = `<html><head><title>Screenshot Audit Log</title><style>
                    body { font-family: sans-serif; background: #111; color: #fff; padding: 20px; }
                    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
                    .card { background: #222; padding: 10px; border-radius: 8px; text-align: center; }
                    img { max-width: 100%; height: auto; max-height: 300px; object-fit: contain; }
                    .name { font-size: 12px; margin-top: 10px; word-break: break-all; color: #aaa; }
                    .reason { font-size: 11px; margin-top: 5px; color: #ff5555; font-weight: bold; }
                </style></head><body>
                <h1>Screenshot Purge Audit Log</h1>
                <p>Random sampling of ${sample.length} out of ${screenshots.length} detected screenshots.</p>
                <div class="grid">`;
                
                sample.forEach(d => {
                    html += `<div class="card">
                        <a href="${d.url}" target="_blank"><img src="${d.url}" loading="lazy" alt="Screenshot" onerror="this.style.display='none'; this.parentElement.innerText='[Failed to load image from B2]'" /></a>
                        <div class="name">${d.originalName}</div>
                        <div class="reason">Caught by: ${d.matchReason}</div>
                    </div>`;
                });
                
                html += `</div></body></html>`;
                const auditPath = path.join(process.cwd(), 'screenshot_audit.html');
                fs.writeFileSync(auditPath, html);
                
                console.log(`\n📄 Visual Audit Log saved to: ${auditPath}`);
                console.log("➡️  Please double-click that HTML file on your desktop/explorer to review the images in your browser before proceeding.");
            }
            return;
        }

        // ... Purge logic ...
        console.log("🚀 COMMENCING SCREENSHOT PURGE...");
        let deletedCount = 0;

        for (const doc of screenshots) {
            // Delete from B2
            const b2Key = extractB2KeyFromUrl(doc.url);
            if (b2Key) {
                try {
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: B2_BUCKET,
                        Key: b2Key
                    }));
                } catch (e) {
                    console.error(`❌ B2 delete failed ${b2Key}:`, e.message);
                }
            } else {
                console.warn(`⚠️ [WARNING] Could not parse B2 key for URL: ${doc.url}`);
            }

            // Delete from Mongo
            try {
                await collection.deleteOne({ _id: doc._id });
            } catch (e) {
                console.error(`❌ Mongo delete failed ${doc._id}:`, e.message);
            }

            deletedCount++;
            if (deletedCount % 500 === 0) {
                console.log(`⏳ Purged ${deletedCount} / ${screenshots.length} screenshots...`);
            }
        }

        console.log(`\n🎉 PURGE COMPLETE! Removed ${deletedCount} screenshots.`);

    } finally {
        await client.close();
    }
}

run().catch(console.error);
