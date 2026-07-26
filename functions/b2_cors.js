const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');


const client = new S3Client({
    region: process.env.B2_REGION || "us-east-005",
    endpoint: `https://${process.env.B2_ENDPOINT || "s3.us-east-005.backblazeb2.com"}`,
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID || "0055db00fff7f080000000001",
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY || "K005E7JF0eHwRQlKUVP+bN+esrLy6sI",
    },
});

const bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";

const corsRules = {
    CORSRules: [
        {
            AllowedHeaders: ["*"],
            AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
            AllowedOrigins: ["*"],
            ExposeHeaders: ["ETag", "Content-Length", "x-amz-server-side-encryption"],
            MaxAgeSeconds: 3000
        }
    ]
};

async function setupCORS() {
    console.log(`Setting CORS policy for bucket: ${bucketName}...`);
    try {
        const command = new PutBucketCorsCommand({
            Bucket: bucketName,
            CORSConfiguration: corsRules
        });
        await client.send(command);
        console.log("✅ CORS policy successfully applied to Backblaze B2 Bucket!");
    } catch (err) {
        console.error("❌ Failed to set CORS policy:", err);
    }
}

setupCORS();
