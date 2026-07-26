import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import sqlite3Pkg from 'sqlite3';

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

// Recursive async generator to walk directories without blowing up RAM
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
    console.log("🚀 LifeOS Sovereign Staging Crawler");
    console.log("=======================================================\n");

    let targetDir = await askQuestion("Enter the absolute path to your archive root [Default: I:\\LifeOS_Archive]: ");
    if (!targetDir.trim()) {
        targetDir = "I:\\LifeOS_Archive";
    }
    
    if (!fs.existsSync(targetDir)) {
        console.error(`\n❌ Error: Directory not found -> ${targetDir}`);
        process.exit(1);
    }

    const dbPath = path.join(process.cwd(), 'staging.db');
    console.log(`\n📦 Initializing SQLite database at: ${dbPath}`);
    
    const db = new sqlite3.Database(dbPath);

    // Initialize Schema
    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS files (
                hash TEXT PRIMARY KEY,
                filename TEXT,
                filepath TEXT,
                extension TEXT,
                size INTEGER,
                is_shortcut BOOLEAN
            )`, (err) => {
                if (err) return reject(err);
                db.run(`CREATE INDEX IF NOT EXISTS idx_filepath ON files(filepath)`, (err) => {
                    if (err) return reject(err);
                    db.run(`CREATE TABLE IF NOT EXISTS scanned_paths (filepath TEXT PRIMARY KEY)`, (err) => {
                        if (err) return reject(err);
                        // Backfill existing staged files into the new ledger
                        db.run(`INSERT OR IGNORE INTO scanned_paths (filepath) SELECT filepath FROM files`, (err) => {
                            err ? reject(err) : resolve();
                        });
                    });
                });
            });
        });
    });

    console.log("🔍 Scanning filesystem. This will take a while for 1.2TB...\n");

    // Fetch initial state for resume tracking
    let initialCount = await new Promise((resolve) => {
        db.get("SELECT COUNT(*) as c FROM files", [], (err, row) => resolve(row ? row.c : 0));
    });
    let count = initialCount;
    let ignoredCount = 0;
    let duplicatesDropped = 0;
    let skippedCount = 0;
    const startTime = Date.now();

    for await (const filepath of walkDirectory(targetDir)) {
        const filename = path.basename(filepath);
        const ext = path.extname(filepath).toLowerCase();
        
        if (ext === '.lnk' || ext === '.json' || ext === '.html' || ext === '.csv') {
            ignoredCount++;
            continue;
        }

        try {
            const stats = await fs.promises.stat(filepath);
            if (stats.size === 0) continue;

            const exists = await new Promise((resolve, reject) => {
                db.get("SELECT 1 FROM scanned_paths WHERE filepath = ?", [filepath], (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                });
            });

            if (exists) {
                skippedCount++;
                if (skippedCount % 1000 === 0) {
                     const ts = new Date().toLocaleTimeString();
                     process.stdout.write(`\r[${ts}] ⏩ Fast-forwarding... Skipped ${skippedCount} already-staged files...`);
                }
                continue;
            }

            if (stats.size > 500 * 1024 * 1024) { // > 500MB
                process.stdout.write(`\n⏳ Hashing massive file (${(stats.size / 1024 / 1024 / 1024).toFixed(2)} GB): ${filename}...\n`);
            }

            const fileHash = await hashFile(filepath);

            const stmt = db.prepare(`INSERT OR IGNORE INTO files (hash, filename, filepath, extension, size, is_shortcut) VALUES (?, ?, ?, ?, ?, ?)`);
            
            await new Promise((resolve, reject) => {
                stmt.run(fileHash, filename, filepath, ext, stats.size, false, function(err) {
                    if (err) return reject(err);
                    
                    if (this.changes === 0) {
                        duplicatesDropped++;
                    } else {
                        count++;
                    }

                    // Log this filepath as visited so we NEVER hash it again
                    db.run(`INSERT OR IGNORE INTO scanned_paths (filepath) VALUES (?)`, [filepath], (err) => {
                        if (err) return reject(err);

                        // Update stats every 50 new files or dupes
                        if ((count + duplicatesDropped) % 50 === 0) {
                            const elapsedSec = (Date.now() - startTime) / 1000;
                            const sessionProcessed = (count - initialCount) + duplicatesDropped + ignoredCount + skippedCount;
                            const speed = Math.round(sessionProcessed / elapsedSec);
                            const ts = new Date().toLocaleTimeString();
                            process.stdout.write(`\r[${ts}] ✅ Staged: ${count} | ✂️ Purged: ${duplicatesDropped} | 🗑️ Ignored: ${ignoredCount} | ⚡ ${speed} files/sec   `);
                        }
                        resolve();
                    });
                });
            });
            stmt.finalize();

            await new Promise(resolve => setTimeout(resolve, 5));

        } catch (err) {
            console.error(`\n⚠️ Failed to process file: ${filepath}`, err.message);
        }
    }

    console.log("\n\n🎉 Crawl Complete!");
    console.log(`📊 Final Staged Files: ${count}`);
    console.log(`✂️  Duplicates Purged: ${duplicatesDropped}`);
    console.log(`👻 Dead Shortcuts Purged: ${shortcutsDropped}`);
    console.log(`💾 Staging Database ready at: ${dbPath}\n`);

    db.close();
    rl.close();
}

main().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
