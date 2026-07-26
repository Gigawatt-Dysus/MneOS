import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// CLI ARGUMENT PARSING
// ==========================================
const args = process.argv.slice(2);
const options = {
    target: null,
    b2Bucket: null,
    dryRun: false,
    userId: '9MPVGVTxE8dXvkCrl1XrWHQzCl23' // Extracted from environment context
};

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) options.target = args[++i];
    if (args[i] === '--b2-bucket' && args[i + 1]) options.b2Bucket = args[++i];
    if (args[i] === '--dry-run') options.dryRun = true;
    if (args[i] === '--user-id' && args[i + 1]) options.userId = args[++i];
}

if (!options.target || !options.b2Bucket) {
    console.error("Usage: node accession_engine.mjs --target <local_path> --b2-bucket <public_b2_url_prefix> [--dry-run]");
    console.error("Example: node accession_engine.mjs --target \"I:\\LifeOS_Archive\\ALL_PHOTOS\\2014\\11\" --b2-bucket \"https://f000.backblazeb2.com/file/LifeOS-Bucket/ALL_PHOTOS/2014/11\" --dry-run");
    process.exit(1);
}

// ==========================================
// INITIALIZE FIREBASE ADMIN SDK
// ==========================================
const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
let db;

if (!options.dryRun) {
    try {
        const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        db = admin.firestore();
        console.log(`[INIT] Firebase Admin SDK Connected.`);
    } catch (e) {
        console.error(`[ERROR] Failed to load Firebase credentials from ${serviceAccountPath}`, e);
        process.exit(1);
    }
} else {
    console.log(`[MODE] DRY RUN ENABLED - No Firebase writes will occur.`);
}

console.log(`[INIT] Accession Engine Started.`);
console.log(`[INIT] Target: ${options.target}`);
console.log(`[INIT] B2 Prefix: ${options.b2Bucket}`);

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function getSha256(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

async function getImageMetadata(filePath) {
    try {
        const metadata = await sharp(filePath).metadata();
        return {
            width: metadata.width,
            height: metadata.height,
            aspectRatio: metadata.width && metadata.height ? parseFloat((metadata.width / metadata.height).toFixed(3)) : 1.33
        };
    } catch (e) {
        // Fallback for videos or unsupported formats
        return { width: 800, height: 600, aspectRatio: 1.33 };
    }
}

function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo'
    };
    return map[ext] || 'application/octet-stream';
}

// Recursively get all files
async function walkDir(dir) {
    let results = [];
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (let entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(await walkDir(fullPath));
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            // Filter noise and config files
            if (!['.json', '.ini', '.db', '.DS_Store'].includes(ext)) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

// ==========================================
// MAIN PIPELINE
// ==========================================
async function main() {
    console.log(`[SCAN] Scanning target directory...`);
    let files = [];
    try {
        files = await walkDir(options.target);
    } catch (e) {
        console.error(`[ERROR] Failed to read directory ${options.target}:`, e.message);
        process.exit(1);
    }

    console.log(`[SCAN] Found ${files.length} media files to accession.`);
    
    let processedCount = 0;
    let skippedCount = 0;
    
    // We process sequentially to avoid memory spikes and Firebase rate limits
    for (const filePath of files) {
        try {
            const fileName = path.basename(filePath);
            const relativePath = path.relative(options.target, filePath).replace(/\\/g, '/');
            const fileStats = await fs.promises.stat(filePath);
            
            // 1. Generate SHA-256 Content Hash
            const contentHash = await getSha256(filePath);
            
            // 2. Extract Metadata
            const imgMeta = await getImageMetadata(filePath);
            const logicalDate = fileStats.mtime; // Use the modified time we restored
            const fileType = getMimeType(fileName);
            
            // 3. Construct Public Cloud URL
            // B2 URLs should be URI encoded
            const encodedPath = encodeURI(relativePath);
            const b2Base = options.b2Bucket.endsWith('/') ? options.b2Bucket : options.b2Bucket + '/';
            const mediaUrl = `${b2Base}${encodedPath}`;
            
            // 4. Construct Gateway Payload Schema
            const payload = {
                mediaUrl: mediaUrl,
                logicalDate: admin.firestore.Timestamp.fromDate(logicalDate),
                status: 'pending',
                source: 'takeout_ingest',
                title: fileName,
                description: '',
                tagIds: [],
                fileType: fileType,
                fileName: fileName,
                fileSize: fileStats.size,
                contentHash: contentHash,
                isDuplicate: false, // For gateway to resolve
                triage: {
                    title: fileName,
                    width: imgMeta.width,
                    height: imgMeta.height,
                    aspectRatio: imgMeta.aspectRatio,
                    contentHash: contentHash
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            if (options.dryRun) {
                console.log(`[DRY-RUN] Would accession: ${fileName}`);
                console.log(`   - Hash: ${contentHash.substring(0,8)}...`);
                console.log(`   - Date: ${logicalDate.toISOString()}`);
                console.log(`   - URL:  ${mediaUrl}`);
                processedCount++;
            } else {
                // Duplicate Protection Check in pending_accessions
                const duplicateQuery = await db.collection('users').doc(options.userId)
                    .collection('pending_accessions')
                    .where('contentHash', '==', contentHash)
                    .limit(1).get();
                    
                if (!duplicateQuery.empty) {
                    console.log(`[SKIP] Already staged (Hash Collision): ${fileName}`);
                    skippedCount++;
                    continue;
                }
                
                await db.collection('users').doc(options.userId).collection('pending_accessions').add(payload);
                console.log(`[SUCCESS] Accessioned: ${fileName}`);
                processedCount++;
            }
            
        } catch (err) {
            console.error(`[ERROR] Failed to process ${filePath}:`, err.message);
        }
    }
    
    console.log(`\n=========================================`);
    console.log(`[DONE] Accession Engine Finished!`);
    console.log(`[STATS] Successfully Processed: ${processedCount}`);
    if (!options.dryRun) console.log(`[STATS] Skipped (Duplicates): ${skippedCount}`);
    console.log(`=========================================`);
    process.exit(0);
}

main();
