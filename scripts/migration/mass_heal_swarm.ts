import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// Load environment variables
dotenv.config({ path: '.env.local' });

import { MongoClient, ObjectId } from 'mongodb';
import sqlite3 from 'sqlite3';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from 'sharp';
import fs from 'fs';
import exifr from 'exifr';

// --- SWARM CONFIGURATION ---
const NODE_ID = process.env.NODE_ID || os.hostname().toUpperCase();
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '3', 10);
// Crucial for Swarm: Map F: to local paths. On Victus/Beta/Gamma this should be "\\100.116.12.18\F" if accessed over network
const FDRIVE_PREFIX = process.env.FDRIVE_PREFIX || 'F:\\'; 
const MAX_TOTAL_PROCESS = parseInt(process.env.MAX_TOTAL_PROCESS || '500000', 10); // Safe exit threshold per run
const DRY_RUN = false; 
// ---------------------------

const getS3Client = () => {
    let endpoint = process.env.B2_ENDPOINT || "s3.us-east-005.backblazeb2.com";
    if (!endpoint.startsWith('http')) endpoint = `https://${endpoint}`;

    return new S3Client({
        region: process.env.B2_REGION || "us-east-005",
        endpoint: endpoint,
        credentials: {
            accessKeyId: process.env.B2_ACCESS_KEY_ID!,
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!,
        },
    });
};

const querySqlite = (db: any, sql: string, params: any[]): Promise<any> => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err: any, row: any) => err ? reject(err) : resolve(row));
    });
};

async function processImage(record: any, collection: any, sqliteDb: any, s3Client: any, bucketName: string) {
    let extractedDate: Date | null = null;
    try {
        const fileName = record.fileName || record.originalName;
        if (!fileName) throw new Error('No filename available');

        let sqliteRow = await querySqlite(
            sqliteDb, 
            "SELECT filepath FROM files WHERE filename = ? AND size = ?", 
            [fileName, record.size]
        );

        if (!sqliteRow || !sqliteRow.filepath) {
            // Fallback for null/missing sizes or deduplication anomalies
            sqliteRow = await querySqlite(
                sqliteDb, 
                "SELECT filepath FROM files WHERE filename = ? LIMIT 1", 
                [fileName]
            );
        }

        let fDrivePath = sqliteRow ? sqliteRow.filepath : null;
        if (fDrivePath && fDrivePath.startsWith('F:\\') && FDRIVE_PREFIX !== 'F:\\') {
            fDrivePath = fDrivePath.replace('F:\\', FDRIVE_PREFIX + (FDRIVE_PREFIX.endsWith('\\') ? '' : '\\'));
        }

        if (!DRY_RUN) {
            let originalBuffer: Buffer;
            if (fDrivePath && fs.existsSync(fDrivePath)) {
                originalBuffer = fs.readFileSync(fDrivePath);
            } else if (record.url) {
                console.log(`[${NODE_ID}] File missing locally (MAX_PATH limit). Streaming from B2: ${record.url}`);
                const fetchResponse = await fetch(record.url);
                if (!fetchResponse.ok) throw new Error(`B2 Fetch failed: ${fetchResponse.status} ${fetchResponse.statusText}`);
                const ab = await fetchResponse.arrayBuffer();
                originalBuffer = Buffer.from(ab);
            } else {
                throw new Error(`File missing locally and no B2 URL found for fallback.`);
            }

            try {
                const exifData = await exifr.parse(originalBuffer);
                if (exifData && exifData.DateTimeOriginal) {
                    extractedDate = new Date(exifData.DateTimeOriginal);
                } else if (exifData && exifData.CreateDate) {
                    extractedDate = new Date(exifData.CreateDate);
                }
            } catch (exifErr) {}

            const thumbSizes = { small: 300, medium: 800, large: 1600 };
            const newThumbnailUrls: Record<string, string> = {};
            const timestamp = Date.now();
            const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

            // [ZEN PATCH] Ultimate Forensic Rotation Logic (The Holy Grail)
            let exifRotation = 0;
            try {
                const exifData = await exifr.parse(originalBuffer);
                if (exifData && exifData.Orientation) {
                    const orientationStr = exifData.Orientation.toString().toLowerCase();
                    if (orientationStr.includes('180') || exifData.Orientation === 3) exifRotation = 180;
                    else if (orientationStr.includes('90 cw') || exifData.Orientation === 6) exifRotation = 90;
                    else if (orientationStr.includes('270 cw') || orientationStr.includes('90 ccw') || exifData.Orientation === 8) exifRotation = 270;
                }
            } catch (e) {}

            let finalBuffer = await sharp(originalBuffer, { failOn: 'none' }).rotate().toBuffer();
            
            let dbRotation = 0;
            if (typeof record.rotation === 'number') {
                dbRotation = record.rotation;
            } else if (typeof record.orientation === 'number') {
                if (record.orientation === 6) dbRotation = 90;
                else if (record.orientation === 3) dbRotation = 180;
                else if (record.orientation === 8) dbRotation = 270;
            }

            if (dbRotation > 0 && dbRotation % 360 !== 0) {
                if (dbRotation !== exifRotation) {
                    console.log(`[${NODE_ID}] \u26A0\uFE0F Manual UI rotation detected! Stacking ${dbRotation} deg.`);
                    finalBuffer = await sharp(finalBuffer).rotate(dbRotation).toBuffer();
                }
            }

            const rotatedSharp = sharp(finalBuffer);
            const metadata = await rotatedSharp.metadata();
            const physicalWidth = metadata.width;
            const physicalHeight = metadata.height;

            for (const [sizeName, width] of Object.entries(thumbSizes)) {
                const resizedBuffer = await rotatedSharp.clone()
                    .resize({ width, withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toBuffer();

                let objectKey = '';
                if (record.thumbnailUrls && record.thumbnailUrls[sizeName]) {
                    // Extract existing object key to overwrite the corrupted file directly
                    const urlParts = record.thumbnailUrls[sizeName].split(`/file/${bucketName}/`);
                    if (urlParts.length === 2) {
                        objectKey = urlParts[1];
                    }
                }
                
                // Fallback for new records that never had a thumbnail
                if (!objectKey) {
                    objectKey = `thumbnails/${record.userId || 'migration'}/${timestamp}_${sizeName}_${safeName}.webp`;
                }
                
                await s3Client.send(new PutObjectCommand({
                    Bucket: bucketName,
                    Key: objectKey,
                    ContentType: 'image/webp',
                    Body: resizedBuffer
                }));

                newThumbnailUrls[sizeName] = `https://media.gigiwatt.com/file/${bucketName}/${objectKey}`;
            }

            const updatePayload: any = { 
                thumbnailUrls: newThumbnailUrls,
                thumbnail_metadata_healed: true 
            };

            if (extractedDate && !isNaN(extractedDate.getTime())) {
                updatePayload.logicalDate = extractedDate;
            }

            // Atomic release of the lock and update
            await collection.updateOne(
                { _id: record._id },
                { 
                    $set: updatePayload,
                    $unset: { processing_lock: "", locked_at: "", rotation: "", orientation: "" }
                }
            );
            console.log(`[${NODE_ID}] ✅ Healed: ${fileName} ${extractedDate ? `[${extractedDate.toISOString().split('T')[0]}]` : ''}`);
        }
    } catch (err: any) {
        console.error(`[${NODE_ID}] ❌ Error processing ${record.originalName}: ${err.message}`);
        // Lock out the file so it doesn't cause infinite loops across the swarm
        await collection.updateOne(
            { _id: record._id },
            { 
                $set: { 
                    thumbnail_metadata_healed: true,
                    processing_error: err.message
                },
                $unset: { processing_lock: "", locked_at: "" }
            }
        );
    }
}

async function runSwarm() {
    console.log(`\n🐝 [SWARM NODE: ${NODE_ID}] Online.`);
    console.log(`⚙️  Concurrency: ${MAX_CONCURRENT} | Drive Prefix: ${FDRIVE_PREFIX}`);
    console.log(`🎯 Target: Omni-scan across Alpha and Atlas databases.\n`);
    
    const uris = [
        { name: 'Alpha Vault', uri: process.env.MONGODB_URI || 'mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin' },
        { name: 'Atlas Cloud', uri: process.env.ATLAS_CLOUD_URI }
    ].filter(db => db.uri);

    // Staging DB is required on all nodes for filename -> physical path resolution
    const stagingDbPath = path.join(FDRIVE_PREFIX, 'staging.db');
    const sqliteDb = new sqlite3.Database(stagingDbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error(`❌ Failed to open staging.db at ${stagingDbPath}`);
            process.exit(1);
        }
    });

    const s3Client = getS3Client();
    const bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";

    let totalProcessed = 0;

    for (const dbConfig of uris) {
        console.log(`\n=============================================`);
        console.log(`🔌 Connecting to ${dbConfig.name}...`);
        const mongoClient = new MongoClient(dbConfig.uri!);
        await mongoClient.connect();
        const db = mongoClient.db('LifeOS');

        const collections = await db.listCollections().toArray();
        
        for (const colInfo of collections) {
            const collection = db.collection(colInfo.name);
            let collectionEmpty = false;

            while (!collectionEmpty && totalProcessed < MAX_TOTAL_PROCESS) {
                const queue: Promise<void>[] = [];

                // Fill the chunk queue up to MAX_CONCURRENT
                for (let i = 0; i < MAX_CONCURRENT; i++) {
                    // ATOMIC PEZ DISPENSER LOCK
                    const doc = await collection.findOneAndUpdate(
                        { 
                            fileType: { $regex: /^image\//i }, 
                            $or: [
                                { thumbnail_metadata_healed: { $ne: true } },
                                { rotation: { $exists: true } },
                                { orientation: { $exists: true } }
                            ],
                            processing_lock: { $exists: false } 
                        },
                        { 
                            $set: { 
                                processing_lock: NODE_ID, 
                                locked_at: new Date() 
                            } 
                        },
                        { returnDocument: 'after' }
                    );

                    if (!doc) {
                        collectionEmpty = true;
                        break; // No more records in this collection
                    }

                    totalProcessed++;
                    queue.push(processImage(doc, collection, sqliteDb, s3Client, bucketName));
                }

                // Wait for the chunk to finish processing (this acts as the sequential buffer for disk sanity)
                if (queue.length > 0) {
                    await Promise.all(queue);
                }
            }

            if (totalProcessed >= MAX_TOTAL_PROCESS) break;
        }

        await mongoClient.close();
        if (totalProcessed >= MAX_TOTAL_PROCESS) break;
    }

    console.log(`\n🏁 [${NODE_ID}] Swarm cycle complete. Processed: ${totalProcessed}`);
    process.exit(0);
}

runSwarm().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
