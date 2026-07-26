require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');

async function run() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');
    
    // Find a media object with logicalDate
    const media = await db.collection('media').findOne({ logicalDate: { $exists: true } });
    console.log(JSON.stringify(media, null, 2));
    
    await client.close();
}

run().catch(console.error);
