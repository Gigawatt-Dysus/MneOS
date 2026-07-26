import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.local' });

import { MongoClient } from 'mongodb';
import sqlite3 from 'sqlite3';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from 'sharp';
import fs from 'fs';

import exifr from 'exifr';

// --- CONFIGURATION ---
const BATCH_SIZE = 10; // "Small batches."
const TARGET_COLLECTION = 'pending_accessions'; // Options: 'media' or 'pending_accessions'
const DRY_RUN = false; // Set to true to test lookup without uploading
// ---------------------

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

async function run() {
    console.log(`\n🪄  [Mass Healer] Initiating Omni-Database F:\\ drive forensic pipeline...`);
    console.log(`🎯 Target: ALL Collections across BOTH Alpha and Atlas (Batch Size: ${BATCH_SIZE})`);
    
    const uris = [
        { name: 'Alpha Vault', uri: process.env.MONGODB_URI || 'mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin' },
        { name: 'Atlas Cloud', uri: process.env.ATLAS_CLOUD_URI }
    ].filter(db => db.uri); // Only connect if URI exists

    // Connect to F:\staging.db
    const sqliteDb = new sqlite3.Database('F:\\staging.db', sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Failed to open F:\\staging.db. Ensure the F drive is accessible.');
            process.exit(1);
        }
    });

    const s3Client = getS3Client();
    const bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";

    let totalProcessed = 0;
    const report: any[] = [];

    for (const dbConfig of uris) {
        console.log(`\n=============================================`);
        console.log(`🔌 Connecting to ${dbConfig.name}...`);
        const mongoClient = new MongoClient(dbConfig.uri!);
        await mongoClient.connect();
        const db = mongoClient.db('LifeOS');

        // Fetch all collections in this database
        const collections = await db.listCollections().toArray();
        console.log(`📂 Found ${collections.length} collections in ${dbConfig.name}. Scanning for unhealed media...`);

        for (const colInfo of collections) {
            const collection = db.collection(colInfo.name);

            // Fetch Batch (Strictly images, not yet healed)
            const records = await collection.find({
                fileType: { $regex: /^image\//i }, // EXPLICIT FILTER: ONLY IMAGES
                thumbnail_metadata_healed: { $ne: true } // Our new tracking flag
            }).limit(BATCH_SIZE - totalProcessed).toArray();

            if (records.length > 0) {
                console.log(`   -> Found ${records.length} pending items in collection: [${colInfo.name}]`);
                
                for (const record of records) {
                    if (totalProcessed >= BATCH_SIZE) break;
                    let status = 'SUCCESS';
                    let fDrivePath = 'N/A';
                    let extractedDate: Date | null = null;
                    
                    try {
                        const fileName = record.fileName || record.originalName;
                        if (!fileName) {
                            status = 'SKIP: No filename';
                            throw new Error('No filename available');
                        }

                        const sqliteRow = await querySqlite(
                            sqliteDb, 
                            "SELECT filepath FROM files WHERE filename = ? AND size = ?", 
                            [fileName, record.size]
                        );

                        if (!sqliteRow || !sqliteRow.filepath) {
                            status = 'FAIL: Not in staging.db';
                            throw new Error(`Could not find ${fileName} (${record.size} bytes) in staging.db`);
                        }

                        fDrivePath = sqliteRow.filepath;

                        if (!fs.existsSync(fDrivePath)) {
                            status = 'FAIL: File missing on disk';
                            throw new Error(`File mapped in DB but missing on disk: ${fDrivePath}`);
                        }

                        if (!DRY_RUN) {
                            const originalBuffer = fs.readFileSync(fDrivePath);
                            
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

                            for (const [sizeName, width] of Object.entries(thumbSizes)) {
                                const resizedBuffer = await sharp(originalBuffer)
                                    .resize({ width, withoutEnlargement: true })
                                    .withMetadata() 
                                    .webp({ quality: 80 })
                                    .toBuffer();

                                const objectKey = `thumbnails/${record.userId || 'migration'}/${timestamp}_${sizeName}_${safeName}.webp`;
                                
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

                            await collection.updateOne(
                                { _id: record._id },
                                { $set: updatePayload }
                            );
                        }
                    } catch (err: any) {
                        if (status === 'SUCCESS') status = `ERROR: ${err.message}`;
                    }

                    report.push({
                        'DB': dbConfig.name,
                        'Collection': colInfo.name,
                        'Mongo ID': record._id.toString(),
                        'File Name': record.fileName || record.originalName,
                        'Date': extractedDate ? extractedDate.toISOString().split('T')[0] : 'None',
                        'Status': status
                    });

                    totalProcessed++;
                }
            }
            if (totalProcessed >= BATCH_SIZE) break;
        }
        await mongoClient.close();
        if (totalProcessed >= BATCH_SIZE) break;
    }

    if (totalProcessed === 0) {
        console.log(`\n✨ Omni-scan complete: No pending unhealed image records found across any database or collection!`);
        process.exit(0);
    }
}

run().catch(err => {
    console.error("FATAL ERROR:", err);
    process.exit(1);
});
