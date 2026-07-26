const { MongoClient } = require('mongodb');

async function checkDb() {
  const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    // Find ALL segments with string timestamp
    const allStringSegments = await db.collection('chat_segments').find({ 
        timestamp: { $type: "string" }
    }).toArray();
    
    console.log("Total string timestamps: " + allStringSegments.length);
    
    // Filter in memory for today
    const today = allStringSegments.filter(s => s.timestamp.includes('2026-05-25'));
    console.log("Total from today: " + today.length);
    if (today.length > 0) {
        console.log("Sample ID:", today[0]._id);
    }
    
    // Also check for timestamps that might be numbers!
    const allNumberSegments = await db.collection('chat_segments').find({ 
        timestamp: { $type: "number" }
    }).toArray();
    console.log("Total number timestamps: " + allNumberSegments.length);
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

checkDb();
