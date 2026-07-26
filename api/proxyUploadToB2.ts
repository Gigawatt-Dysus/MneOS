import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

// Manual fallback: Force read .env.local if Vercel Dev cloud sync suppresses local keys
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || '';
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                if (!process.env[key] || process.env[key] === '') {
                    process.env[key] = value;
                }
            }
        });
    }
} catch (e) {
    console.error("[proxyUploadToB2] Error parsing .env.local manually:", e);
}

const getS3Client = () => {
    // [ZEN FIX] Explicitly check for B2 credentials and fail fast to trigger base64 fallback properly
    const accessKeyId = process.env.B2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.B2_SECRET_ACCESS_KEY;
    
    console.log("[DEBUG] Env dump for B2:");
    console.log("B2_ACCESS_KEY_ID exists:", !!accessKeyId, "Length:", accessKeyId?.length);
    console.log("B2_SECRET_ACCESS_KEY exists:", !!secretAccessKey);
    console.log("All env keys:", Object.keys(process.env).filter(k => k.startsWith('B2_') || k.startsWith('VITE_')));

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("Missing Backblaze B2 credentials in Vercel environment (B2_ACCESS_KEY_ID or B2_SECRET_ACCESS_KEY). Base64 fallback will be invoked.");
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { fileName, fileType, base64Data } = req.body;
    if (!fileName || !fileType || !base64Data) {
        return res.status(400).json({ error: "Missing required upload data." });
    }

    const bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
    
    // We can infer userId or let the client pass it, or default to custom uploads folder.
    // For sovereign uploads, let's keep the standard structure: uploads/{timestamp}-{safeName}
    const objectKey = `uploads/${timestamp}-${safeName}`;

    const client = getS3Client();
    const buffer = Buffer.from(base64Data, 'base64');

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: fileType,
        Body: buffer
    });

    await client.send(command);
    const publicUrl = `https://media.gigiwatt.com/file/${bucketName}/${objectKey}`;

    return res.status(200).json({ 
      success: true, 
      data: {
        publicUrl,
        objectKey
      }
    });

  } catch (error: any) {
    console.error("[proxyUploadToB2] failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
