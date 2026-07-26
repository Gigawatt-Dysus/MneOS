require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');

async function run() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');
    
    // Find events with bloghooster
    const events = await db.collection('events').find({ "details": { $regex: /bloghooster/i } }).limit(2).toArray();
    for(const e of events) {
        console.log("ID:", e._id);
        console.log("DETAILS:", e.details.substring(0, 500));
    }
    
    await client.close();
}

run().catch(console.error);
