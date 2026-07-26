const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function uploadToB2() {
    const s3Client = new S3Client({
        endpoint: process.env.B2_ENDPOINT,
        region: process.env.B2_REGION || 'us-east-005',
        credentials: {
            accessKeyId: process.env.B2_ACCESS_KEY_ID,
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY
        }
    });

    const B2_BUCKET = process.env.B2_BUCKET_NAME || 'LifeOS-Media';
    const apkPath = 'C:\\brita-build-zone\\android\\app\\build\\outputs\\apk\\release\\app-release.apk';
    const fileName = `brita-release-v7-${Date.now()}.apk`;

    try {
        console.log(`[B2 Uplink] Uploading ${apkPath} to bucket ${B2_BUCKET} as ${fileName}...`);
        
        const fileStream = fs.createReadStream(apkPath);
        
        await s3Client.send(new PutObjectCommand({
            Bucket: B2_BUCKET,
            Key: fileName,
            Body: fileStream,
            ContentType: 'application/vnd.android.package-archive'
        }));
        
        // Construct the public URL. Assuming standard B2 URL format.
        // B2_ENDPOINT usually looks like https://s3.us-east-005.backblazeb2.com
        const publicUrl = `${process.env.B2_ENDPOINT}/${B2_BUCKET}/${fileName}`.replace('s3.', 'f005.'); // Backblaze friendly public URL formatting if needed, but we can just use the standard endpoint or f005.
        
        // Actually, the most reliable public URL format for B2 if the bucket is public is:
        const endpointUrl = new URL(process.env.B2_ENDPOINT);
        const hostParts = endpointUrl.hostname.split('.');
        if (hostParts[0] === 's3') hostParts[0] = 'f005'; // Hacky mapping, better to just use f005.backblazeb2.com
        const f005Url = `https://f005.backblazeb2.com/file/${B2_BUCKET}/${fileName}`;

        console.log(`[B2 Uplink] Upload Successful!`);
        console.log(`[DOWNLOAD URL] ${f005Url}`);
        
    } catch (err) {
        console.error('[B2 Uplink] Upload Failed:', err);
    }
}

uploadToB2();
