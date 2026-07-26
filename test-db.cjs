const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new MongoClient(process.env.MONGODB_URI, { family: 4 });
    await client.connect();
    const db = client.db('LifeOS');
    const media = await db.collection('media').find({}).limit(10).toArray();
    console.log(media.map(m => ({ _id: m._id, type: typeof m._id, id: m.id, userId: m.userId })));
    client.close();
}
run();
