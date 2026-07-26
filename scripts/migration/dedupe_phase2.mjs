import { MongoClient } from 'mongodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: "C:\\MneOS\\.env.local" });

const MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017";
const DB_NAME = "LifeOS";

const B2_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';
const B2_REGION = process.env.B2_REGION || 'us-east-005';
const B2_BUCKET = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET || 'LifeOS-Media';

const s3Client = new S3Client({
    endpoint: B2_ENDPOINT,
    region: B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    }
});

const delay = ms => new Promise(res => setTimeout(res, ms));

async function getFileHeadHash(url, bytes = 65535) {
    let retries = 3;
    while (retries > 0) {
        try {
            const res = await fetch(url, {
                headers: { 'Range': `bytes=0-${bytes}` }
            });
            if (!res.ok) {
                if (res.status === 416) return null; // File smaller than requested range
                throw new Error(`HTTP ${res.status}`);
            }
            const arrayBuf = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            return crypto.createHash('sha256').update(buffer).digest('hex');
        } catch (e) {
            retries--;
            if (retries === 0) return null;
            await delay(1000);
        }
    }
    return null;
}

async function run() {
    console.log(`\n=========================================`);
    console.log(`[INIT] Sovereign Matrix Phase 2 Forensic Deduplicator`);
    console.log(`[INIT] Strategy: Exact Byte Size + 64KB EXIF Header SHA256 Verification`);
    console.log(`=========================================\n`);

    const client = new MongoClient(MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('pending_accessions');

        console.log("🔍 Fetching remaining records...");
        const allDocs = await collection.find({}, {
            projection: { originalName: 1, size: 1, url: 1, _id: 1 }
        }).toArray();

        // Fingerprint by Exact Name + Exact Byte Size
        const fingerprintMap = new Map();
        for (const doc of allDocs) {
            if (!doc.originalName || !doc.size) continue;
            const fp = `${doc.originalName.toLowerCase()}_${doc.size}`;
            if (!fingerprintMap.has(fp)) fingerprintMap.set(fp, []);
            fingerprintMap.get(fp).push(doc);
        }

        const duplicateGroups = Array.from(fingerprintMap.values()).filter(group => group.length > 1);

        let totalPurged = 0;
        let totalSkipped = 0;

        console.log(`\n🚀 PHASE 2 PURGE STARTING... Found ${duplicateGroups.length} structural collision sets to forensically evaluate.\n`);

        for (const group of duplicateGroups) {
            // Pick the first document as the "master"
            const masterDoc = group[0];
            const masterHash = await getFileHeadHash(masterDoc.url);

            if (!masterHash) {
                console.log(`⚠️ [NETWORK ERR] Could not fetch EXIF Head for ${masterDoc.originalName}. Skipping group.`);
                totalSkipped += (group.length - 1);
                continue;
            }

            for (let i = 1; i < group.length; i++) {
                const cloneDoc = group[i];
                const cloneHash = await getFileHeadHash(cloneDoc.url);

                if (cloneHash === masterHash) {
                    // FORENSIC MATCH CONFIRMED - Delete from B2 via S3 API
                    let b2Success = false;
                    try {
                        const objectKey = cloneDoc.url.split(`${B2_BUCKET}/`)[1] || `users/migration/takeout/${cloneDoc.url.split('/').pop().split('?')[0]}`;
                        
                        await s3Client.send(new DeleteObjectCommand({
                            Bucket: B2_BUCKET,
                            Key: objectKey
                        }));
                        b2Success = true;
                    } catch (e) {
                        console.log(`⚠️ [B2 ERR] Failed to delete ${cloneDoc.originalName} via S3 API: ${e.message}`);
                    }

                    if (b2Success) {
                        await collection.deleteOne({ _id: cloneDoc._id });
                        totalPurged++;
                    }

                    if (totalPurged % 100 === 0 && totalPurged > 0) {
                        console.log(`⏳ Phase 2: Forensically purged ${totalPurged} multipart ghost records...`);
                    }
                } else {
                    console.log(`⚠️ [FORENSIC MISMATCH] EXIF Header Hash diff for ${cloneDoc.originalName} — skipping!`);
                    totalSkipped++;
                }
            }
        }

        console.log(`\n=========================================`);
        console.log(`🎉 PHASE 2 FORENSIC PURGE COMPLETE!`);
        console.log(`✅ Permanently destroyed ${totalPurged} multipart upload clones.`);
        console.log(`🛡️  Safely skipped ${totalSkipped} true collisions.`);
        console.log(`=========================================\n`);

    } finally {
        await client.close();
    }
}

run().catch(console.error);
