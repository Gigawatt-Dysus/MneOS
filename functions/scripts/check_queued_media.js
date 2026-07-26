require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');

async function run() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');

    const queuedMedia = await db.collection('media').find({ aiProcessed: false }).toArray();
    console.log(`[REPORT] Found ${queuedMedia.length} media records awaiting Moondream AI re-scan.`);

    if (queuedMedia.length > 0) {
        console.log(`Sample: ${queuedMedia[0]._id}`);
    }

    await client.close();
}

run().catch(console.error);
