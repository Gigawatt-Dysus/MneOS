require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const StreamZip = require('node-stream-zip');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- ZIP RESCUE CONFIGURATION ---
const NODE_ID = process.env.NODE_ID || os.hostname().toUpperCase();
const TAKEOUT_DIR = process.env.TAKEOUT_DIR || 'F:\\lifeboat_archives'; 
const DRY_RUN = false;

// --- FORENSIC LOGGING ---
const logFilePath = path.join(__dirname, `zip_rescue_forensic_${Date.now()}.log`);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function sysLog(msg, isError = false) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${msg}`;
    if (isError) {
        console.error(formatted);
    } else {
        console.log(formatted);
    }
    logStream.write(formatted + '\n');
}
// --------------------------------

const getS3Client = () => {
    let endpoint = process.env.B2_ENDPOINT || "s3.us-east-005.backblazeb2.com";
    if (!endpoint.startsWith('http')) endpoint = `https://${endpoint}`;

    return new S3Client({
        region: process.env.B2_REGION || "us-east-005",
        endpoint: endpoint,
        credentials: {
            accessKeyId: process.env.B2_ACCESS_KEY_ID,
            secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
        },
    });
};

async function runZipRescue() {
    sysLog(`\n🚁 [ZIP RESCUE NODE: ${NODE_ID}] Online.`);
    sysLog(`⚙️  Targeting Archives in: ${TAKEOUT_DIR}`);
    sysLog(`📝 Forensic Log Initialized: ${logFilePath}`);

    // 1. Discover Zip Files
    if (!fs.existsSync(TAKEOUT_DIR)) {
        sysLog(`❌ Takeout directory not found: ${TAKEOUT_DIR}`, true);
        process.exit(1);
    }
    
    function findZipsRecursively(dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                results = results.concat(findZipsRecursively(filePath));
            } else if (file.endsWith('.zip')) {
                results.push(filePath);
            }
        });
        return results;
    }
    
    const zipFiles = findZipsRecursively(TAKEOUT_DIR);
    if (zipFiles.length === 0) {
        sysLog(`❌ No .zip files found in ${TAKEOUT_DIR}`, true);
        process.exit(1);
    }
    sysLog(`📦 Found ${zipFiles.length} zip archives.`);

    // 2. Connect to Database (Alpha Vault)
    const mongoUri = process.env.MONGODB_URI || 'mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin';
    sysLog(`🔌 Connecting to Alpha Vault...`);
    const mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    const db = mongoClient.db('LifeOS');
    
    const collections = await db.listCollections().toArray();
    const s3Client = getS3Client();
    const bucketName = process.env.B2_BUCKET_NAME || "LifeOS-Media";

    // 3. Build a lookup map of missing files from the DB
    sysLog(`🔍 Scanning database for Ghost records...`);
    const ghostRecords = new Map();

    for (const colInfo of collections) {
        const collection = db.collection(colInfo.name);
        const ghosts = await collection.find({
            processing_error: { $exists: true }
        }).toArray();

        for (const doc of ghosts) {
            if (doc.originalName || doc.fileName) {
                const name = doc.originalName || doc.fileName;
                ghostRecords.set(name, { _id: doc._id, collectionName: colInfo.name, record: doc });
            }
        }
    }

    sysLog(`👻 Found ${ghostRecords.size} Ghost records pending rescue.`);

    if (ghostRecords.size === 0) {
        sysLog(`✅ No ghosts to rescue. Exiting.`);
        await mongoClient.close();
        logStream.end();
        process.exit(0);
    }

    // 4. Scan Zips and Rescue
    let rescuedCount = 0;

    for (const zipPath of zipFiles) {
        if (ghostRecords.size === 0) break;

        sysLog(`\n📂 Opening archive: ${path.basename(zipPath)}`);
        const zip = new StreamZip.async({ file: zipPath });
        
        try {
            const entries = await zip.entries();
            const entryValues = Object.values(entries);
            sysLog(`   - Found ${entryValues.length} entries in zip manifest.`);

            for (const entry of entryValues) {
                if (entry.isDirectory) continue;
                
                const entryName = path.basename(entry.name);
                
                if (ghostRecords.has(entryName)) {
                    const ghostInfo = ghostRecords.get(entryName);
                    const record = ghostInfo.record;
                    sysLog(`   🚀 Rescue Match: ${entryName} -> Extracting to Buffer...`);
                    
                    if (DRY_RUN) {
                        sysLog(`   [DRY RUN] Would process and upload ${entryName}`);
                        ghostRecords.delete(entryName);
                        continue;
                    }

                    try {
                        const fileData = await zip.entryData(entry.name);
                        const finalBuffer = await sharp(fileData, { failOn: 'none' }).rotate().toBuffer();
                        const rotatedSharp = sharp(finalBuffer);
                        
                        const thumbSizes = { small: 300, medium: 800, large: 1600 };
                        const newThumbnailUrls = {};
                        const timestamp = Date.now();
                        const safeName = entryName.replace(/[^a-zA-Z0-9.-]/g, '_');

                        for (const [sizeName, width] of Object.entries(thumbSizes)) {
                            const resizedBuffer = await rotatedSharp.clone()
                                .resize({ width, withoutEnlargement: true })
                                .webp({ quality: 80 })
                                .toBuffer();
                            
                            let objectKey = `thumbnails/${record.userId || 'migration'}/${timestamp}_${sizeName}_${safeName}.webp`;
                            
                            await s3Client.send(new PutObjectCommand({
                                Bucket: bucketName,
                                Key: objectKey,
                                ContentType: 'image/webp',
                                Body: resizedBuffer
                            }));

                            newThumbnailUrls[sizeName] = `https://media.gigiwatt.com/file/${bucketName}/${objectKey}`;
                        }

                        // Upload full size image
                        const fullSizeKey = `users/migration/takeout_rescued/${timestamp}_${safeName}`;
                        await s3Client.send(new PutObjectCommand({
                            Bucket: bucketName,
                            Key: fullSizeKey,
                            ContentType: record.fileType || 'image/jpeg',
                            Body: finalBuffer
                        }));
                        const fullSizeUrl = `https://media.gigiwatt.com/file/${bucketName}/${fullSizeKey}`;

                        const collection = db.collection(ghostInfo.collectionName);
                        await collection.updateOne(
                            { _id: ghostInfo._id },
                            { 
                                $set: { 
                                    thumbnailUrls: newThumbnailUrls,
                                    url: fullSizeUrl,
                                    thumbnail_metadata_healed: true
                                },
                                $unset: { processing_error: "", processing_lock: "", locked_at: "", rotation: "", orientation: "" }
                            }
                        );

                        sysLog(`   ✅ Successfully rescued and healed: ${entryName}`);
                        rescuedCount++;
                        ghostRecords.delete(entryName); 

                    } catch (err) {
                        sysLog(`   ❌ Failed to rescue ${entryName}: ${err.message}`, true);
                    }
                }
            }
        } catch (err) {
            sysLog(`❌ Error reading zip ${zipPath}: ${err.message}`, true);
        } finally {
            await zip.close();
        }
    }

    sysLog(`\n🏁 Rescue Operation Complete. Rescued: ${rescuedCount} | Remaining Ghosts: ${ghostRecords.size}`);
    await mongoClient.close();
    logStream.end();
    process.exit(0);
}

runZipRescue().catch(err => {
    sysLog(`FATAL ERROR: ${err.message}`, true);
    process.exit(1);
});
