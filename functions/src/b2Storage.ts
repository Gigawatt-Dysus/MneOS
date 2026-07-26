import { onCall, HttpsError } from "firebase-functions/v2/https";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as crypto from "crypto";

const getS3Client = () => {
    return new S3Client({
        region: process.env.B2_REGION || "us-east-005",
        endpoint: process.env.B2_ENDPOINT ? 
            (process.env.B2_ENDPOINT.startsWith('http') ? process.env.B2_ENDPOINT : `https://${process.env.B2_ENDPOINT}`) : 
            "https://s3.us-east-005.backblazeb2.com",
        credentials: {
            accessKeyId: process.env.B2_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || "",
        },
    });
};

export const generateB2UploadUrl = onCall({ cors: true }, async (request) => {
    // Ensure the user is authenticated
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to generate upload URLs.");
    }

    const { fileName, fileType } = request.data;
    if (!fileName || !fileType) {
        throw new HttpsError("invalid-argument", "fileName and fileType are required.");
    }

    const bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";
    const userId = request.auth.uid.trim();
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
    
    // Generate a unique path: users/{userId}/uploads/{timestamp}-{random}-{safeName}
    const randomHash = crypto.randomBytes(4).toString('hex');
    const objectKey = `users/${userId}/uploads/${timestamp}-${randomHash}-${safeName}`;

    try {
        const client = getS3Client();
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            ContentType: fileType,
        });

        // The URL expires in 15 minutes
        const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

        // Construct the native Backblaze B2 public URL
        // Format: https://f005.backblazeb2.com/file/LifeOS-Media/objectKey
        const publicUrl = `https://f005.backblazeb2.com/file/${bucketName}/${objectKey}`;

        return {
            uploadUrl,
            publicUrl,
            objectKey
        };
    } catch (error: any) {
        console.error("Error generating B2 signed URL:", error);
        throw new HttpsError("internal", "Failed to generate secure upload URL.");
    }
});

// [ZEN PROXY] New function to bypass Browser CORS by uploading on the server
export const proxyUploadToB2 = onCall({ cors: true, memory: "512MiB" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "You must be logged in to upload.");
    }

    const { fileName, fileType, base64Data } = request.data;
    if (!fileName || !fileType || !base64Data) {
        throw new HttpsError("invalid-argument", "Missing required upload data.");
    }

    const bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";
    const userId = request.auth.uid.trim();
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.]/g, '_');
    const objectKey = `users/${userId}/uploads/${timestamp}-${safeName}`;

    try {
        const client = getS3Client();
        
        // Convert Base64 back to Buffer for the S3 SDK
        const buffer = Buffer.from(base64Data, 'base64');

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
            ContentType: fileType,
            Body: buffer
        });

        await client.send(command);

        const publicUrl = `https://f005.backblazeb2.com/file/${bucketName}/${objectKey}`;

        return {
            publicUrl,
            objectKey
        };
    } catch (error: any) {
        console.error("B2 Proxy Upload FAILED:", error);
        throw new HttpsError("internal", `Server-side B2 upload failed: ${error.message}`);
    }
});
