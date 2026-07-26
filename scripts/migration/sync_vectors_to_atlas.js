import sqlite3Pkg from 'sqlite3';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const sqlite3 = sqlite3Pkg.verbose();
const dbPath = path.join(process.cwd(), 'staging.db');
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
    console.error("❌ MONGODB_URI not found in .env.local");
    process.exit(1);
}

// We force IPv4 to eliminate multi-cloud DNS latency, matching your sovereignSearch pattern
const client = new MongoClient(mongoUri, { family: 4 });

async function syncToAtlas() {
    console.log(`\n=======================================================`);
    console.log(`🚀 LifeOS Vector Sync (SQLite -> MongoDB Atlas)`);
    console.log(`=======================================================\n`);
    
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB Atlas...");
    await client.connect();
    const dbMongo = client.db("LifeOS");
    
    // Target collection for the ingested data
    const collection = dbMongo.collection("takeout_media");
    
    // Ensure we have a fast index for upserting
    await collection.createIndex({ hash: 1 }, { unique: true });
    console.log("✅ MongoDB connected & indices verified.");
    
    // Connect to SQLite
    const dbSqlite = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
    
    // Get total count of fully vectorized records
    const totalCount = await new Promise((resolve, reject) => {
        dbSqlite.get("SELECT COUNT(*) as count FROM files f JOIN file_vectors v ON f.hash = v.hash", (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
        });
    });
    
    console.log(`📊 Found ${totalCount} vectorized records in SQLite ready for Atlas.\n`);
    
    // Process in batches of 1000
    const BATCH_SIZE = 1000;
    let processed = 0;
    
    const fetchBatch = (offset) => {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT f.*, v.embedding, v.dim, v.vectorized_at 
                FROM files f 
                JOIN file_vectors v ON f.hash = v.hash 
                LIMIT ? OFFSET ?
            `;
            dbSqlite.all(query, [BATCH_SIZE, offset], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    const startTime = Date.now();

    while (processed < totalCount) {
        const rows = await fetchBatch(processed);
        if (rows.length === 0) break;
        
        const bulkOps = rows.map(row => {
            // The embedding in SQLite is a raw Float32Array BLOB. 
            // MongoDB $vectorSearch requires a standard JS Array of floats.
            const buffer = row.embedding;
            const floatArray = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
            const embeddingArray = Array.from(floatArray);
            
            // Reconstruct the document payload, injecting the mandatory userId for ACL security
            const doc = { 
                ...row, 
                embedding: embeddingArray,
                userId: 'eric_cornett' // Required for sovereignSearch.ts ACL filtering
            };
            
            return {
                updateOne: {
                    filter: { hash: doc.hash },
                    update: { $set: doc },
                    upsert: true
                }
            };
        });
        
        // Execute bulk upsert
        await collection.bulkWrite(bulkOps, { ordered: false });
        
        processed += rows.length;
        
        const elapsedSecs = (Date.now() - startTime) / 1000;
        const rate = (processed / elapsedSecs).toFixed(1);
        console.log(`⚙️ Synced: ${processed} / ${totalCount} (${((processed/totalCount)*100).toFixed(1)}%) | Rate: ${rate} docs/s`);
    }
    
    console.log("\n🎉 Sync complete! All local vector arrays are now hosted in MongoDB Atlas.");
    dbSqlite.close();
    await client.close();
}

syncToAtlas().catch(err => {
    console.error("❌ Fatal Error:", err);
    process.exit(1);
});
