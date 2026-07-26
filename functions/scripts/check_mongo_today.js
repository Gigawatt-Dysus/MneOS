const { MongoClient } = require('mongodb');

async function checkDb() {
  const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    // Find segments where timestamp is a string AND starts with "2026-05-25"
    const todaySegments = await db.collection('chat_segments').find({ 
        timestamp: { $regex: /^2026-05-25/ }
    }).toArray();
    
    console.log("Found " + todaySegments.length + " chat segments from TODAY with STRING timestamp.");
    if (todaySegments.length > 0) {
        console.log("Sample string timestamps from today:");
        todaySegments.forEach(s => console.log(s._id, s.timestamp, s.content ? s.content.substring(0, 30) : ''));
    }
    
    // As a bonus, also look for actual Date objects from today
    const startOfToday = new Date('2026-05-25T00:00:00Z');
    const todayDateSegments = await db.collection('chat_segments').find({ 
        timestamp: { $gte: startOfToday }
    }).toArray();
    
    console.log("Found " + todayDateSegments.length + " chat segments from TODAY with DATE timestamp.");
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

checkDb();
