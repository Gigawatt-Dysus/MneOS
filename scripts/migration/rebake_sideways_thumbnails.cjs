require('dotenv').config({ path: 'C:/MneOS/.env.local' });
const fs = require('fs');
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { MongoClient } = require('mongodb');

const s3Client = new S3Client({
    endpoint: process.env.B2_ENDPOINT,
    region: process.env.B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
    }
});

const thumbSizes = {
    small: 400,
    medium: 800,
    large: 1600
};

async function rebake() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
    await client.connect();
    const db = client.db('LifeOS');
    
    const badRecordsCursor = db.collection('temp_sideways').find({});
    let count = 0;

    for await (const doc of badRecordsCursor) {
        const colName = doc.collection || 'media';
        const targetId = doc.recordId || doc._id;
        
        const collection = db.collection(colName);
        const record = await collection.findOne({ _id: targetId });
        if (!record || !record.url) {
            console.log(`[SKIP] Missing record or URL for ${targetId} in ${colName}`);
            continue;
        }

        console.log(`[REBAKE] Fetching original for ${record.originalName || record._id} from ${record.url}`);
        
        let originalBuffer;
        try {
            const res = await fetch(record.url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            originalBuffer = Buffer.from(await res.arrayBuffer());
        } catch (e) {
            console.log(`[ERROR] Failed to fetch ${record.url}: ${e.message}`);
            continue;
        }

        let rotatedSharp;
        try {
            const finalBuffer = await sharp(originalBuffer, { failOn: 'none' }).rotate().toBuffer();
            rotatedSharp = sharp(finalBuffer);
        } catch (e) {
            console.log(`[ERROR] Sharp failed to rotate: ${e.message}`);
            continue;
        }

        for (const [sizeName, width] of Object.entries(thumbSizes)) {
            if (!record.thumbnailUrls || !record.thumbnailUrls[sizeName]) continue;
            try {
                const resizedBuffer = await rotatedSharp.clone()
                    .resize({ width, withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toBuffer();

                const urlParts = record.thumbnailUrls[sizeName].split(`/file/LifeOS-Media/`);
                if (urlParts.length !== 2) continue;
                const objectKey = urlParts[1];

                const putCmd = new PutObjectCommand({
                    Bucket: 'LifeOS-Media',
                    Key: objectKey,
                    Body: resizedBuffer,
                    ContentType: 'image/webp'
                });

                await s3Client.send(putCmd);
                console.log(`  -> Overwrote ${sizeName} at ${objectKey}`);
            } catch (e) {
                console.log(`  -> [ERROR] Overwriting ${sizeName}: ${e.message}`);
            }
        }
        
        await db.collection('temp_sideways').deleteOne({ _id: doc._id });
        count++;
    }

    console.log(`\nRebaked ${count} thumbnails.`);
    await client.close();
}

rebake().catch(console.error);
