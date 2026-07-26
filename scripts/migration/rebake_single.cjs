require('dotenv').config({ path: 'C:/MneOS/.env.local' });
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

async function rebake() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
    await client.connect();
    const db = client.db('LifeOS');
    
    for (const img of ['20250516_170511.jpg', '20250413_084210.jpg']) {
        const record = await db.collection('media').findOne({ originalName: img });
        if (!record) continue;
        console.log('Original URL:', record.url);
        const res = await fetch(record.url);
        const originalBuffer = Buffer.from(await res.arrayBuffer());
        
        const finalBuffer = await sharp(originalBuffer, { failOn: 'none' }).rotate().toBuffer();
        const rotatedSharp = sharp(finalBuffer);
        const resizedBuffer = await rotatedSharp.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        
        let urlParts = record.thumbnailUrls.medium.split('?')[0].split('/file/LifeOS-Media/');
        const objectKey = urlParts[1];
        
        await s3Client.send(new PutObjectCommand({
            Bucket: 'LifeOS-Media',
            Key: objectKey,
            Body: resizedBuffer,
            ContentType: 'image/webp'
        }));
        
        console.log('Successfully rebaked ' + img);
        
        // Cache bust the URL by appending ?v=Date.now()
        const newMediumUrl = record.thumbnailUrls.medium.split('?')[0] + '?v=' + Date.now();
        const newSmallUrl = record.thumbnailUrls.small.split('?')[0] + '?v=' + Date.now();
        const newLargeUrl = record.thumbnailUrls.large.split('?')[0] + '?v=' + Date.now();
        
        const updateRes = await db.collection('media').updateOne({ _id: record._id }, { 
            $set: { 
                'thumbnailUrls.medium': newMediumUrl,
                'thumbnailUrls.small': newSmallUrl,
                'thumbnailUrls.large': newLargeUrl
            } 
        });
        console.log('DB Updated:', updateRes.modifiedCount);
    }
    await client.close();
}

rebake().catch(console.error);
