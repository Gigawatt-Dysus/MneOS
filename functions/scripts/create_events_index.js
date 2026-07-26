require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');

async function run() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');

    console.log("Creating index on mediaIds...");
    await db.collection('events').createIndex({ mediaIds: 1 });
    console.log("Index created successfully.");

    await client.close();
}
run().catch(console.error);
