import sqlite3Pkg from 'sqlite3';
import path from 'path';
import { pipeline, env } from '@xenova/transformers';

const sqlite3 = sqlite3Pkg.verbose();

// Optimization: Allow local caching of the model
env.allowLocalModels = true;
env.useBrowserCache = false;

// Parse CLI Arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(arg => arg.startsWith('--limit='));
const RECORD_LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

const BATCH_SIZE = 64; 

function formatBytes(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// Extract context from path (e.g. "I:\LifeOS_Archive\2014 Year End Review\..." -> "2014 Year End Review")
function extractContextFromPath(filepath) {
    if (!filepath) return 'Unknown Context';
    const parts = filepath.split('\\');
    // Usually the top level folders inside the archive root hold the main context
    return parts.length > 2 ? parts[2] : parts.pop();
}

async function main() {
    console.log("=======================================================");
    console.log("🚀 LifeOS Sovereign Vectorization Engine");
    if (isDryRun) console.log("⚠️  DRY RUN MODE ACTIVE - No vectors will be saved to DB");
    if (RECORD_LIMIT) console.log(`🛑 LIMIT APPLIED: Processing max ${RECORD_LIMIT} records`);
    console.log("=======================================================\n");

    const dbPath = path.join(process.cwd(), 'staging.db');
    const db = new sqlite3.Database(dbPath);

    // 1. Initialize schema for vectors
    if (!isDryRun) {
        await new Promise((resolve, reject) => {
            db.run(`CREATE TABLE IF NOT EXISTS file_vectors (
                hash TEXT PRIMARY KEY,
                embedding BLOB,
                dim INTEGER DEFAULT 1024,
                vectorized_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (hash) REFERENCES files(hash)
            )`, (err) => err ? reject(err) : resolve());
        });
    }

    // 2. Fetch pending records
    console.log("🔍 Scanning for unvectorized records in staging.db...");
    let query = `
        SELECT f.hash, f.filename, f.filepath, f.extension, f.size 
        FROM files f
        LEFT JOIN file_vectors v ON f.hash = v.hash
        WHERE v.hash IS NULL
    `;
    if (RECORD_LIMIT) query += ` LIMIT ${RECORD_LIMIT}`;

    const pendingRecords = await new Promise((resolve, reject) => {
        db.all(query, [], (err, rows) => err ? reject(err) : resolve(rows));
    });

    const totalPending = pendingRecords.length;
    console.log(`📊 Found ${totalPending} records requiring vectorization.\n`);

    if (totalPending === 0) {
        console.log("✅ All records are vectorized. Exiting.");
        process.exit(0);
    }

    // 3. Initialize Transformers.js
    console.log("🧠 Loading Voyage-4-Nano (MoE) locally...");
    const embedder = await pipeline(
        'feature-extraction',
        'voyageai/voyage-4-nano',
        { quantized: true, dtype: 'q8' }
    );
    console.log("✅ Model loaded into memory.\n");

    // 4. Batch Process
    let processedCount = 0;
    const startTime = Date.now();

    for (let i = 0; i < totalPending; i += BATCH_SIZE) {
        const batch = pendingRecords.slice(i, i + BATCH_SIZE);
        
        // Prepare rich semantic text representation
        const textsToEmbed = batch.map(record => {
            const context = extractContextFromPath(record.filepath);
            const sizeStr = formatBytes(record.size || 0);
            return `File: ${record.filename}\nPath: ${record.filepath}\nContext: ${context}\nType: ${record.extension}\nSize: ${sizeStr}`;
        });

        // Generate embeddings
        const output = await embedder(textsToEmbed, { pooling: 'mean', normalize: true });
        const embeddings = output.tolist();

        // Transactional insert to SQLite
        if (!isDryRun) {
            await new Promise((resolve, reject) => {
                db.serialize(() => {
                    db.run("BEGIN TRANSACTION");
                    const stmt = db.prepare("INSERT INTO file_vectors (hash, embedding, dim) VALUES (?, ?, 1024)");
                    
                    batch.forEach((record, index) => {
                        // Convert to Float32Array then Buffer for optimal BLOB storage (4096 bytes per vector)
                        const floatArray = new Float32Array(embeddings[index]);
                        const buffer = Buffer.from(floatArray.buffer);
                        stmt.run(record.hash, buffer);
                    });
                    
                    stmt.finalize();
                    db.run("COMMIT", (err) => err ? reject(err) : resolve());
                });
            });
        }

        processedCount += batch.length;
        
        // Console metrics
        const elapsedSecs = (Date.now() - startTime) / 1000;
        const rate = (processedCount / elapsedSecs).toFixed(2);
        const memUsage = process.memoryUsage();
        const memStr = (memUsage.rss / 1024 / 1024).toFixed(1) + 'MB';
        
        // Calculate ETA
        const remaining = totalPending - processedCount;
        const etaSecs = remaining / (processedCount / elapsedSecs);
        const etaMins = (etaSecs / 60).toFixed(1);

        process.stdout.write(`\r⚙️ Progress: ${processedCount} / ${totalPending} (${((processedCount/totalPending)*100).toFixed(1)}%) | Rate: ${rate}/s | ETA: ${etaMins}m | RAM: ${memStr}`);
    }

    console.log(`\n\n🎉 Vectorization complete! Processed ${processedCount} records in ${((Date.now() - startTime)/1000).toFixed(1)}s.`);
    db.close();
}

main().catch(err => {
    console.error("\n❌ Fatal Error in Vectorization Pipeline:");
    console.error(err);
    process.exit(1);
});
