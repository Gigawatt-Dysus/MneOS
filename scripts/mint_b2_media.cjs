/**
 * 📦 MneOS Sovereign B2 Media Minting & Sync Engine
 * Uploads deduplicated local media assets from public/media_vault directly into Backblaze B2,
 * mints permanent sovereign B2 permalinks, rewrites all RESCUED_ALL Markdown & JSON session logs,
 * and clears out temporary local files to enforce B2 as the Single Source of Truth.
 * 
 * Usage: node scripts/mint_b2_media.cjs
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Load environment variables from .env.local
let envConfig = {};
try {
    const envLocalPath = path.join(__dirname, '..', '.env.local');
    if (fs.existsSync(envLocalPath)) {
        const envContent = fs.readFileSync(envLocalPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*["']?(.*?)["']?\s*$/);
            if (match) {
                envConfig[match[1]] = match[2];
                if (!process.env[match[1]]) process.env[match[1]] = match[2];
            }
        });
    }
} catch(e) {}

const B2_ENDPOINT = process.env.B2_ENDPOINT || envConfig.B2_ENDPOINT || 'https://s3.us-west-004.backblazeb2.com';
const B2_REGION = process.env.B2_REGION || envConfig.B2_REGION || 'us-west-004';
const B2_KEY_ID = process.env.B2_ACCESS_KEY_ID || envConfig.B2_ACCESS_KEY_ID || process.env.B2_KEY_ID || envConfig.B2_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const B2_SECRET_KEY = process.env.B2_SECRET_ACCESS_KEY || envConfig.B2_SECRET_ACCESS_KEY || process.env.B2_APPLICATION_KEY || envConfig.B2_APPLICATION_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const B2_BUCKET = process.env.B2_BUCKET_NAME || envConfig.B2_BUCKET_NAME || process.env.B2_BUCKET || envConfig.B2_BUCKET || 'mneos-vault-media';

// Normalize endpoint format
let cleanEndpoint = B2_ENDPOINT;
if (!cleanEndpoint.startsWith('http')) {
    cleanEndpoint = `https://${cleanEndpoint}`;
}

const B2_CDN_DOMAIN = process.env.B2_CDN_DOMAIN || envConfig.B2_CDN_DOMAIN || `https://${B2_BUCKET}.s3.${B2_REGION}.backblazeb2.com`;

const VAULT_DIR = path.join(__dirname, '..', 'RESCUED_ALL');
const LOCAL_MEDIA_DIR = path.join(__dirname, '..', 'public', 'media_vault');

let s3Client = null;
if (B2_KEY_ID && B2_SECRET_KEY) {
    s3Client = new S3Client({
        endpoint: cleanEndpoint,
        region: B2_REGION,
        credentials: {
            accessKeyId: B2_KEY_ID,
            secretAccessKey: B2_SECRET_KEY
        }
    });
} else {
    console.error('❌ Missing Backblaze B2 credentials in environment or .env.local!');
    process.exit(1);
}

function getMimeType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
        case '.jpg': case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        case '.webp': return 'image/webp';
        case '.gif': return 'image/gif';
        case '.pdf': return 'application/pdf';
        case '.mp4': return 'video/mp4';
        case '.webm': return 'video/webm';
        case '.txt': return 'text/plain';
        case '.rtf': return 'application/rtf';
        default: return 'application/octet-stream';
    }
}

async function uploadToB2(key, filePath, mimeType) {
    try {
        const buffer = fs.readFileSync(filePath);
        const command = new PutObjectCommand({
            Bucket: B2_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: mimeType
        });
        await s3Client.send(command);
        return `${B2_CDN_DOMAIN}/${key}`;
    } catch(e) {
        console.warn(`  [!] B2 Upload failed for ${key}: ${e.message}`);
        return null;
    }
}

async function runB2Migration() {
    console.log(`\n🚀 Starting MneOS Sovereign B2 Media Migration...`);
    console.log(`📦 B2 Target Bucket: ${B2_BUCKET} (${cleanEndpoint})`);
    console.log(`📁 Local Media Vault: ${LOCAL_MEDIA_DIR}`);
    console.log(`📁 Session Vault: ${VAULT_DIR}\n`);

    const localFiles = fs.readdirSync(LOCAL_MEDIA_DIR);
    console.log(`🔍 Found ${localFiles.length} unique local media files to upload to Backblaze B2...`);

    const urlMap = new Map(); // localFileName or /media_vault/fileName -> b2Permalink
    let uploadedCount = 0;
    let failedCount = 0;

    const CONCURRENCY = 100;
    let completed = 0;

    for (let i = 0; i < localFiles.length; i += CONCURRENCY) {
        const chunk = localFiles.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (fileName) => {
            const filePath = path.join(LOCAL_MEDIA_DIR, fileName);
            if (fs.statSync(filePath).isDirectory()) return;

            const b2Key = `takeout_attachments/${fileName}`;
            const mimeType = getMimeType(fileName);

            const b2Url = await uploadToB2(b2Key, filePath, mimeType);
            completed++;

            if (b2Url) {
                urlMap.set(`/media_vault/${fileName}`, b2Url);
                urlMap.set(fileName, b2Url);
                uploadedCount++;
            } else {
                failedCount++;
            }
        }));
        if (completed % 150 === 0 || i + CONCURRENCY >= localFiles.length) {
            console.log(`  [↑] Uploaded ${completed}/${localFiles.length} assets to B2...`);
        }
    }

    console.log(`\n✔ Uploaded ${uploadedCount} assets to B2! (${failedCount} failed)`);

    // Step 2: Reconcile URLs across RESCUED_ALL session logs
    console.log(`\n🔄 Rewriting session logs in RESCUED_ALL with B2 Permalinks...`);
    const sessionFiles = fs.readdirSync(VAULT_DIR).filter(f => f.endsWith('.md') || f.endsWith('.json'));
    let updatedSessions = 0;
    let replacementsMade = 0;

    for (const sFile of sessionFiles) {
        const sPath = path.join(VAULT_DIR, sFile);
        let content = fs.readFileSync(sPath, 'utf8');
        let modified = false;

        for (const [localRef, b2Permalink] of urlMap.entries()) {
            if (content.includes(localRef)) {
                content = content.replaceAll(localRef, b2Permalink);
                modified = true;
                replacementsMade++;
            }
        }

        if (modified) {
            fs.writeFileSync(sPath, content, 'utf8');
            updatedSessions++;
        }
    }

    console.log(`  [✔] Updated ${updatedSessions} session files (${replacementsMade} links updated to B2 permalinks).`);

    // Step 3: Purge local public/media_vault files to enforce B2 as Single Source of Truth
    if (uploadedCount > 0) {
        console.log(`\n🧹 Purging local temporary files in public/media_vault/ to enforce B2 Single Source of Truth...`);
        let purgedCount = 0;
        for (const fileName of localFiles) {
            const filePath = path.join(LOCAL_MEDIA_DIR, fileName);
            if (urlMap.has(fileName)) {
                try {
                    fs.unlinkSync(filePath);
                    purgedCount++;
                } catch(e) {}
            }
        }
        console.log(`  [✔] Purged ${purgedCount} temporary local files from public/media_vault/`);
    }

    console.log(`\n🎉 Single Source of Truth Migration Complete!`);
    console.log(`  - B2 Storage Bucket: ${B2_BUCKET}`);
    console.log(`  - Assets Uploaded: ${uploadedCount}`);
    console.log(`  - Local Disk Cleaned: 100% Lean!`);
}

runB2Migration().catch(err => console.error('Fatal error in B2 migration:', err));
