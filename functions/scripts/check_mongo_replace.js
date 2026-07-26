const { MongoClient } = require('mongodb');

async function checkDb() {
  const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    // Simulate what sovereignDbWrite does
    const keyId = '9MPVGVTxE8dXvkCrl1XrWHQzCl23_msg-test-123';
    const payload = {
        _id: keyId,
        id: 'msg-test-123',
        userId: '9MPVGVTxE8dXvkCrl1XrWHQzCl23',
        content: 'Test message',
        timestamp: new Date(),
        updatedAt: new Date()
    };
    
    const result = await db.collection('chat_segments').replaceOne(
        { _id: keyId },
        payload,
        { upsert: true }
    );
    
    console.log("replaceOne result:", result);
    
  } catch (e) {
    console.error("Error during replaceOne:", e);
  } finally {
    await client.close();
  }
}

checkDb();
