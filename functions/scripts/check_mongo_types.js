const { MongoClient } = require('mongodb');

async function checkDb() {
  const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    // Sort by timestamp: 1 and see what we get
    const stringTimestampSegments = await db.collection('chat_segments').find({ 
        timestamp: { $type: "string" }
    }).limit(10).toArray();
    
    console.log("Found " + stringTimestampSegments.length + " chat segments with STRING timestamp.");
    if (stringTimestampSegments.length > 0) {
        console.log("Sample string timestamps:");
        stringTimestampSegments.forEach(s => console.log(s._id, s.timestamp));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

checkDb();
