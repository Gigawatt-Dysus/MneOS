const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function run() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('LifeOS');
    
    // Find records that failed due to fetch error and reset them
    const res = await db.collection('media').updateMany(
        { rotation_error: { $exists: true } }, 
        { 
            $set: { needs_thumbnail_rebuild: true }, 
            $unset: { rotation_error: "" } 
        }
    );
    
    const res2 = await db.collection('pending_accessions').updateMany(
        { rotation_error: { $exists: true } }, 
        { 
            $set: { needs_thumbnail_rebuild: true }, 
            $unset: { rotation_error: "" } 
        }
    );
    
    console.log('Media fixed:', res.modifiedCount);
    console.log('Pending fixed:', res2.modifiedCount);
    await client.close();
}

run().catch(console.error);
