const { MongoClient } = require('mongodb');

async function checkDb() {
  const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    // Find segments with NaN in the _id
    const nanSegments = await db.collection('chat_segments').find({ 
        _id: { $regex: /NaN/ }
    }).toArray();
    
    console.log("Found " + nanSegments.length + " chat segments with NaN in ID.");
    if (nanSegments.length > 0) {
        console.log("Sample NaN IDs:");
        nanSegments.forEach(s => console.log(s._id));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

checkDb();
