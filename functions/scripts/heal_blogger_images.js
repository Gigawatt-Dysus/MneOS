require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');

const USER_ID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23'; // Zen Root UID
const BUCKET_NAME = process.env.B2_BUCKET_NAME || "LifeOS-Media";
const b2EndpointRaw = (process.env.B2_ENDPOINT || "s3.us-east-005.backblazeb2.com").replace(/^["']|["']$/g, '');
const b2Endpoint = b2EndpointRaw.startsWith('http') ? b2EndpointRaw : `https://${b2EndpointRaw}`;
const b2Host = b2Endpoint.replace(/^https?:\/\//, '');

const s3Client = new S3Client({
    region: process.env.B2_REGION || "us-east-005",
    endpoint: b2Endpoint,
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID?.replace(/^["']|["']$/g, ''),
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY?.replace(/^["']|["']$/g, ''),
    },
});

async function downloadAndUploadHighRes(imageUrl) {
    console.log(`    [↓] Downloading High-Res: ${imageUrl}`);
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch high-res image: ${res.statusText}`);
    
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    
    const timestamp = Date.now();
    const safeName = path.basename(imageUrl.split('?')[0]).replace(/[^a-zA-Z0-9.]/g, '_');
    const finalName = safeName.includes('.') ? safeName : `${safeName}.jpg`;
    
    const objectKey = `uploads/${timestamp}-highres-${finalName}`;

    console.log(`    [↑] Uploading High-Res to B2: ${objectKey}`);
    await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
    }));

    return `https://${BUCKET_NAME}.${b2Host}/${objectKey}`;
}

async function run() {
    console.log('\n=======================================================');
    console.log('dYOO HEALING BLOGGER HIGH-RES LINKS');
    console.log('=======================================================\n');

    const uri = process.env.MONGODB_URI || "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');

    const events = await db.collection('events').find({ "metadata.importSource": "blogspot" }).toArray();
    console.log(`[*] Found ${events.length} Blogger events to scan.`);

    let healedCount = 0;
    
    // Regex to match Markdown image links: [![alt](b2_url)](google_url)
    const linkedImageRegex = /\[\!\[.*?\]\((https:\/\/LifeOS-Media\.s3\.us-east-005\.backblazeb2\.com\/[^\)]+)\)\]\((https:\/\/blogger\.googleusercontent\.com\/[^\)]+)\)/g;

    // Regex to match plain markdown links: [link text](google_url) that are likely images
    const plainLinkRegex = /\[.*?\]\((https:\/\/blogger\.googleusercontent\.com\/[^\)]+\.(?:jpg|jpeg|png|gif).*?)\)/gi;
    
    for (const event of events) {
        if (!event.details) continue;
        
        let newDetails = event.details;
        let modified = false;
        
        // 1. Process linked images (thumbnail in B2, link to Google)
        let match;
        while ((match = linkedImageRegex.exec(event.details)) !== null) {
            const fullMatch = match[0];
            const b2ThumbUrl = match[1];
            const googleHighResUrl = match[2];
            
            console.log(`\n  [+] Found Google link in Event: ${event.title}`);
            try {
                // Download the high res and upload to B2
                const highResB2Url = await downloadAndUploadHighRes(googleHighResUrl);
                
                // Find existing Media record with the thumbnail URL
                const existingMedia = await db.collection('media').findOne({ url: b2ThumbUrl });
                if (existingMedia) {
                    // Update existing media: make high-res the main URL, keep thumbnail as thumbnailUrl
                    await db.collection('media').updateOne(
                        { _id: existingMedia._id },
                        { $set: { url: highResB2Url, thumbnailUrl: b2ThumbUrl } }
                    );
                    console.log(`    [OK] Updated existing Media object ${existingMedia._id}`);
                } else {
                    // Create new Media object if not found
                    const mediaId = crypto.randomUUID();
                    const mediaRecord = {
                        _id: mediaId,
                        id: mediaId,
                        userId: USER_ID,
                        url: highResB2Url,
                        thumbnailUrl: b2ThumbUrl,
                        caption: 'Imported from The Family Journal (High-Res)',
                        uploadDate: new Date(),
                        fileType: 'image/jpeg',
                        fileName: path.basename(highResB2Url),
                        size: 0,
                        tagIds: [],
                        status: 'clean',
                        source: googleHighResUrl,
                        aiProcessed: false,
                        datePrecision: 'day'
                    };
                    await db.collection('media').insertOne(mediaRecord);
                    if (!event.mediaIds.includes(mediaId)) {
                        event.mediaIds.push(mediaId);
                        // Also update db mediaIds right away
                        await db.collection('events').updateOne({ _id: event._id }, { $push: { mediaIds: mediaId } });
                    }
                    console.log(`    [OK] Created new Media object ${mediaId}`);
                }

                // Strip the markdown snippet out entirely
                newDetails = newDetails.replace(fullMatch, '');
                modified = true;
            } catch (err) {
                console.error(`    [X] Error processing high-res image: ${err.message}`);
            }
        }
        
        // 2. Process any remaining Google image links
        while ((match = plainLinkRegex.exec(event.details)) !== null) {
            // Need to make sure we didn't already remove it
            if (!newDetails.includes(match[0])) continue;
            
            const fullMatch = match[0];
            const googleImgUrl = match[1];
            console.log(`\n  [+] Found standalone Google image in Event: ${event.title}`);
            try {
                const b2Url = await downloadAndUploadHighRes(googleImgUrl);
                
                const mediaId = crypto.randomUUID();
                const mediaRecord = {
                    _id: mediaId,
                    id: mediaId,
                    userId: USER_ID,
                    url: b2Url,
                    thumbnailUrl: b2Url,
                    caption: 'Imported from The Family Journal',
                    uploadDate: new Date(),
                    fileType: 'image/jpeg',
                    fileName: path.basename(b2Url),
                    size: 0,
                    tagIds: [],
                    status: 'clean',
                    source: googleImgUrl,
                    aiProcessed: false,
                    datePrecision: 'day'
                };
                await db.collection('media').insertOne(mediaRecord);
                if (!event.mediaIds.includes(mediaId)) {
                    await db.collection('events').updateOne({ _id: event._id }, { $push: { mediaIds: mediaId } });
                }
                console.log(`    [OK] Created new Media object ${mediaId}`);
                
                newDetails = newDetails.replace(fullMatch, '');
                modified = true;
            } catch (err) {
                console.error(`    [X] Error processing standalone Google image: ${err.message}`);
            }
        }

        // Clean up empty links or leftover tags if necessary, just trim newlines
        if (modified) {
            newDetails = newDetails.trim();
            await db.collection('events').updateOne(
                { _id: event._id },
                { $set: { details: newDetails } }
            );
            console.log(`  [OK] Stripped Google Markdown links from Event details.`);
            healedCount++;
        }
    }

    console.log('=======================================================');
    console.log(`dY"S [REPORT] Healed ${healedCount} Blogger events.`);
    console.log('=======================================================\n');
    await client.close();
}

run().catch(console.error);
