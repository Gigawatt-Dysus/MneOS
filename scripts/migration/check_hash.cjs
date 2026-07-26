const { MongoClient } = require('mongodb');
async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    const doc = await client.db('LifeOS').collection('pending_accessions').findOne({hash: {$exists: true}});
    console.log(doc ? doc.hash : 'No hash');
    process.exit(0);
}
run();
