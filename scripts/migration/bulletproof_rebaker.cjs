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

const thumbSizes = {
    small: 400,
    medium: 800,
    large: 1600
};

async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
    await client.connect();
    const db = client.db('LifeOS');
    
    let badCount = 0;
    
    for (const colName of ['media', 'pending_accessions']) {
        const collection = db.collection(colName);
        console.log(`\nScanning ${colName}...`);
        
        // We only care about things we previously "healed" 
        const cursor = collection.find({
            fileType: { $regex: /^image\//i },
            thumbnailUrls: { $exists: true },
            thumbnail_metadata_healed: true
        });
        
        while (await cursor.hasNext()) {
            const record = await cursor.next();
            if (!record.thumbnailUrls || !record.thumbnailUrls.medium) continue;
            if (!record.width || !record.height) continue;
            
            // Bypass Cloudflare for checking dimensions
            const b2Url = record.thumbnailUrls.medium.replace('media.gigiwatt.com', 'f005.backblazeb2.com');
            
            let dims;
            try {
                // Fetch just enough to read dimensions (usually first 32KB is enough for sharp)
                const res = await fetch(b2Url, { headers: { 'Range': 'bytes=0-32767' } });
                const buffer = Buffer.from(await res.arrayBuffer());
                dims = await sharp(buffer).metadata();
            } catch (e) {
                continue;
            }
            
            if (dims && dims.width && dims.height) {
                const dbIsPortrait = record.width < record.height;
                const webpIsPortrait = dims.width < dims.height;
                
                if (dbIsPortrait !== webpIsPortrait && record.width !== record.height && dims.width !== dims.height) {
                    console.log(`[SIDEWAYS] ${record.originalName}: DB ${record.width}x${record.height} | WebP ${dims.width}x${dims.height}`);
                    badCount++;
                    
                    console.log(` -> Rebaking...`);
                    try {
                        const origUrl = record.url.replace('media.gigiwatt.com', 'f005.backblazeb2.com');
                        const oRes = await fetch(origUrl);
                        if (!oRes.ok) throw new Error('Orig fetch failed');
                        const oBuf = Buffer.from(await oRes.arrayBuffer());
                        const finalBuf = await sharp(oBuf, { failOn: 'none' }).rotate().toBuffer();
                        const rSharp = sharp(finalBuf);
                        
                        for (const [sName, width] of Object.entries(thumbSizes)) {
                            if (!record.thumbnailUrls[sName]) continue;
                            const resBuf = await rSharp.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
                            const objKey = record.thumbnailUrls[sName].split('?')[0].split('/file/LifeOS-Media/')[1];
                            await s3Client.send(new PutObjectCommand({
                                Bucket: 'LifeOS-Media', Key: objKey, Body: resBuf, ContentType: 'image/webp'
                            }));
                        }
                        
                        const ts = Date.now();
                        const updateObj = {};
                        for (const sName of ['small', 'medium', 'large']) {
                            if (record.thumbnailUrls[sName]) {
                                updateObj[`thumbnailUrls.${sName}`] = record.thumbnailUrls[sName].split('?')[0] + '?v=' + ts;
                            }
                        }
                        await collection.updateOne({ _id: record._id }, { $set: updateObj });
                        console.log(` -> Fixed & Cache-busted!`);
                        
                    } catch (e) {
                        console.log(` -> [ERROR] ${e.message}`);
                    }
                }
            }
        }
    }
    
    console.log(`\nFound and rebaked ${badCount} sideways images!`);
    await client.close();
}

run().catch(console.error);
