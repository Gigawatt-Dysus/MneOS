const { MongoClient } = require('mongodb');

async function test() {
  const client = new MongoClient('mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster');
  try {
    await client.connect();
    const db = client.db('LifeOS');
    const collection = db.collection('chat_segments');
    
    console.log("Running query without allowDiskUse...");
    try {
        const cursor1 = collection.find({_id: {$regex: '^9MPVGVTxE'}})
            .project({base64Data: 0, embedding: 0})
            .sort({timestamp: -1})
            .limit(5000);
        await cursor1.toArray();
        console.log("Query 1 succeeded!");
    } catch (e) {
        console.error("Query 1 failed:", e.message);
    }

    console.log("\nRunning query WITH allowDiskUse...");
    try {
        const cursor2 = collection.find({_id: {$regex: '^9MPVGVTxE'}})
            .project({base64Data: 0, embedding: 0})
            .sort({timestamp: -1})
            .allowDiskUse()
            .limit(5000);
        await cursor2.toArray();
        console.log("Query 2 succeeded!");
    } catch (e) {
        console.error("Query 2 failed:", e.message);
    }
  } finally {
    await client.close();
  }
}
test();
