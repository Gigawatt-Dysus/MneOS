const { MongoClient } = require('mongodb');
async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    const doc = await client.db('LifeOS').collection('pending_accessions').findOne({ date: { $gte: "2020" } });
    console.log(JSON.stringify(doc, null, 2));
    await client.close();
}
run();
