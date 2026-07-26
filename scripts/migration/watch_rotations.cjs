const { MongoClient } = require('mongodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const dotenv = require('dotenv');
const os = require('os');

dotenv.config({ path: '.env.local' });

const NODE_ID = process.env.NODE_ID || os.hostname().toUpperCase();

const getS3Client = () => {
    let endpoint = process.env.B2_ENDPOINT || 's3.us-east-005.backblazeb2.com';
    if (!endpoint.startsWith('http')) endpoint = `https://${endpoint}`;

    return new S3Client({
        region: process.env.B2_REGION || 'us-east-005',
        endpoint: endpoint,
        credentials: {
            accessKeyId: process.env.B2_ACCESS_KEY_ID,
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
        }
    });
};

const getMongoUri = () => {
    if (NODE_ID === 'GGA') return "mongodb://zen:sovereign@127.0.0.1:27017/LifeOS?authSource=admin";
    if (NODE_ID === 'VICTUS' || NODE_ID.startsWith('GGB') || NODE_ID.startsWith('GGC')) {
        return "mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin";
    }
    return process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/LifeOS";
};

async function processAsset(record, collection, s3Client, bucketName) {
    try {
        console.log(`\n[🔄 ${NODE_ID}] Processing Rotation: ${record.originalName || record.id}`);
        
        if (!record.url) {
            throw new Error('No B2 URL found for asset.');
        }

        console.log(`[DOWNLOAD] Fetching original from: ${record.url}`);
        const response = await fetch(encodeURI(record.url));
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching original file`);
        
        const arrayBuffer = await response.arrayBuffer();
        const originalBuffer = Buffer.from(arrayBuffer);

        const targetRotation = Number(record.rotation) || 0;
        console.log(`[SHARP] Applying ${targetRotation} degree rotation...`);

        // [ZEN] First auto-orient based on EXIF, then apply exact requested degree rotation
        let rotatedSharp = sharp(originalBuffer, { failOn: 'none' }).rotate(); 
        
        if (targetRotation !== 0) {
            const autoOrientedBuffer = await rotatedSharp.toBuffer();
            rotatedSharp = sharp(autoOrientedBuffer, { failOn: 'none' }).rotate(targetRotation);
        }
        
        const metadata = await rotatedSharp.metadata();
        const physicalWidth = metadata.width;
        const physicalHeight = metadata.height;

        const thumbSizes = { small: 300, medium: 800, large: 1600 };
        const newThumbnailUrls = {};
        const safeName = (record.fileName || record.originalName || "rotated_image").replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Date.now();

        for (const [sizeName, width] of Object.entries(thumbSizes)) {
            const resizedBuffer = await rotatedSharp
                .clone()
                .resize({ width, withoutEnlargement: true })
                .webp({ quality: 80 })
                .toBuffer();

            // Re-use existing S3 object key if possible to overwrite directly, saving storage
            let objectKey = '';
            if (record.thumbnailUrls && record.thumbnailUrls[sizeName]) {
                const urlParts = record.thumbnailUrls[sizeName].split(`/file/${bucketName}/`);
                if (urlParts.length === 2) {
                    objectKey = urlParts[1];
                }
            }

            if (!objectKey) {
                objectKey = `thumbnails/${record.userId || 'system'}/${timestamp}_${sizeName}_${safeName}.webp`;
            }

            console.log(`[UPLOAD] Writing ${sizeName} thumbnail to B2...`);
            await s3Client.send(new PutObjectCommand({
                Bucket: bucketName,
                Key: objectKey,
                ContentType: 'image/webp',
                Body: resizedBuffer
            }));

            newThumbnailUrls[sizeName] = `https://media.gigiwatt.com/file/${bucketName}/${objectKey}`;
        }

        const updatePayload = {
            thumbnailUrls: newThumbnailUrls,
            physicalWidth: physicalWidth,
            physicalHeight: physicalHeight,
            width: physicalWidth,   // Keep synchronized
            height: physicalHeight  // Keep synchronized
        };

        await collection.updateOne(
            { _id: record._id },
            { 
                $set: updatePayload,
                $unset: { needs_thumbnail_rebuild: "", processing_lock: "" }
            }
        );

        console.log(`[✅ ${NODE_ID}] Successfully rotated and healed: ${record.originalName || record.id}`);

    } catch (err) {
        console.error(`[❌ ${NODE_ID}] FAILED to rotate ${record.originalName || record.id}:`, err.message);
        await collection.updateOne(
            { _id: record._id },
            { 
                $set: { rotation_error: err.message },
                $unset: { processing_lock: "", needs_thumbnail_rebuild: "" }
            }
        );
    }
}

async function runRotator() {
    console.log(`[ZEN] Booting Matrix Rotation Healer on node: ${NODE_ID}`);
    const mongoUri = getMongoUri();
    const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });

    try {
        await client.connect();
        const db = client.db('LifeOS');
        const s3Client = getS3Client();
        const bucketName = process.env.B2_BUCKET_NAME || 'gigi-lifeos-bucket';

        const collectionsToWatch = ['media', 'pending_accessions'];

        while (true) {
            let processedSomething = false;

            for (const collName of collectionsToWatch) {
                const collection = db.collection(collName);

                // Atomic Pez-Dispenser Lock
                const record = await collection.findOneAndUpdate(
                    { needs_thumbnail_rebuild: true, processing_lock: { $exists: false } },
                    { $set: { processing_lock: NODE_ID } },
                    { returnDocument: 'after' }
                );

                if (record) {
                    await processAsset(record, collection, s3Client, bucketName);
                    processedSomething = true;
                }
            }

            if (!processedSomething) {
                // Sleep for 3 seconds if queue is empty
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    } catch (err) {
        console.error("FATAL ERROR:", err);
    } finally {
        await client.close();
    }
}

runRotator();
