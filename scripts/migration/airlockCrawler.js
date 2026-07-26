import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import sqlite3Pkg from 'sqlite3';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const sqlite3 = sqlite3Pkg.verbose();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

// Fast file hashing
const hashFile = (filePath) => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
};

const normalizeKey = (name, size) => {
    return `${(name || '').toLowerCase().trim()}-${size}`;
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

async function buildManifest() {
    console.log("\n📡 Connecting to SovereignDB (MongoDB) to build Pre-Flight Manifest...");
    const uri = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
    
    if (!uri) {
        console.warn("⚠️  WARNING: MONGODB_URI not found in .env.local. Skipping Manifest build. Deduplication will be disabled.");
        return new Map();
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const dbName = process.env.MONGODB_DB_NAME || 'lifeos';
        const db = client.db(dbName);
        
        const manifest = new Map();
        // Adjust collection name if it's strictly under users/XYZ/media, or flat media. 
        // For staging purposes, we will assume a flat media collection or we fetch all.
        const mediaDocs = await db.collection('media').find({}, { projection: { _id: 1, originalName: 1, fileName: 1, size: 1 } }).toArray();
        
        let valid = 0;
        for (const doc of mediaDocs) {
            const name = doc.originalName || doc.fileName;
            if (name && doc.size) {
                const key = normalizeKey(name, doc.size);
                manifest.set(key, { id: doc._id.toString(), size: doc.size, originalName: name });
                valid++;
            }
        }
        console.log(`✅ Manifest built: ${valid} exact Matchable Media Records found.`);
        return manifest;
    } catch (err) {
        console.error("❌ Failed to build manifest:", err.message);
        return new Map();
    } finally {
        await client.close();
    }
}

async function main() {
    console.log("\n=======================================================");
    console.log("🚀 LifeOS Airlock Crawler (Phase 1 & 2)");
    console.log("=======================================================\n");

    let targetDir = await askQuestion("Enter the absolute path to your archive root [Default: I:\\LifeOS_Archive]: ");
    if (!targetDir.trim()) {
        targetDir = "I:\\LifeOS_Archive";
    }
    
    if (!fs.existsSync(targetDir)) {
        console.error(`\n❌ Error: Directory not found -> ${targetDir}`);
        process.exit(1);
    }

    const manifest = await buildManifest();

    const dbPath = path.join(process.cwd(), 'staging.db');
    console.log(`\n📦 Initializing SQLite Airlock database at: ${dbPath}`);
    
    const db = new sqlite3.Database(dbPath);

    // Initialize Schema with Grok's suggestions
    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS files (
                hash TEXT PRIMARY KEY,
                normalized_key TEXT,
                filename TEXT,
                filepath TEXT,
                extension TEXT,
                size INTEGER,
                action_type TEXT, 
                existing_id TEXT,
                processing_status TEXT DEFAULT 'pending'
            )`, (err) => {
                if (err) return reject(err);
                db.run(`CREATE INDEX IF NOT EXISTS idx_filepath ON files(filepath)`, (err) => {
                    if (err) return reject(err);
                    db.run(`CREATE TABLE IF NOT EXISTS scanned_paths (filepath TEXT PRIMARY KEY)`, resolve);
                });
            });
        });
    });

    console.log("🔍 Scanning filesystem & resolving SSOT. This will take a while for 1.2TB...\n");

    let initialCount = await new Promise((resolve) => db.get("SELECT COUNT(*) as c FROM files", [], (e, r) => resolve(r ? r.c : 0)));
    let count = initialCount;
    let ignoredCount = 0;
    let duplicatesDropped = 0;
    let skippedCount = 0;
    let upgradeCount = 0;
    let newAssetCount = 0;
    const startTime = Date.now();

    for await (const filepath of walkDirectory(targetDir)) {
        const filename = path.basename(filepath);
        const ext = path.extname(filepath).toLowerCase();
        
        if (['.lnk', '.json', '.html', '.csv', '.ini', '.db'].includes(ext)) {
            ignoredCount++;
            continue;
        }

        try {
            const stats = await fs.promises.stat(filepath);
            if (stats.size === 0) continue;

            const exists = await new Promise((resolve, reject) => {
                db.get("SELECT 1 FROM scanned_paths WHERE filepath = ?", [filepath], (err, row) => resolve(!!row));
            });

            if (exists) {
                skippedCount++;
                continue;
            }

            const key = normalizeKey(filename, stats.size);
            const manifestMatch = manifest.get(key);
            
            let actionType = 'new';
            let existingId = null;

            if (manifestMatch) {
                // We matched perfectly on name + size. LifeOS already has this exact file.
                // We mark it for "enrichment" only, not physical overwrite.
                actionType = 'enrich';
                existingId = manifestMatch.id;
            } else {
                // Wait, what if the name matches but size is bigger?
                // Let's do a loose check if we wanted to, but iterating Map values is slow.
                // Grok suggested simply doing size comparison if names matched.
                // For a 1.2TB archive, let's keep it simple: If exact match, enrich. If no match, insert new.
                // If they have same name but different size, we treat as 'upgrade' or 'new' depending on logic.
                // We'll default to 'new' if sizes differ.
            }

            const fileHash = await hashFile(filepath);

            const stmt = db.prepare(`INSERT OR IGNORE INTO files (hash, normalized_key, filename, filepath, extension, size, action_type, existing_id, processing_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`);
            
            await new Promise((resolve, reject) => {
                stmt.run(fileHash, key, filename, filepath, ext, stats.size, actionType, existingId, function(err) {
                    if (err) return reject(err);
                    if (this.changes === 0) {
                        duplicatesDropped++;
                    } else {
                        count++;
                        if (actionType === 'new') newAssetCount++;
                        if (actionType === 'enrich') upgradeCount++;
                    }

                    db.run(`INSERT OR IGNORE INTO scanned_paths (filepath) VALUES (?)`, [filepath], resolve);
                });
            });
            stmt.finalize();

            if ((count + duplicatesDropped) % 100 === 0) {
                const elapsedSec = (Date.now() - startTime) / 1000;
                const speed = Math.round((count + duplicatesDropped) / elapsedSec);
                process.stdout.write(`\r[${new Date().toLocaleTimeString()}] ✅ Staged: ${count} (New: ${newAssetCount}, Enrich: ${upgradeCount}) | ✂️ Purged: ${duplicatesDropped} | ⚡ ${speed} files/sec   `);
            }

        } catch (err) {
            console.error(`\n⚠️ Failed to process file: ${filepath}`, err.message);
        }
    }

    console.log("\n\n🎉 Crawl & Deduplication Complete!");
    console.log(`📊 Final Staged Files: ${count}`);
    console.log(`   - Net New Assets: ${newAssetCount}`);
    console.log(`   - Existing (To Enrich): ${upgradeCount}`);
    console.log(`✂️  Exact Duplicates Purged: ${duplicatesDropped}`);
    console.log(`💾 Staging Database ready at: ${dbPath}\n`);

    db.close();
    rl.close();
}

main().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
