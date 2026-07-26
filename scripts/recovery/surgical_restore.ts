import { MongoClient } from 'mongodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGO_URI = process.env.ATLAS_CLOUD_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
    console.error("No MongoDB URI found.");
    process.exit(1);
}

const s3Client = new S3Client({
    region: 'us-east-005',
    endpoint: process.env.VITE_B2_ENDPOINT || process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
    credentials: {
        accessKeyId: process.env.VITE_B2_KEY_ID || process.env.B2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.VITE_B2_APP_KEY || process.env.B2_SECRET_ACCESS_KEY || ''
    }
});

async function run() {
    const mediaId = process.argv[2];
    const localFile = process.argv[3];

    if (!mediaId || !localFile) {
        console.error("Usage: npx tsx surgical_restore.ts <mediaId> <localFilePath>");
        process.exit(1);
    }

    if (!fs.existsSync(localFile)) {
        console.error(`File not found: ${localFile}`);
        process.exit(1);
    }

    const client = new MongoClient(MONGO_URI!);
    await client.connect();
    const db = client.db('LifeOS');

    let col = 'media';
    let record = await db.collection(col).findOne({ id: mediaId });
    if (!record) {
        col = 'pending_accessions';
        record = await db.collection(col).findOne({ id: mediaId });
    }

    if (!record) {
        console.error(`Media record ${mediaId} not found in DB.`);
        await client.close();
        process.exit(1);
    }

    console.log(`Found record ${mediaId} in ${col}. Processing ${localFile}...`);

    const originalBuffer = fs.readFileSync(localFile);
    
    // Auto-orient and get final dimensions
    const rotatedBuffer = await sharp(originalBuffer).rotate().toBuffer();
    const rotatedSharp = sharp(rotatedBuffer);
    const finalMeta = await rotatedSharp.metadata();

    const ts = Date.now();
    const basePath = `users/recovery/${mediaId}/${ts}`;

    console.log("Uploading main image to B2...");
    const mainKey = `${basePath}.jpg`;
    await s3Client.send(new PutObjectCommand({
        Bucket: 'LifeOS-Media',
        Key: mainKey,
        Body: rotatedBuffer,
        ContentType: 'image/jpeg'
    }));

    const updateObj: any = {
        width: finalMeta.width,
        height: finalMeta.height,
        url: `https://media.gigiwatt.com/file/LifeOS-Media/${mainKey}`,
        thumbnail_metadata_healed: true,
        thumbnailUrls: {}
    };

    const thumbSizes = { small: 400, medium: 800, large: 1600 };
    for (const [sName, width] of Object.entries(thumbSizes)) {
        console.log(`Generating ${sName} thumbnail...`);
        const resizedBuffer = await rotatedSharp.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        
        const thumbKey = `${basePath}_thumb_${sName}.webp`;
        await s3Client.send(new PutObjectCommand({
            Bucket: 'LifeOS-Media',
            Key: thumbKey,
            Body: resizedBuffer,
            ContentType: 'image/webp'
        }));

        updateObj.thumbnailUrls[sName] = `https://media.gigiwatt.com/file/LifeOS-Media/${thumbKey}`;
    }

    console.log("Updating database...");
    await db.collection(col).updateOne({ _id: record._id }, { 
        $set: updateObj,
        $unset: { orientation: "", rotation: "" }
    });

    console.log(`✅ Restore complete for ${mediaId}.`);
    await client.close();
}

run().catch(console.error);
