const { MongoClient } = require('mongodb');
const os = require('os');

const NODE_ID = process.env.NODE_ID || os.hostname().toUpperCase();

const getMongoUri = () => {
    return process.env.MONGODB_URI || "mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin";
};

async function purgeJson() {
    console.log(`[ZEN] Booting JSON/TXT Purge Script on node: ${NODE_ID}`);
    const mongoUri = getMongoUri();
    console.log(`[ZEN] Connecting to MongoDB: ${mongoUri}`);
    
    const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });

    try {
        await client.connect();
        const db = client.db('LifeOS');
        const collection = db.collection('pending_accessions');

        // Target all json, txt, and md files in the queue
        const query = { 
            fileName: { $regex: "\\.(json|txt|md)$", $options: "i" } 
        };

        const count = await collection.countDocuments(query);
        if (count === 0) {
            console.log("[✅] No JSON/TXT/MD files found in pending_accessions.");
            return;
        }

        console.log(`[!] Found ${count} non-media files matching .json/.txt/.md in pending_accessions. Purging...`);
        
        const result = await collection.deleteMany(query);
        console.log(`[✅] Successfully deleted ${result.deletedCount} corrupted accession items from the queue.`);

    } catch (err) {
        console.error("FATAL ERROR:", err);
    } finally {
        await client.close();
    }
}

purgeJson();
