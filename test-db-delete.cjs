const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
    await client.connect();
    const db = client.db('LifeOS');
    const docId = '2PG85QNw1updth2sVX4N';
    const legacyUid = '2qQf69l6j5XozM43ZJ2Tyr4qJdg2';
    const keyId = `${legacyUid}_${docId}`;
    
    let filter = { _id: keyId };
    console.log("Looking for:", filter);
    
    const doc = await db.collection('media').findOne(filter);
    console.log("Found:", !!doc);
    
    if (doc) {
        try {
            const res = await db.collection('media').deleteOne({ _id: doc._id });
            console.log("Deleted count:", res.deletedCount);
        } catch (err) {
            console.error("Delete Error:", err);
        }
    }
    client.close();
}
run();
