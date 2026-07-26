const { MongoClient } = require('mongodb');

async function checkDb() {
  const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    // Check what the _id format looks like in chat_segments
    const recentSegments = await db.collection('chat_segments').find({}).sort({ timestamp: -1 }).limit(10).toArray();
    
    console.log("Found " + recentSegments.length + " chat segments.");
    if (recentSegments.length > 0) {
        console.log("Sample _ids:");
        recentSegments.forEach(s => console.log(s._id, s.userId));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

checkDb();
