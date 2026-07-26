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

async function rebakeTargets(images) {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
    await client.connect();
    const db = client.db('LifeOS');
    
    for (const img of images) {
        const record = await db.collection('media').findOne({ originalName: img }) 
            || await db.collection('pending_accessions').findOne({ originalName: img });
            
        if (!record) {
            console.log('NOT FOUND:', img);
            continue;
        }
        
        console.log(`\nProcessing ${img}...`);
        const origUrl = record.url.replace('media.gigiwatt.com', 'f005.backblazeb2.com');
        const res = await fetch(origUrl);
        const originalBuffer = Buffer.from(await res.arrayBuffer());
        
        // Let Sharp auto-rotate based on EXIF, and then we check the FINAL dimensions
        const rotatedBuffer = await sharp(originalBuffer, { failOn: 'none' }).rotate().toBuffer();
        const finalMeta = await sharp(rotatedBuffer).metadata();
        
        const finalWidth = finalMeta.width;
        const finalHeight = finalMeta.height;
        console.log(`  -> Final physical dimensions will be: ${finalWidth}x${finalHeight}`);
        
        // Rebake Thumbnails
        for (const [sizeName, width] of Object.entries({ small: 400, medium: 800, large: 1600 })) {
            if (!record.thumbnailUrls[sizeName]) continue;
            const resizedBuffer = await sharp(rotatedBuffer).clone().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
            const objKey = record.thumbnailUrls[sizeName].split('?')[0].split('/file/LifeOS-Media/')[1];
            await s3Client.send(new PutObjectCommand({ Bucket: 'LifeOS-Media', Key: objKey, Body: resizedBuffer, ContentType: 'image/webp' }));
        }
        
        // Update Database: URLs + Cache Bust + WIDTH & HEIGHT
        const ts = Date.now();
        const updateObj = {
            width: finalWidth,
            height: finalHeight
        };
        for (const sName of ['small', 'medium', 'large']) {
            if (record.thumbnailUrls[sName]) {
                updateObj[`thumbnailUrls.${sName}`] = record.thumbnailUrls[sName].split('?')[0] + '?v=' + ts;
            }
        }
        
        const col = record._collectionSource || 'media';
        const updateRes = await db.collection(col).updateOne({ _id: record._id }, { $set: updateObj });
        console.log(`  -> DB Updated: Width ${finalWidth}, Height ${finalHeight}, modified: ${updateRes.modifiedCount}`);
    }
    await client.close();
}

rebakeTargets(['20250402_125753.jpg', '20250325_101121.jpg']).catch(console.error);
