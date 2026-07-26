import { MongoClient, ObjectId } from 'mongodb';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from 'sharp';

let client: MongoClient | null = null;
let dbInstance: any = null;

async function getDatabase() {
  if (!dbInstance) {
    const uri = process.env.MONGODB_URI || '';
    if (!uri) {
        throw new Error('MONGODB_URI environment variable is missing.');
    }
    client = new MongoClient(uri, {
      family: 4,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    await client.connect();
    dbInstance = client.db('LifeOS');
  }
  return dbInstance;
}

const getS3Client = () => {
    const accessKeyId = process.env.B2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.B2_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Missing Backblaze B2 credentials.");
    }
    let endpoint = process.env.B2_ENDPOINT || "s3.us-east-005.backblazeb2.com";
    if (!endpoint.startsWith('http')) {
        endpoint = `https://${endpoint}`;
    }

    return new S3Client({
        region: process.env.B2_REGION || "us-east-005",
        endpoint: endpoint,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
        },
    });
};

async function uploadToB2(s3Client: S3Client, buffer: Buffer, bucketName: string, objectKey: string, mimeType: string) {
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: mimeType,
        Body: buffer
    });
    await s3Client.send(command);
    return `https://media.gigiwatt.com/file/${bucketName}/${objectKey}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { ids, userId } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0 || !userId) {
      return res.status(400).json({ error: "Missing required data (ids array, userId)." });
    }

    const db = await getDatabase();
    const mediaCollection = db.collection('media');
    const s3Client = getS3Client();
    const bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";

    console.log(`[Heal Thumbnails] 🪄 Starting forensic heal for ${ids.length} records by user ${userId}...`);

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
        try {
            // Support dual schema
            const orConditions: any[] = [{ _id: id }, { id: id }];
            if (typeof id === 'string' && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id)) {
                try { orConditions.push({ _id: new ObjectId(id), userId: userId }); } catch(e) {}
            } else {
                orConditions.push({ _id: id, userId: userId });
                orConditions.push({ id: id, userId: userId });
            }
            
            const record = await mediaCollection.findOne({ $or: orConditions });
            if (!record) {
                console.warn(`[Heal Thumbnails] Record not found: ${id}`);
                failCount++;
                continue;
            }

            if (!record.url) {
                console.warn(`[Heal Thumbnails] Record missing original URL: ${id}`);
                failCount++;
                continue;
            }

            console.log(`[Heal Thumbnails] Fetching original asset for ${id}: ${record.url}`);
            const response = await fetch(record.url);
            if (!response.ok) throw new Error(`Failed to fetch original asset: ${response.statusText}`);
            
            const arrayBuffer = await response.arrayBuffer();
            const originalBuffer = Buffer.from(arrayBuffer);

            // Generate thumbnails with rotation baked in
            const thumbSizes = {
                small: 300,
                medium: 800,
                large: 1600
            };

            const newThumbnailUrls: Record<string, string> = {};
            const timestamp = Date.now();
            
            // Re-use existing naming pattern if possible, or create a new clean one
            const baseFileName = record.originalName ? record.originalName.replace(/[^a-zA-Z0-9.-]/g, '_') : 'image.jpg';

            for (const [sizeName, width] of Object.entries(thumbSizes)) {
                const resizedBuffer = await sharp(originalBuffer)
                    .rotate() // Crucial: auto-rotates based on EXIF and removes EXIF
                    .resize({ width, withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toBuffer();

                const objectKey = `thumbnails/${userId}/${timestamp}_${sizeName}_${baseFileName}.webp`;
                const uploadedUrl = await uploadToB2(s3Client, resizedBuffer, bucketName, objectKey, 'image/webp');
                newThumbnailUrls[sizeName] = uploadedUrl;
            }

            // Update record
            await mediaCollection.updateOne(
                { _id: record._id },
                { 
                    $set: { 
                        thumbnailUrls: newThumbnailUrls,
                        updatedAt: new Date(),
                        thumbnail_rotation_healed: true // tracking flag
                    } 
                }
            );

            console.log(`[Heal Thumbnails] ✅ Successfully healed thumbnails for ${id}`);
            successCount++;
        } catch (err: any) {
            console.error(`[Heal Thumbnails] ❌ Failed processing ${id}:`, err);
            failCount++;
        }
    }

    return res.status(200).json({ 
        success: true, 
        message: `Processed ${ids.length} records`, 
        stats: { successCount, failCount } 
    });

  } catch (error: any) {
    console.error("[Heal Thumbnails] Fatal error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
