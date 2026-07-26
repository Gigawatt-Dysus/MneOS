const { MongoClient } = require('mongodb');
async function check() { 
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin'); 
    await client.connect(); 
    const db = client.db('LifeOS'); 
    const docs = await db.collection('media').find({ 'thumbnailUrls.medium': { $regex: '178205' } }).toArray(); 
    console.log('Count:', docs.length); 
    await client.close(); 
} 
check().catch(console.error);
