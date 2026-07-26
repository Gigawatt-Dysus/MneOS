const { MongoClient } = require('mongodb');

async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    const db = client.db('LifeOS');
    
    const doc = await db.collection('pending_accessions').findOne({ originalName: /0f363a10/i });
    if(doc) console.log('Found in pending_accessions:', doc.originalName);
    else console.log('Not in pending_accessions');
    
    const doc2 = await db.collection('media').findOne({ originalName: /0f363a10/i });
    if(doc2) console.log('Found in media:', doc2.originalName);
    else console.log('Not in media');
    
    await client.close();
}
run().catch(console.error);
