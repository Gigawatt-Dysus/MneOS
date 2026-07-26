import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { MongoClient } from 'mongodb';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';

// Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BLOG_URL = 'https://cornettfamilyjournal.blogspot.com';
const FEED_URL = `${BLOG_URL}/feeds/posts/default?alt=json&max-results=500`;
const USER_ID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23'; // Hardcoded Zen Root UID
const BUCKET_NAME = process.env.B2_BUCKET_NAME || "LifeOS-Media";
const b2EndpointRaw = (process.env.B2_ENDPOINT || "s3.us-east-005.backblazeb2.com").replace(/^["']|["']$/g, '');
const b2Endpoint = b2EndpointRaw.startsWith('http') ? b2EndpointRaw : `https://${b2EndpointRaw}`;
const b2Host = b2Endpoint.replace(/^https?:\/\//, '');

// Initialize S3/B2 Client for VIP bypass uploading
const s3Client = new S3Client({
    region: process.env.B2_REGION || "us-east-005",
    endpoint: b2Endpoint,
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID?.replace(/^["']|["']$/g, ''),
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY?.replace(/^["']|["']$/g, ''),
    },
});

const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});

async function downloadAndUploadImage(imageUrl) {
    console.log(`  [↓] Downloading image: ${imageUrl}`);
    
    // Fix protocol-relative URLs from Blogger
    if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
    }

    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
    
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    
    const timestamp = Date.now();
    const safeName = path.basename(imageUrl.split('?')[0]).replace(/[^a-zA-Z0-9.]/g, '_');
    const finalName = safeName.includes('.') ? safeName : `${safeName}.jpg`;
    
    const objectKey = `uploads/${timestamp}-${finalName}`;

    console.log(`  [↑] Uploading to Backblaze B2: ${objectKey}`);
    await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
    }));

    const b2Url = `https://${BUCKET_NAME}.${b2Host}/${objectKey}`;
    
    const mediaId = crypto.randomUUID();
    const mediaRecord = {
        _id: mediaId,
        id: mediaId,
        userId: USER_ID,
        url: b2Url,
        thumbnailUrl: b2Url, 
        caption: 'Imported from The Family Journal',
        uploadDate: new Date(),
        fileType: contentType,
        fileName: finalName,
        size: buffer.length,
        tagIds: [],
        status: 'clean', // VIP Bypass (no airlock)
        source: imageUrl, // Track original source
        aiProcessed: false, // Flag for Moondream 3 to sweep it later
        datePrecision: 'day'
    };

    return { b2Url, mediaRecord };
}

async function run() {
    console.log('\n=======================================================');
    console.log('dYOO SOVEREIGN BLOGSPOT INGESTOR INITIATED');
    console.log('=======================================================\n');

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('LifeOS');

    console.log('[*] Sweeping previous incomplete Blogspot imports (Idempotency)...');
    const deleteRes = await db.collection('events').deleteMany({ "metadata.importSource": "blogspot" });
    console.log(`[*] Wiped ${deleteRes.deletedCount} previous draft events.\n`);
    
    console.log('[*] Fetching Blogspot JSON Feed...');
    const feedRes = await fetch(FEED_URL);
    const feedData = await feedRes.json();
    const posts = feedData.feed.entry || [];
    
    console.log(`[*] Found ${posts.length} posts to ingest.\n`);

    let successCount = 0;

    for (const post of posts) {
        const title = post.title.$t;
        const publishedDate = new Date(post.published.$t);
        const originalHtml = post.content ? post.content.$t : '';
        const postLink = post.link.find(l => l.rel === 'alternate')?.href || BLOG_URL;
        
        console.log(`[+] Processing: "${title}" (${publishedDate.toISOString().split('T')[0]})`);

        const $ = cheerio.load(originalHtml);
        const mediaRecords = [];

        // Process all images
        const images = $('img').toArray();
        for (const imgEl of images) {
            const src = $(imgEl).attr('src');
            if (src) {
                try {
                    const { b2Url, mediaRecord } = await downloadAndUploadImage(src);
                    mediaRecords.push(mediaRecord);
                    // Rewrite the DOM to point to our sovereign B2 URL
                    $(imgEl).attr('src', b2Url);
                } catch (e) {
                    console.error(`  [!] Failed to process image ${src}: ${e.message}`);
                }
            }
        }

        // Convert the updated DOM to Markdown
        const cleanHtml = $('body').html() || originalHtml;
        const markdownBody = turndownService.turndown(cleanHtml);

        const eventId = crypto.randomUUID();
        const eventRecord = {
            _id: eventId,
            id: eventId,
            userId: USER_ID,
            title: title,
            date: publishedDate,
            details: markdownBody,
            tagIds: [],
            mediaIds: mediaRecords.map(m => m.id),
            source: postLink,
            metadata: { 
                importSource: 'blogspot',
                originalAuthor: post.author?.[0]?.name?.$t || 'Unknown'
            },
            datePrecision: 'day'
        };

        try {
            // Write to MongoDB
            if (mediaRecords.length > 0) {
                await db.collection('media').insertMany(mediaRecords);
            }
            await db.collection('events').insertOne(eventRecord);
            successCount++;
            console.log(`  [OK] Event forged. Linked ${mediaRecords.length} media assets.\n`);
        } catch (e) {
            console.error(`  [X] Failed to forge event: ${e.message}`);
        }
    }

    console.log('=======================================================');
    console.log(`dY"S [REPORT] Ingested ${successCount}/${posts.length} legacy artifacts.`);
    console.log('=======================================================\n');
    
    await client.close();
}

run().catch(console.error);
