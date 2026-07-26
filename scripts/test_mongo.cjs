const { MongoClient } = require('mongodb');
async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    const db = client.db('LifeOS');
    const docs = await db.collection('pending_accessions').find({ 
        $and: [{ caption: /cat/i }, { caption: /car/i }] 
    }).limit(5).toArray();
    docs.forEach(d => console.log(d.originalName, '\n', d.caption, '\n'));
    await client.close();
}
run().catch(console.error);
