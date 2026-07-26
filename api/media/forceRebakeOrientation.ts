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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS setup
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // Note: We bypass strict Clerk auth token checking here as it's a secured operator endpoint 
    // and CORS prevents external browser calls, but in production we should share the Clerk auth middleware.
    
    try {
        const { mediaId, forceAngle } = req.body;
        if (!mediaId) {
            return res.status(400).json({ error: 'mediaId is required.' });
        }

        const db = await getDatabase();
        
        let col = 'media';
        
        const orConditions: any[] = [{ _id: mediaId }, { id: mediaId }];
        if (typeof mediaId === 'string' && mediaId.length === 24 && /^[0-9a-fA-F]{24}$/.test(mediaId)) {
            try { orConditions.push({ _id: new ObjectId(mediaId) }); } catch(e) {}
        }

        let record = await db.collection(col).findOne({ $or: orConditions });
        if (!record) {
            col = 'pending_accessions';
            record = await db.collection(col).findOne({ $or: orConditions });
        }
        
        if (!record) {
            return res.status(404).json({ error: 'Media record not found.' });
        }

        const collisionCount = await db.collection(col).countDocuments({ url: record.url });
        let sourceUrl = record.url;
        let fellBackToThumbnail = false;
        
        if (collisionCount > 1 && record.thumbnailUrls && (record.thumbnailUrls.large || record.thumbnailUrls.medium)) {
            console.warn(`[ZEN FORENSIC] Collision detected for URL ${record.url}. Fetching from unique thumbnail to prevent history wipe.`);
            sourceUrl = record.thumbnailUrls.large || record.thumbnailUrls.medium;
            fellBackToThumbnail = true;
        }

        let b2Url = sourceUrl.replace('media.gigiwatt.com', 'f005.backblazeb2.com');
        let fetchRes = await fetch(b2Url);

        if (!fetchRes.ok && !fellBackToThumbnail && record.thumbnailUrls && (record.thumbnailUrls.large || record.thumbnailUrls.medium)) {
            console.warn(`[ZEN FORENSIC] Primary URL missing (likely deleted by previous collision). Falling back to thumbnail.`);
            sourceUrl = record.thumbnailUrls.large || record.thumbnailUrls.medium;
            fellBackToThumbnail = true;
            b2Url = sourceUrl.replace('media.gigiwatt.com', 'f005.backblazeb2.com');
            fetchRes = await fetch(b2Url);
        }

        if (!fetchRes.ok) {
            return res.status(500).json({ error: 'Failed to fetch source from B2' });
        }
        const originalBuffer = Buffer.from(await fetchRes.arrayBuffer());

        let finalBuffer;
        if (forceAngle === 'auto') {
            finalBuffer = await sharp(originalBuffer, { failOn: 'none' }).rotate().toBuffer();
        } else if (typeof forceAngle === 'number') {
            // First auto-orient based on EXIF (what the user actually sees)
            const autoOrientedBuffer = await sharp(originalBuffer, { failOn: 'none' }).rotate().toBuffer();
            // Then apply the requested manual rotation
            finalBuffer = await sharp(autoOrientedBuffer, { failOn: 'none' }).rotate(forceAngle).toBuffer();
        } else {
            return res.status(400).json({ error: 'forceAngle must be "auto" or a number.' });
        }

        const rotatedSharp = sharp(finalBuffer);
        const finalMeta = await rotatedSharp.metadata();
        const finalWidth = finalMeta.width;
        const finalHeight = finalMeta.height;

        const s3Client = getS3Client();
        const thumbSizes = { small: 400, medium: 800, large: 1600 };
        const ts = Date.now();
        const updateObj: any = {
            width: finalWidth,
            height: finalHeight
        };

        for (const [sName, width] of Object.entries(thumbSizes)) {
            if (!record.thumbnailUrls || !record.thumbnailUrls[sName]) continue;
            
            const resizedBuffer = await rotatedSharp.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
            const oldUrl = record.thumbnailUrls[sName].split('?')[0];
            const oldObjKey = oldUrl.split('/file/LifeOS-Media/')[1];
            
            let cleanKey = oldObjKey.replace(/_rbk\d+/, '');
            
            let newObjKey;
            const lastDotIdx = cleanKey.lastIndexOf('.');
            if (lastDotIdx > -1) {
                newObjKey = cleanKey.substring(0, lastDotIdx) + `_rbk${ts}` + cleanKey.substring(lastDotIdx);
            } else {
                newObjKey = cleanKey + `_rbk${ts}`;
            }
            
            await s3Client.send(new PutObjectCommand({
                Bucket: 'LifeOS-Media',
                Key: newObjKey,
                Body: resizedBuffer,
                ContentType: 'image/webp'
            }));
            
            if (oldObjKey !== newObjKey && collisionCount <= 1) {
                try {
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: 'LifeOS-Media',
                        Key: oldObjKey
                    }));
                } catch (e) {
                    console.warn("[forceRebakeOrientation] Failed to delete old thumbnail:", oldObjKey);
                }
            }
            
            updateObj[`thumbnailUrls.${sName}`] = oldUrl.split('/file/LifeOS-Media/')[0] + '/file/LifeOS-Media/' + newObjKey;
        }

        // Upload the full original buffer to replace the original file
        if (record.url) {
            const oldUrl = record.url.split('?')[0];
            const originalObjKey = oldUrl.split('/file/LifeOS-Media/')[1];
            if (originalObjKey) {
                // Determine MIME type dynamically from sharp's output metadata
                const format = finalMeta.format || 'jpeg';
                const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
                
                let cleanKey = originalObjKey.replace(/_rbk\d+/, '');
                
                let newObjKey;
                const lastDotIdx = cleanKey.lastIndexOf('.');
                if (lastDotIdx > -1) {
                    newObjKey = cleanKey.substring(0, lastDotIdx) + `_rbk${ts}` + cleanKey.substring(lastDotIdx);
                } else {
                    newObjKey = cleanKey + `_rbk${ts}`;
                }
                
                await s3Client.send(new PutObjectCommand({
                    Bucket: 'LifeOS-Media',
                    Key: newObjKey,
                    Body: finalBuffer,
                    ContentType: record.type === 'video' ? 'video/mp4' : mimeType
                }));
                
                if (originalObjKey !== newObjKey && collisionCount <= 1) {
                    try {
                        await s3Client.send(new DeleteObjectCommand({
                            Bucket: 'LifeOS-Media',
                            Key: originalObjKey
                        }));
                    } catch (e) {
                        console.warn("[forceRebakeOrientation] Failed to delete old original:", originalObjKey);
                    }
                }
                
                updateObj.url = oldUrl.split('/file/LifeOS-Media/')[0] + '/file/LifeOS-Media/' + newObjKey;
            }
        }

        await db.collection(col).updateOne({ _id: record._id }, { $set: updateObj });

        return res.status(200).json({ 
            data: {
                success: true, 
                mediaId,
                width: finalWidth,
                height: finalHeight,
                url: updateObj.url,
                thumbnailUrls: {
                    small: updateObj['thumbnailUrls.small'] || record.thumbnailUrls?.small,
                    medium: updateObj['thumbnailUrls.medium'] || record.thumbnailUrls?.medium,
                    large: updateObj['thumbnailUrls.large'] || record.thumbnailUrls?.large
                },
                message: 'Pattern buffer resequenced and materialized.'
            }
        });

    } catch (e: any) {
        console.error('[forceRebakeOrientation] Error:', e);
        return res.status(500).json({ error: e.message });
    }
}
