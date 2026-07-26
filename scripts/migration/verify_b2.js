import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const B2_ENDPOINT = 'https://s3.us-east-005.backblazeb2.com';
const B2_REGION = process.env.B2_REGION || 'us-east-005';
const B2_BUCKET = process.env.B2_BUCKET_NAME || process.env.B2_BUCKET;
const PREFIXES_TO_SCAN = ['LIFEBOAT_RAW_DUMP/', 'users/migration/takeout/'];

const s3Client = new S3Client({
    endpoint: B2_ENDPOINT,
    region: B2_REGION,
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    },
});

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function verifyB2() {
    console.log("=======================================================");
    console.log(`🔍 VERIFYING B2 STORAGE METRICS FOR: ${B2_BUCKET}`);
    console.log(`📁 Target Paths: ${PREFIXES_TO_SCAN.join(', ')}`);
    console.log("=======================================================\n");
    console.log("Connecting to Backblaze B2 and aggregating file sizes. This may take ~60 seconds...\n");

    let totalFiles = 0;
    let totalBytes = 0;
    let apiCalls = 0;

    const startTime = Date.now();

    for (const prefix of PREFIXES_TO_SCAN) {
        let continuationToken = undefined;
        let isTruncated = true;
        
        console.log(`\n▶ Scanning prefix: ${prefix}`);

        while (isTruncated) {
            const listParams = {
                Bucket: B2_BUCKET,
                Prefix: prefix,
                ContinuationToken: continuationToken,
                MaxKeys: 1000
            };

            const res = await s3Client.send(new ListObjectsV2Command(listParams));
            apiCalls++;

            if (res.Contents) {
                for (const obj of res.Contents) {
                    totalFiles++;
                    totalBytes += obj.Size;
                }
            }

            isTruncated = res.IsTruncated;
            continuationToken = res.NextContinuationToken;

            if (apiCalls % 25 === 0) {
                process.stdout.write(`\r[Scanning...] Pages Fetched: ${apiCalls} | Files Counted: ${totalFiles} | Data Found: ${formatBytes(totalBytes)}`);
            }
        }
        console.log(`\n✔ Finished scanning: ${prefix}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n=======================================================`);
    console.log(`✅ VERIFICATION COMPLETE (Took ${elapsed}s)`);
    console.log(`=======================================================`);
    console.log(`📊 TOTAL FILES IN B2:     ${totalFiles.toLocaleString()}`);
    console.log(`💾 TOTAL DATA IN B2:      ${formatBytes(totalBytes)}`);
    console.log(`=======================================================\n`);
    
    console.log("If these numbers match the final dump metrics, it is SAFE to retire the F: drive.");
}

verifyB2().catch(console.error);
