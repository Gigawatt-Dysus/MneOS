require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');

async function run() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');

    const indexes = await db.collection('events').indexes();
    console.log("Events indexes:", indexes.map(i => i.name));

    await client.close();
}
run().catch(console.error);
