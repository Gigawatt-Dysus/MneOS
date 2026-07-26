const { MongoClient } = require('mongodb');
async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    const db = client.db('LifeOS');
    await db.collection('pending_accessions').updateOne(
        { originalName: /0f363a10/i },
        { $set: { skipAI: true } }
    );
    console.log('Flagged skipAI');
    await client.close();
}
run().catch(console.error);
