import { onCall, HttpsError } from 'firebase-functions/v2/https';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getMongoClient } from './index';

export const forceRebakeOrientation = onCall({ cors: true, timeoutSeconds: 300, memory: "1GiB" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Sovereign access required.');
    }

    const { mediaId, forceAngle } = request.data;
    if (!mediaId) {
        throw new HttpsError('invalid-argument', 'mediaId is required.');
    }

    try {
        const client = await getMongoClient();
        const db = client.db('LifeOS');
        
        let col = 'media';
        let record = await db.collection(col).findOne({ _id: mediaId });
        if (!record) {
            col = 'pending_accessions';
            record = await db.collection(col).findOne({ _id: mediaId });
        }
        
        if (!record) {
            throw new HttpsError('not-found', 'Media record not found.');
        }

        const b2Url = record.url.replace('media.gigiwatt.com', 'f005.backblazeb2.com');
        const res = await fetch(b2Url);
        if (!res.ok) {
            throw new HttpsError('internal', 'Failed to fetch source from B2');
        }
        const originalBuffer = Buffer.from(await res.arrayBuffer());

        let finalBuffer;
        if (forceAngle === 'auto') {
            finalBuffer = await sharp(originalBuffer, { failOn: 'none' }).rotate().toBuffer();
        } else if (typeof forceAngle === 'number') {
            finalBuffer = await sharp(originalBuffer, { failOn: 'none' }).rotate(forceAngle).toBuffer();
        } else {
            throw new HttpsError('invalid-argument', 'forceAngle must be "auto" or a number.');
        }

        const rotatedSharp = sharp(finalBuffer);
        const finalMeta = await rotatedSharp.metadata();
        const finalWidth = finalMeta.width;
        const finalHeight = finalMeta.height;

        const s3Client = new S3Client({
            endpoint: process.env.B2_ENDPOINT!,
            region: process.env.B2_REGION!,
            credentials: {
                accessKeyId: process.env.B2_ACCESS_KEY_ID!,
                secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!
            }
        });

        const thumbSizes = { small: 400, medium: 800, large: 1600 };
        const ts = Date.now();
        const updateObj: any = {
            width: finalWidth,
            height: finalHeight
        };

        for (const [sName, width] of Object.entries(thumbSizes)) {
            if (!record.thumbnailUrls || !record.thumbnailUrls[sName]) continue;
            
            const resizedBuffer = await rotatedSharp.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
            const objKey = record.thumbnailUrls[sName].split('?')[0].split('/file/LifeOS-Media/')[1];
            
            await s3Client.send(new PutObjectCommand({
                Bucket: 'LifeOS-Media',
                Key: objKey,
                Body: resizedBuffer,
                ContentType: 'image/webp'
            }));
            
            updateObj[`thumbnailUrls.${sName}`] = record.thumbnailUrls[sName].split('?')[0] + '?v=' + ts;
        }

        await db.collection(col).updateOne({ _id: record._id }, { $set: updateObj });

        return { 
            success: true, 
            mediaId,
            width: finalWidth,
            height: finalHeight,
            message: 'Pattern buffer resequenced and materialized.' 
        };

    } catch (e: any) {
        console.error('[forceRebakeOrientation] Error:', e);
        throw new HttpsError('internal', e.message);
    }
});
