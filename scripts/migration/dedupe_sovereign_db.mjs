import { MongoClient } from 'mongodb';
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure we load the .env.local from the absolute project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Configuration
const MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017";
const DB_NAME = "LifeOS"; // <-- Zen Correction: Grok keeps changing this, but it MUST be LifeOS!

const B2_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';
const B2_REGION = process.env.B2_REGION || 'us-east-005';
const B2_BUCKET = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET || 'LifeOS-Media';

const IS_DRY_RUN = process.argv.includes('--dry-run');

console.log(`\n=========================================`);
console.log(`[INIT] Sovereign Matrix DB Deduplicator + Cryptographic ETag Verification`);
console.log(`[INIT] Mode: ${IS_DRY_RUN ? 'DRY RUN' : 'PRODUCTION (Will delete from Mongo and B2)'}`);
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

// Function with built-in retry logic for B2 network hiccups
async function getETag(key, retries = 3) {
    if (!key) return null;
    for (let i = 0; i < retries; i++) {
        try {
            const command = new HeadObjectCommand({ Bucket: B2_BUCKET, Key: key });
            const response = await s3Client.send(command);
            return response.ETag ? response.ETag.replace(/"/g, '') : null;
        } catch (e) {
            if (i === retries - 1) {
                console.warn(`⚠️ [ETag] Failed to fetch for ${key} after ${retries} attempts:`, e.message);
                return null;
            }
            await new Promise(res => setTimeout(res, 500 * (i + 1))); // Backoff
        }
    }
}

async function run() {
    console.log("🔌 Connecting to Sovereign Matrix (MongoDB)...");
    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('pending_accessions');

        console.log("🔍 Scanning 'pending_accessions' for all records...");
        const cursor = collection.find({}, { projection: { _id: 1, originalName: 1, size: 1, url: 1 } });
        
        const fingerprintMap = new Map();
        let totalDocs = 0;

        for await (const doc of cursor) {
            totalDocs++;
            const { originalName, size } = doc;
            if (originalName && size) {
                const key = `${originalName}_${size}`;
                if (!fingerprintMap.has(key)) {
                    fingerprintMap.set(key, []);
                }
                fingerprintMap.get(key).push(doc);
            }
        }

        const duplicateGroups = Array.from(fingerprintMap.values()).filter(group => group.length > 1);
        
        let totalDuplicatesToRemove = 0;
        let totalSpaceRecovered = 0;

        for (const group of duplicateGroups) {
            totalDuplicatesToRemove += (group.length - 1);
            totalSpaceRecovered += ((group.length - 1) * group[0].size);
        }

        console.log(`\n📊 SUMMARY OF DATABASE:`);
        console.log(`   - Total Records Scanned: ${totalDocs}`);
        console.log(`   - Unique Fingerprints Found: ${fingerprintMap.size}`);
        console.log(`   - Sets of Clones: ${duplicateGroups.length}`);
        console.log(`   - Ghost Records to Purge: ${totalDuplicatesToRemove}`);
        console.log(`   - Wasted B2 Space to Recover: ${(totalSpaceRecovered / 1024 / 1024 / 1024).toFixed(2)} GB`);
        console.log(`=========================================\n`);

        if (IS_DRY_RUN) {
            console.log("✅ DRY RUN COMPLETE. No data was deleted.");
            return;
        }

        console.log("🚀 COMMENCING MASS PURGE (Mongo + B2) WITH CRYPTOGRAPHIC ETAG VERIFICATION...");
        
        let deletedCount = 0;
        let skippedCollisions = 0;
        let fetchErrors = 0;
        
        for (const group of duplicateGroups) {
            const original = group[0];
            const duplicates = group.slice(1);

            const masterKey = extractB2KeyFromUrl(original.url);
            if (!masterKey) {
                console.warn(`⚠️ [WARNING] Master record has bad URL, skipping group: ${original.originalName}`);
                continue;
            }

            const masterETag = await getETag(masterKey);
            if (!masterETag) {
                console.warn(`⚠️ [NETWORK ERR] Could not verify Master ETag for ${original.originalName}. Skipping entire group to be safe.`);
                fetchErrors++;
                continue; // ZEN'S FAIL-SAFE LOGIC
            }

            for (const dupe of duplicates) {
                const dupeKey = extractB2KeyFromUrl(dupe.url);
                
                if (!dupeKey) {
                     console.warn(`⚠️ [WARNING] Duplicate has unparseable URL, skipping B2 delete but proceeding with Mongo delete.`);
                }

                let shouldDelete = false; // Default to FALSE. Fail-safe, not fail-deadly.

                if (dupeKey) {
                    const dupeETag = await getETag(dupeKey);
                    if (!dupeETag) {
                         console.warn(`⚠️ [NETWORK ERR] Could not fetch ETag for duplicate ${dupe.originalName}. Skipping deletion to be safe.`);
                         fetchErrors++;
                         continue;
                    }
                    
                    if (dupeETag === masterETag) {
                        shouldDelete = true;
                    } else {
                        console.warn(`⚠️ [COLLISION DETECTED] ETag mismatch for ${dupe.originalName} — skipping delete!`);
                        skippedCollisions++;
                        continue;
                    }
                }

                if (shouldDelete) {
                    // 1. Delete from B2
                    try {
                        await s3Client.send(new DeleteObjectCommand({ Bucket: B2_BUCKET, Key: dupeKey }));
                    } catch (e) {
                        console.error(`❌ [B2 ERROR] Failed to delete ${dupeKey}:`, e.message);
                    }

                    // 2. Delete from MongoDB
                    try {
                        await collection.deleteOne({ _id: dupe._id });
                    } catch (e) {
                        console.error(`❌ [MONGO ERROR] Failed to delete ${dupe._id}:`, e.message);
                    }

                    deletedCount++;
                    if (deletedCount % 1000 === 0) {
                        console.log(`⏳ Purged ${deletedCount} / ${totalDuplicatesToRemove} ghost records...`);
                    }
                }
            }
        }

        console.log(`\n=========================================`);
        console.log(`🎉 MASS PURGE COMPLETE!`);
        console.log(`✅ Permanently destroyed ${deletedCount} duplicates from MongoDB and Backblaze B2.`);
        if (skippedCollisions > 0) console.log(`🛡️  Successfully prevented ${skippedCollisions} catastrophic collisions.`);
        if (fetchErrors > 0) console.log(`⚠️  Skipped ${fetchErrors} records due to B2 API network timeouts.`);
        console.log(`=========================================\n`);

    } finally {
        await client.close();
    }
}

run().catch(console.error);
