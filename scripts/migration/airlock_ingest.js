import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sqlite3Pkg from 'sqlite3';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load env
const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, '.env.local') });

const sqlite3 = sqlite3Pkg.verbose();

// Args parsing
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isResume = args.includes('--resume');
const limitArg = args.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

const TARGET_DIR = "F:\\LifeOS_Archive";

const getManifestKey = (filename, size) => {
    return `${filename.toLowerCase().trim().replace(/\s+/g, '')}|${size}`;
};

const getFileType = (ext) => {
    const e = ext.toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.gif'].includes(e)) return 'IMAGE';
    if (['.mp4', '.mov', '.webm', '.avi', '.mkv'].includes(e)) return 'VIDEO';
    if (['.pdf', '.doc', '.docx', '.txt'].includes(e)) return 'DOCUMENT';
    return 'UNKNOWN';
};

const hashFile = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
};

async function* walkDirectory(dir) {
    const dirStream = await fs.promises.opendir(dir);
    for await (const dirent of dirStream) {
        const res = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* walkDirectory(res);
        } else {
            yield res;
        }
    }
}

async function main() {
    console.log("\n=======================================================");
    console.log("🚀 LifeOS Airlock Ingest (Classification Phase)");
    console.log("=======================================================\n");

    if (isDryRun) console.log("⚠️ DRY RUN MODE ENABLED - No permanent changes to DB.");

    // 1. Fetch Mongo Manifest
    const uri = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
    if (!uri) throw new Error("MongoDB URI missing from .env.local");
    
    console.log("📡 Connecting to MongoDB Atlas for Pre-Flight Manifest...");
    const client = new MongoClient(uri);
    await client.connect();
    const dbMongo = client.db();
    
    const mediaItems = await dbMongo.collection('media').find({}, { projection: { originalName: 1, size: 1, _id: 1 } }).toArray();
    const pendingItems = await dbMongo.collection('pending_accessions').find({}, { projection: { originalName: 1, size: 1, _id: 1 } }).toArray();
    
    // Merge both arrays to prevent duplicating files that are already staged but not promoted
    const allExistingItems = [...mediaItems, ...pendingItems];
    console.log(`✅ Loaded ${mediaItems.length} media assets and ${pendingItems.length} pending accessions from MongoDB.`);
    
    // Build quick lookup map by normalized key
    const manifestMap = new Map();
    // Also build a name-only map to catch size upgrades
    const nameMap = new Map();

    allExistingItems.forEach(item => {
        if (!item.originalName) return;
        const key = getManifestKey(item.originalName, item.size || 0);
        manifestMap.set(key, item._id.toString());

        const nameKey = item.originalName.toLowerCase().trim().replace(/\s+/g, '');
        if (!nameMap.has(nameKey)) {
            nameMap.set(nameKey, []);
        }
        nameMap.get(nameKey).push({ id: item._id.toString(), size: item.size || 0 });
    });
    
    await client.close();

    // 2. Initialize Staging DB
    const dbPath = path.join(rootDir, 'staging.db');
    const db = new sqlite3.Database(dbPath);

    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('PRAGMA journal_mode = WAL;');
            db.run('PRAGMA busy_timeout = 5000;');
            db.run(`CREATE TABLE IF NOT EXISTS airlock_jobs (
                hash TEXT PRIMARY KEY,
                filename TEXT,
                filepath TEXT,
                size INTEGER,
                originalName TEXT,
                status TEXT CHECK(status IN ('NEW', 'UPGRADE_SSOT', 'SKIP_DUPLICATE', 'ERROR')),
                existingMongoId TEXT,
                decisionReason TEXT,
                fileType TEXT,
                classifiedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => err ? reject(err) : resolve());
        });
    });

    // 3. Crawl & Classify
    console.log(`\n🔍 Beginning filesystem crawl of: ${TARGET_DIR}`);
    let processed = 0;
    let newCount = 0;
    let upgradeCount = 0;
    let skipCount = 0;
    let consecutiveErrors = 0;

    for await (const filepath of walkDirectory(TARGET_DIR)) {
        if (processed >= LIMIT) {
            console.log(`\n🛑 Reached specified limit of ${LIMIT} files. Stopping crawl.`);
            break;
        }

        const filename = path.basename(filepath);
        const ext = path.extname(filepath);
        const fileType = getFileType(ext);

        // Strict Allowlist: Reject everything that isn't classified as Image, Video, Audio, or Document
        // This prevents sweeping node_modules scripts (.ps1, .cmd, .js) into the media airlock.
        if (fileType === 'UNKNOWN' || ['.json', '.html', '.csv', '.lnk', '.ini'].includes(ext.toLowerCase())) continue;

        try {
            let stats;
            let statRetries = 0;
            while (statRetries < 3) {
                try {
                    stats = await fs.promises.stat(filepath);
                    break;
                } catch (statErr) {
                    if (statErr.code === 'ENOENT' || statErr.code === 'EIO') {
                        statRetries++;
                        if (statRetries >= 3) throw statErr;
                        console.log(`\n⚠️ [CRAWLER] Drive hiccup detected. Pausing for 3 seconds before retry ${statRetries}/3...`);
                        await new Promise(r => setTimeout(r, 3000));
                    } else {
                        throw statErr; // Throw other errors immediately
                    }
                }
            }

            if (stats.size === 0) continue;

            if (isResume) {
                const exists = await new Promise((resolve) => {
                    db.get("SELECT 1 FROM airlock_jobs WHERE filepath = ?", [filepath], (err, row) => resolve(!!row));
                });
                if (exists) continue;
            }

            // Classification Logic
            let status = 'NEW';
            let existingMongoId = null;
            let decisionReason = 'File not found in Mongo manifest';

            const exactKey = getManifestKey(filename, stats.size);
            const nameKey = filename.toLowerCase().trim().replace(/\s+/g, '');

            if (manifestMap.has(exactKey)) {
                // Exact match in name and size
                status = 'SKIP_DUPLICATE';
                existingMongoId = manifestMap.get(exactKey);
                decisionReason = 'Exact name and size match in MongoDB';
            } else if (nameMap.has(nameKey)) {
                // Name matches, but size differs. Check if we are an upgrade.
                const existingRecords = nameMap.get(nameKey);
                // Find if we are larger than any existing matching name
                let bestMatch = null;
                for (const rec of existingRecords) {
                    if (stats.size > rec.size) {
                        if (!bestMatch || rec.size > bestMatch.size) {
                            bestMatch = rec;
                        }
                    }
                }
                
                if (bestMatch) {
                    status = 'UPGRADE_SSOT';
                    existingMongoId = bestMatch.id;
                    decisionReason = `Takeout size (${stats.size}) > Mongo size (${bestMatch.size})`;
                } else {
                    // We are smaller or equal, so we skip
                    status = 'SKIP_DUPLICATE';
                    existingMongoId = existingRecords[0].id; // Just log the first one
                    decisionReason = 'Existing Mongo asset is same size or larger';
                }
            }

            // Calculate hash only if it's NEW or UPGRADE_SSOT to save time, unless we want hashes for everything.
            // Let's hash them all for integrity, but maybe skip if it's a known duplicate to save massive time?
            // Grok says: "(mostly metadata + occasional hashing for edge cases)".
            let fileHash = "pending_hash_" + crypto.randomBytes(4).toString('hex'); 
            if (status !== 'SKIP_DUPLICATE') {
                fileHash = await hashFile(filepath);
            }

            if (!isDryRun) {
                const stmt = db.prepare(`INSERT OR REPLACE INTO airlock_jobs 
                    (hash, filename, filepath, size, originalName, status, existingMongoId, decisionReason, fileType) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                
                await new Promise((resolve, reject) => {
                    stmt.run(fileHash, filename, filepath, stats.size, filename, status, existingMongoId, decisionReason, fileType, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                stmt.finalize();
            }

            if (status === 'NEW') newCount++;
            if (status === 'UPGRADE_SSOT') upgradeCount++;
            if (status === 'SKIP_DUPLICATE') skipCount++;
            processed++;

            if (processed % 1000 === 0) {
                console.log(`   [Progress] Scanned ${processed} | NEW: ${newCount} | UPGRADE: ${upgradeCount} | SKIP: ${skipCount}`);
            }
            consecutiveErrors = 0; // Reset on success

        } catch (err) {
            console.error(`⚠️ Error processing ${filepath}: `, err.message);
            if (err.code === 'ENOENT' || err.code === 'EIO') {
                consecutiveErrors++;
                if (consecutiveErrors > 10) {
                    console.error(`\n🚨 CRITICAL HARDWARE FAILURE DETECTED! Drive F: may have disconnected.`);
                    console.error(`Aborting to prevent database corruption. Exiting with code 2.`);
                    process.exit(2);
                }
            } else {
                consecutiveErrors = 0;
            }

            if (!isDryRun) {
                db.run(`INSERT OR REPLACE INTO airlock_jobs (hash, filepath, filename, status, decisionReason) VALUES (?, ?, ?, 'ERROR', ?)`,
                    [`error_${Date.now()}`, filepath, filename, err.message]);
            }
        }
    }

    console.log("\n=======================================================");
    console.log("🏁 Airlock Classification Complete!");
    console.log(`📊 Total Processed: ${processed}`);
    console.log(`✨ Net-New Assets:  ${newCount}`);
    console.log(`🚀 Upgrades (SSOT):${upgradeCount}`);
    console.log(`🗑️ Skipped (Dupes): ${skipCount}`);
    if (isDryRun) console.log("⚠️ This was a DRY RUN. No rows were saved.");
    console.log("=======================================================\n");

    db.close();
}

main().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
