import { MongoClient } from 'mongodb';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// --- CONFIGURATION ---
const CLIENT_ID = '459534779564-bp6l3b1cncl53cbh5eu7m6q0ng96bsmh.apps.googleusercontent.com';
const CLIENT_SECRET = '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';

const uri = process.env.MONGODB_URI || '';
const mongoClient = new MongoClient(uri, {
  family: 4,
  maxPoolSize: 5,
  serverSelectionTimeoutMS: 5000
});

let dbInstance: any = null;
async function getDatabase() {
  if (!dbInstance) {
    await mongoClient.connect();
    dbInstance = mongoClient.db('LifeOS');
  }
  return dbInstance;
}

const getS3Client = () => {
    let endpoint = process.env.B2_ENDPOINT || "s3.us-east-005.backblazeb2.com";
    if (!endpoint.startsWith('http')) {
        endpoint = `https://${endpoint}`;
    }

    return new S3Client({
        region: process.env.B2_REGION || "us-east-005",
        endpoint: endpoint,
        credentials: {
            accessKeyId: process.env.B2_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || "",
        },
    });
};

async function getFreshAccessToken(mongoDb: any, uid: string): Promise<string> {
  let doc = await mongoDb.collection("secrets").findOne({ _id: `${uid}_googlePhotos` as any });
  if (!doc) {
    doc = await mongoDb.collection("secrets").findOne({ _id: `${uid}_google_photos` as any });
  }
  
  if (!doc || !doc.refreshToken) {
    throw new Error("AUTH_REQUIRED: No refreshToken found in googlePhotos or google_photos secrets in MongoDB");
  }

  const refreshToken = doc.refreshToken;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    
    if (!response.ok) {
        throw new Error(`Token Refresh Failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (e: any) {
    console.error(`[GoogleAuth] Token Refresh Failed for user ${uid}:`, e.message);
    throw e;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { userId, sessionId, jobId } = req.body;
  if (!userId || !sessionId || !jobId) {
    return res.status(400).json({ error: "userId, sessionId, and jobId are required." });
  }

  const mongoDb = await getDatabase();
  const jobKey = `${userId}_${jobId}`;
  
  try {
    const accessToken = await getFreshAccessToken(mongoDb, userId);
    const manifestUrl = `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}&pageSize=100`;
    
    const manifestRes = await fetch(manifestUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!manifestRes.ok) {
        throw new Error(`Failed to fetch manifest: ${manifestRes.statusText}`);
    }

    const manifestData = await manifestRes.json();
    const items = manifestData.mediaItems || [];
    
    await mongoDb.collection("import_jobs").updateOne(
      { _id: jobKey as any },
      { $set: { totalItems: items.length, status: 'processing', updatedAt: new Date() } },
      { upsert: true }
    );

    if (items.length === 0) {
      await mongoDb.collection("import_jobs").updateOne(
        { _id: jobKey as any },
        { $set: { status: 'completed', updatedAt: new Date() } }
      );
      return res.status(200).json({ success: true, processed: 0 });
    }

    let processed = 0;
    const s3Client = getS3Client();
    const bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";

    for (const item of items) {
      try {
        const fileData = item.mediaFile;
        if (!fileData || !fileData.baseUrl) continue;

        const fileName = fileData.filename || `google-${Date.now()}.jpg`;
        const mimeType = fileData.mimeType || 'application/octet-stream';
        const creationTime = item.mediaMetadata?.creationTime || item.createTime || new Date().toISOString();
        
        const downloadUrlGoogle = mimeType.includes('video') ? `${fileData.baseUrl}=dv` : `${fileData.baseUrl}=d`;
        
        const fetchRes = await fetch(downloadUrlGoogle, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (!fetchRes.ok) throw new Error(`Download failed: ${fetchRes.statusText}`);

        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
        
        const safeUid = userId.replace(/\s+/g, '');
        const safeFileName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
        const objectKey = `users/${safeUid}/uploads/${Date.now()}-${contentHash.substring(0,8)}-${safeFileName}`;
        
        // Upload to B2
        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            Body: buffer,
            ContentType: mimeType,
        }));
        
        const publicUrl = `https://media.gigiwatt.com/file/${bucketName}/${objectKey}`;

        const duplicateDoc = await mongoDb.collection('media').findOne({ userId, contentHash });
        const isDuplicate = !!duplicateDoc;
        const duplicateOf = duplicateDoc ? (duplicateDoc.docId || duplicateDoc._id) : null;

        const docId = `acc_google_${Date.now()}_${contentHash.substring(0, 8)}`;

        await mongoDb.collection('pending_accessions').insertOne({
          _id: `${userId}_${docId}` as any,
          userId: userId,
          docId,
          sourceId: item.id,
          mediaUrl: publicUrl,
          objectKey,
          logicalDate: new Date(creationTime),
          status: 'pending',
          source: 'google-photos-sideload',
          title: fileName,
          description: '',
          tagIds: [],
          fileType: mimeType,
          contentHash,
          isDuplicate,
          duplicateOf,
          triage: {
            title: fileName,
            contentHash,
            width: parseInt(item.mediaMetadata?.width || '0', 10),
            height: parseInt(item.mediaMetadata?.height || '0', 10)
          },
          createdAt: new Date()
        });

        processed++;
        await mongoDb.collection("import_jobs").updateOne(
          { _id: jobKey as any },
          { $set: { processedItems: processed, updatedAt: new Date() } }
        );

      } catch (itemErr: any) {
        console.error(`[IngestPhotos] Failed item ${item.id}:`, itemErr.message);
      }
    }

    await mongoDb.collection("import_jobs").updateOne(
      { _id: jobKey as any },
      { $set: { status: 'completed', updatedAt: new Date() } }
    );
    
    return res.status(200).json({ success: true, processed });

  } catch (err: any) {
    console.error(`[IngestPhotos] Fatal error:`, err.message);
    await mongoDb.collection("import_jobs").updateOne(
      { _id: jobKey as any },
      { $set: { status: 'failed', error: err.message, updatedAt: new Date() } },
      { upsert: true }
    );
    return res.status(500).json({ error: err.message });
  }
}
