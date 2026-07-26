import { MongoClient } from 'mongodb';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const uri = process.env.MONGODB_URI || '';
const client = new MongoClient(uri, {
  family: 4,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000
});

let dbInstance: any = null;

async function getDatabase() {
  if (!dbInstance) {
    await client.connect();
    dbInstance = client.db('LifeOS');
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

const sha256 = (text: string) => crypto.createHash('sha256').update(text).digest('hex');

async function extractAndUploadAssets(content: string, s3Client: S3Client, bucketName: string): Promise<string> {
  if (!content) return content;
  let updatedContent = content;

  // 1. Check for standard MIME-like header blocks with base64
  const mimeRegex = /(?:Content-Type:\s*image\/(jpeg|jpg|png|gif)[^\r\n]*)?[\r\n]*Content-Transfer-Encoding:\s*base64[^\r\n]*[\r\n]+([A-Za-z0-9+/=\s\r\n]{100,})/gi;
  let match;
  const mimeMatches: { fullMatch: string; ext: string; base64Str: string }[] = [];

  while ((match = mimeRegex.exec(content)) !== null) {
    mimeMatches.push({
      fullMatch: match[0],
      ext: match[1] || 'jpg',
      base64Str: match[2].replace(/\s/g, '')
    });
  }

  for (const item of mimeMatches) {
    try {
      const buffer = Buffer.from(item.base64Str, 'base64');
      const timestamp = Date.now();
      const objectKey = `purified_assets/media_${timestamp}.${item.ext}`;

      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: `image/${item.ext}`,
        Body: buffer
      }));

      const b2Url = `https://media.gigiwatt.com/file/${bucketName}/${objectKey}`;
      const markdownReplacement = `![Purified Media Asset](${b2Url})`;
      updatedContent = updatedContent.replace(item.fullMatch, markdownReplacement);
    } catch (err) {
      console.error("[extractAndUploadAssets] MIME block upload failed:", err);
    }
  }

  // 2. Check for standard data URIs (e.g. data:image/png;base64,...)
  const dataUriRegex = /data:image\/(jpeg|jpg|png|gif);base64,([A-Za-z0-9+/=\s\r\n]{100,})/gi;
  const dataUriMatches: { fullMatch: string; ext: string; base64Str: string }[] = [];

  while ((match = dataUriRegex.exec(content)) !== null) {
    dataUriMatches.push({
      fullMatch: match[0],
      ext: match[1],
      base64Str: match[2].replace(/\s/g, '')
    });
  }

  for (const item of dataUriMatches) {
    try {
      const buffer = Buffer.from(item.base64Str, 'base64');
      const timestamp = Date.now();
      const objectKey = `purified_assets/media_${timestamp}.${item.ext}`;

      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: `image/${item.ext}`,
        Body: buffer
      }));

      const b2Url = `https://media.gigiwatt.com/file/${bucketName}/${objectKey}`;
      const markdownReplacement = `![Purified Media Asset](${b2Url})`;
      updatedContent = updatedContent.replace(item.fullMatch, markdownReplacement);
    } catch (err) {
      console.error("[extractAndUploadAssets] DataURI upload failed:", err);
    }
  }

  return updatedContent;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { userId, stagedRecords, targetCollection = 'chat_segments' } = req.body;
    if (!userId || !Array.isArray(stagedRecords)) {
      return res.status(400).json({ error: 'userId and stagedRecords array are required.' });
    }

    const validCollections = ['chat_segments', 'events', 'tags'];
    if (!validCollections.includes(targetCollection)) {
      return res.status(400).json({ error: 'Invalid targetCollection scope.' });
    }

    const db = await getDatabase();
    const activeCollection = db.collection(targetCollection);
    const ledgerCollection = db.collection('ledger');

    // 1. Pre-Flight Snapshot (Macro SSOT Collection Cloning)
    try {
      const backupName = `${targetCollection}_backup_20260524`;
      // Check if backup collection exists to avoid failing, or drop first if exists
      await db.collection(backupName).drop().catch(() => {});
      await activeCollection.aggregate([
        { $out: backupName }
      ]).toArray();
    } catch (cloneErr: any) {
      console.error("[commitPurifiedSchema] pre-flight backup failed:", cloneErr);
      return res.status(500).json({ success: false, error: `Pre-Flight Snapshot Failed: ${cloneErr.message}` });
    }

    const prunes = stagedRecords.filter((r: any) => r.action === 'prune');
    const saves = stagedRecords.filter((r: any) => r.action === 'save');

    // 2. Process Deletions & Append-only Cryptographic Ledger entries
    if (prunes.length > 0) {
      const pruneIds = prunes.map((r: any) => r._id);
      const docsToPrune = await activeCollection.find({ _id: { $in: pruneIds } }).toArray();

      const ledgerEntries = docsToPrune.map((doc: any) => {
        let contentStr = '';
        if (targetCollection === 'chat_segments') {
          contentStr = doc.content || '';
        } else if (targetCollection === 'events') {
          contentStr = doc.details || doc.description || '';
        } else if (targetCollection === 'tags') {
          contentStr = doc.description || doc.privateNotes || '';
        }

        return {
          _id: `ledger_${crypto.randomUUID()}`,
          originalId: doc._id,
          checksum: sha256(contentStr),
          deletedAt: new Date(),
          operator: "Eric Carl Douglas Cornett",
          backupText: contentStr.substring(0, 500),
          originalDoc: doc
        };
      });

      if (ledgerEntries.length > 0) {
        await ledgerCollection.insertMany(ledgerEntries);
      }

      await activeCollection.deleteMany({ _id: { $in: pruneIds } });
    }

    // 3. Process Normalizations (saves)
    if (saves.length > 0) {
      const s3Client = getS3Client();
      const bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";

      for (const record of saves) {
        const originalDoc = await activeCollection.findOne({ _id: record._id });
        if (!originalDoc) continue;

        const cleanDoc = { ...originalDoc };

        if (targetCollection === 'chat_segments') {
          // Extract base64 assets and upload to Backblaze B2
          if (cleanDoc.content) {
            cleanDoc.content = await extractAndUploadAssets(cleanDoc.content, s3Client, bucketName);
          }

          // Drop legacy attributes
          delete cleanDoc.fiction;
          delete cleanDoc.author;
          if (cleanDoc.search_metadata) {
            delete cleanDoc.search_metadata.is_fiction;
          }

          // Explicitly stamp unified root properties
          cleanDoc.companionId = record.companionId === 'System/None' ? null : record.companionId;
          cleanDoc.is_fiction = record.is_fiction;
          cleanDoc.updatedAt = new Date();
        } 
        else if (targetCollection === 'events') {
          if (cleanDoc.details) {
            cleanDoc.details = await extractAndUploadAssets(cleanDoc.details, s3Client, bucketName);
          }
          if (cleanDoc.description) {
            cleanDoc.description = await extractAndUploadAssets(cleanDoc.description, s3Client, bucketName);
          }

          cleanDoc.title = record.title !== undefined ? record.title : cleanDoc.title;
          cleanDoc.details = record.details !== undefined ? record.details : cleanDoc.details;
          cleanDoc.description = record.description !== undefined ? record.description : cleanDoc.description;
          cleanDoc.is_fiction = record.is_fiction !== undefined ? record.is_fiction : cleanDoc.is_fiction;
          
          if (record.location !== undefined) {
            cleanDoc.location = record.location;
          }
          if (record.tagIds !== undefined) {
            cleanDoc.tagIds = record.tagIds;
          }
          
          cleanDoc.updatedAt = new Date();
        } 
        else if (targetCollection === 'tags') {
          if (cleanDoc.description) {
            cleanDoc.description = await extractAndUploadAssets(cleanDoc.description, s3Client, bucketName);
          }
          if (cleanDoc.privateNotes) {
            cleanDoc.privateNotes = await extractAndUploadAssets(cleanDoc.privateNotes, s3Client, bucketName);
          }

          cleanDoc.name = record.name !== undefined ? record.name : cleanDoc.name;
          cleanDoc.description = record.description !== undefined ? record.description : cleanDoc.description;
          cleanDoc.privateNotes = record.privateNotes !== undefined ? record.privateNotes : cleanDoc.privateNotes;
          cleanDoc.isFiction = record.is_fiction !== undefined ? record.is_fiction : cleanDoc.isFiction;

          cleanDoc.updatedAt = new Date();
        }

        await activeCollection.replaceOne({ _id: record._id }, cleanDoc);
      }
    }

    return res.status(200).json({ success: true, prunesCount: prunes.length, savesCount: saves.length });
  } catch (error: any) {
    console.error("[commitPurifiedSchema] failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
