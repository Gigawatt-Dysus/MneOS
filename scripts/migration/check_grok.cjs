const { MongoClient } = require('mongodb');
const uri = "mongodb://zen:sovereign@100.116.12.18:27017";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    const collection = db.collection('media');
    
    const count = await collection.countDocuments({ aiModel: "grok-test" });
    console.log(`Documents with aiModel='grok-test': ${count}`);
    
    if (count > 0) {
        const docs = await collection.find({ aiModel: "grok-test" }).limit(2).toArray();
        console.log("Sample docs:", JSON.stringify(docs.map(d => ({ id: d._id, aiModel: d.aiModel })), null, 2));
    }
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
