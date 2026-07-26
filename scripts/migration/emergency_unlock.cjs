require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const os = require('os');

const NODE_ID = process.env.NODE_ID || os.hostname().toUpperCase();
const uri = process.env.MONGODB_URI || "mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin";

async function releaseLocks() {
    console.log(`Releasing Pez Dispenser locks for ${NODE_ID}...`);
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');
    
    // Check both media and pending_accessions
    for (const colName of ['media', 'pending_accessions']) {
        const collection = db.collection(colName);
        const result = await collection.updateMany(
            { processing_lock: NODE_ID },
            { $unset: { processing_lock: "", locked_at: "" } }
        );
        console.log(`[${colName}] Released ${result.modifiedCount} locks held by ${NODE_ID}.`);
    }
    
    await client.close();
    console.log("Cleanup complete.");
}

releaseLocks().catch(console.error);
