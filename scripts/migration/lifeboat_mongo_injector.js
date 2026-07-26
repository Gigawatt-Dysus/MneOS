import { MongoClient } from 'mongodb';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

// ==========================================
// CONFIGURATION
// ==========================================
const B2_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';
const B2_REGION = process.env.B2_REGION || 'us-east-005';
const B2_BUCKET = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET;
const LIFEBOAT_PREFIX = 'LIFEBOAT_RAW_DUMP/';

// ==========================================
// INITIALIZATION
// ==========================================
const s3Client = new S3Client({
    endpoint: B2_ENDPOINT,
    region: B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    },
});

const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.heic': 'image/heic'
  };
  return mimeMap[ext] || 'application/octet-stream';
};

async function runInjector() {
    console.log("=======================================================");
    console.log("🚀 LifeOS B2 Lifeboat -> MongoDB Injector");
    console.log("=======================================================\n");

    if (!B2_BUCKET) {
        console.error("❌ ERROR: Missing B2_BUCKET in .env.local");
        process.exit(1);
    }

    const uri = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
    console.log("📡 Connecting to MongoDB Atlas...");
    const mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    const db = mongoClient.db('LifeOS');
    const pendingCollection = db.collection('pending_accessions');
    
    console.log("✅ MongoDB Connected.");
    console.log(`📡 Scanning B2 Bucket [${B2_BUCKET}] with prefix [${LIFEBOAT_PREFIX}]...\n`);

    let continuationToken = undefined;
    let totalFilesFound = 0;
    let newInsertions = 0;
    let isTruncated = true;
    
    const systemUserId = 'system_migration_bot';

    while (isTruncated) {
        const listParams = {
            Bucket: B2_BUCKET,
            Prefix: LIFEBOAT_PREFIX,
            ContinuationToken: continuationToken,
            MaxKeys: 1000 // Max allowed B2 batch
        };

        const listRes = await s3Client.send(new ListObjectsV2Command(listParams));
        
        if (!listRes.Contents || listRes.Contents.length === 0) {
            break;
        }

        const batchOperations = [];
        
        for (const object of listRes.Contents) {
            totalFilesFound++;
            const filename = path.basename(object.Key);
            
            // Reconstruct the direct CDN url
            const originalB2Url = `https://f005.backblazeb2.com/file/${B2_BUCKET}/${object.Key}`;
            const fileType = getMimeType(filename);
            const isImage = /\.(jpg|jpeg|png|webp|gif|heic|tiff)$/i.test(filename);
            
            const updatePayload = {
                url: originalB2Url,
                size: object.Size,
                originalName: filename,
                fileType: fileType,
                status: 'pending',
                userId: systemUserId,
                createdAt: new Date(),
                aiProcessed: !isImage, // Only flag images for the LLM queue
                triage: {
                  title: filename,
                  summary: '',
                  suggestedTags: []
                }
            };
            
            // Using upsert with $setOnInsert ensures idempotency.
            // If the script crashes, you can safely rerun it without creating duplicates.
            batchOperations.push({
                updateOne: {
                    filter: { originalName: filename, size: object.Size },
                    update: { $setOnInsert: updatePayload },
                    upsert: true
                }
            });
        }

        if (batchOperations.length > 0) {
            const bulkResult = await pendingCollection.bulkWrite(batchOperations, { ordered: false });
            newInsertions += bulkResult.upsertedCount;
            process.stdout.write(`\r[INJECT] Scanned: ${totalFilesFound} | New Injections: ${newInsertions}`);
        }

        isTruncated = listRes.IsTruncated;
        continuationToken = listRes.NextContinuationToken;
    }

    console.log(`\n\n✅ Injection Complete!`);
    console.log(`Total Files in B2 Rescue Bucket: ${totalFilesFound}`);
    console.log(`Successfully injected into MongoDB queue: ${newInsertions}\n`);

    await mongoClient.close();
}

runInjector().catch(console.error);
