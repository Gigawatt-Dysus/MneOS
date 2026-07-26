const { MongoClient } = require('mongodb');

async function createIndex() {
  const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    console.log("Creating compound index on userId and timestamp for chat_segments...");
    const result = await db.collection('chat_segments').createIndex(
      { userId: 1, timestamp: -1 }
    );
    
    console.log("Index created successfully:", result);
    
  } catch (e) {
    console.error("Failed to create index:", e);
  } finally {
    await client.close();
  }
}

createIndex();
