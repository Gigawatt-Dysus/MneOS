const sqlite3 = require('sqlite3').verbose();
const { MongoClient } = require('mongodb');

const MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017";
const DB_NAME = "LifeOS";

async function syncCaptions() {
    console.log("Starting back-sync of Moondream captions from Mongo to SQLite...");
    
    const client = new MongoClient(MONGO_URI);
    const db = new sqlite3.Database('c:/LifeOS/staging.db');

    try {
        await client.connect();
        const mongoDb = client.db(DB_NAME);

        let updatedCount = 0;

        for (const collectionName of ["media", "pending_accessions"]) {
            console.log(`Scanning MongoDB collection: ${collectionName}`);
            
            // Get all items that Moondream processed
            const docs = await mongoDb.collection(collectionName).find({ 
                aiProcessed: true, 
                caption: { $exists: true, $ne: "" } 
            }).toArray();

            console.log(`Found ${docs.length} captioned items in ${collectionName}`);

            for (const doc of docs) {
                const originalName = doc.originalName || doc.fileName;
                const caption = doc.caption;
                
                // Update SQLite using a promise
                await new Promise((resolve, reject) => {
                    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
                    db.run(
                        `UPDATE airlock_jobs 
                         SET caption = ?, processed_at = ?, process_state = 'complete'
                         WHERE originalName = ? AND caption IS NULL`,
                        [caption, now, originalName],
                        function(err) {
                            if (err) reject(err);
                            if (this.changes > 0) updatedCount += this.changes;
                            resolve();
                        }
                    );
                });
            }
        }

        console.log(`\n✅ Sync complete! ${updatedCount} new Moondream captions injected into local staging.db`);
        
    } catch (e) {
        console.error("Error during sync:", e);
    } finally {
        await client.close();
        db.close();
    }
}

syncCaptions();
