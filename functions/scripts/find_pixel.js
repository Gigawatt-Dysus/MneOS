const { MongoClient } = require('mongodb');
async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    // find a PXL (Pixel phone) photo which usually means family
    const doc = await client.db('LifeOS').collection('pending_accessions').findOne({ originalName: /PXL/i });
    console.log(JSON.stringify(doc, null, 2));
    await client.close();
}
run();
