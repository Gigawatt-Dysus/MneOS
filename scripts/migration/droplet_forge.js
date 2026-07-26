import { MongoClient } from 'mongodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Disable Sharp's internal memory-mapped cache for server environments
sharp.cache(false);

const B2_ENDPOINT = process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com';
const B2_REGION = process.env.B2_REGION || 'us-east-005';
const B2_BUCKET = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET;

if (!B2_BUCKET || !process.env.B2_ACCESS_KEY_ID) {
    console.error("❌ ERROR: Missing B2 credentials in .env.local");
    process.exit(1);
}

const b2 = new S3Client({
    endpoint: B2_ENDPOINT,
    region: B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    },
});

async function uploadBufferToB2(buffer, objectKey) {
    await b2.send(new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: objectKey,
        Body: buffer,
        ContentType: 'image/webp'
    }));
    return `https://f005.backblazeb2.com/file/${B2_BUCKET}/${objectKey}`;
}

async function runDropletForge() {
    console.log("=======================================================");
    console.log("☁️  DO DROPLET FORGE: B2 Thumbnail Generator");
    console.log("=======================================================\n");

    const uri = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
    console.log("📡 Connecting to MongoDB Atlas...");
    const mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    const db = mongoClient.db('LifeOS');
    const pendingCollection = db.collection('pending_accessions');
    
    console.log("✅ MongoDB Connected. Hunting for missing thumbnails...\n");

    // Find all images injected by panic_dump that lack thumbnails
    const cursor = pendingCollection.find({
        thumbnailUrls: { $exists: false },
        fileType: { $regex: '^image/' }
    });

    const totalDocs = await pendingCollection.countDocuments({
        thumbnailUrls: { $exists: false },
        fileType: { $regex: '^image/' }
    });

    console.log(`🎯 Found ${totalDocs} images requiring thumbnail generation.`);

    let processedCount = 0;
    let failedCount = 0;

    while (await cursor.hasNext()) {
        const doc = await cursor.next();
        const { _id, url, originalName } = doc;

        try {
            const baseName = path.parse(originalName || 'unknown').name;
            const cleanName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
            const ts = Date.now();

            // 1. Download raw image from B2 into RAM (bypassing disk entirely)
            const parts = url.split('/');
            const domain = parts.slice(0, 3).join('/');
            const urlPath = parts.slice(3).map(encodeURIComponent).join('/');
            const safeUrl = domain + '/' + urlPath;
            
            const response = await fetch(safeUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${safeUrl}`);
            const arrayBuffer = await response.arrayBuffer();
            const rawBuffer = Buffer.from(arrayBuffer);

            let thumbUrls = {};

            // 2. Generate and Upload Small/Medium/Large WebP Thumbnails
            try {
                // Large
                const largeBuf = await sharp(rawBuffer, { failOnError: false })
                    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 80 }).toBuffer();
                thumbUrls.large = await uploadBufferToB2(largeBuf, `users/migration/thumbs/${cleanName}_${ts}_large.webp`);

                // Medium
                const mediumBuf = await sharp(largeBuf, { failOnError: false })
                    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 80 }).toBuffer();
                thumbUrls.medium = await uploadBufferToB2(mediumBuf, `users/migration/thumbs/${cleanName}_${ts}_medium.webp`);

                // Small
                const smallBuf = await sharp(mediumBuf, { failOnError: false })
                    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
                    .webp({ quality: 80 }).toBuffer();
                thumbUrls.small = await uploadBufferToB2(smallBuf, `users/migration/thumbs/${cleanName}_${ts}_small.webp`);

            } catch (sharpErr) {
                console.log(`⚠️ Sharp failed for ${originalName}: ${sharpErr.message}. Creating Synthetic Fallback...`);
                // Generate Synthetic Fallback
                const svgText = `<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100%" height="100%" fill="#1a1a1a" />
                  <path d="M400,200 L450,300 L350,300 Z" fill="#ff4444"/>
                  <text x="50%" y="50%" font-family="Arial, sans-serif" font-weight="bold" font-size="48" fill="#ff4444" text-anchor="middle" dy=".3em">CORRUPTED MEDIA</text>
                  <text x="50%" y="60%" font-family="Arial, sans-serif" font-size="24" fill="#888888" text-anchor="middle">${originalName}</text>
                </svg>`;
                const fallbackBuffer = Buffer.from(svgText);
                
                const largeBuf = await sharp(fallbackBuffer).webp({ quality: 80 }).toBuffer();
                const mediumBuf = await sharp(fallbackBuffer).resize(800).webp({ quality: 80 }).toBuffer();
                const smallBuf = await sharp(fallbackBuffer).resize(400).webp({ quality: 80 }).toBuffer();

                thumbUrls.large = await uploadBufferToB2(largeBuf, `users/migration/thumbs/FALLBACK_${cleanName}_${ts}_large.webp`);
                thumbUrls.medium = await uploadBufferToB2(mediumBuf, `users/migration/thumbs/FALLBACK_${cleanName}_${ts}_medium.webp`);
                thumbUrls.small = await uploadBufferToB2(smallBuf, `users/migration/thumbs/FALLBACK_${cleanName}_${ts}_small.webp`);
            }

            // 3. Update MongoDB Document
            await pendingCollection.updateOne(
                { _id },
                { $set: { thumbnailUrls: thumbUrls } }
            );

            processedCount++;
            process.stdout.write(`\r[FORGE] Processed: ${processedCount}/${totalDocs} | Failed: ${failedCount} `);

        } catch (err) {
            failedCount++;
            console.error(`\n❌ Failed to process ${originalName}: ${err.message}`);
        }
    }

    console.log(`\n\n✅ Droplet Forge Complete! (Processed: ${processedCount}, Failed: ${failedCount})`);
    await mongoClient.close();
}

runDropletForge().catch(console.error);
