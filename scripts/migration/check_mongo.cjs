const { MongoClient } = require('mongodb');
const uri = "mongodb://zen:sovereign@100.116.12.18:27017";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        const db = client.db("LifeOS");
        const doc = await db.collection("pending_accessions").findOne({ aiProcessed: true });
        console.log(doc);
    } finally {
        await client.close();
    }
}
run();
