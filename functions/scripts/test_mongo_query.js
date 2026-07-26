const { MongoClient } = require('mongodb');

async function test() {
  const client = new MongoClient('mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster');
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    // Create the indices
    await db.collection('chat_segments').createIndex({ timestamp: -1 });
    await db.collection('chat_segments').createIndex({ timestamp: 1 });
    console.log('Index created!');
    
    // Test the query
    const docs = await db.collection('chat_segments').find({ 
        _id: { $regex: '^9MPVGVTxE8dXvkCrl1XrWHQzCl23_' }, 
        timestamp: { $gt: new Date('2024-01-01') } 
    }).sort({timestamp: -1}).limit(5000).toArray();
    
    console.log('Query successful! Docs:', docs.length);
  } catch(e) {
    console.log('Query Failed: ' + e.message);
  } finally {
    await client.close();
  }
}
test();
