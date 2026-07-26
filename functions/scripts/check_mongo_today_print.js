const { MongoClient } = require('mongodb');

async function checkDb() {
  const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    const todaySegments = await db.collection('chat_segments').find({ 
        $or: [
            { timestamp: { $gte: new Date('2026-05-25T00:00:00Z') } },
            { updatedAt: { $gte: new Date('2026-05-25T00:00:00Z') } },
            { timestamp: { $regex: /^2026-05-25/ } },
            { _id: { $regex: /17797/ } } // Timestamp for today in ms
        ]
    }).limit(10).toArray();
    
    console.log("Printing items from today:");
    todaySegments.forEach(s => {
        console.log(`ID: ${s._id}`);
        console.log(`timestamp: ${s.timestamp} (Type: ${typeof s.timestamp})`);
        console.log(`updatedAt: ${s.updatedAt} (Type: ${typeof s.updatedAt})`);
        console.log(`content: ${s.content ? s.content.substring(0, 30) : ''}`);
        console.log('---');
    });
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

checkDb();
