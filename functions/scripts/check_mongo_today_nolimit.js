const { MongoClient } = require('mongodb');

async function checkDb() {
  const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    // Find ALL segments from today! No limit!
    const todaySegments = await db.collection('chat_segments').find({ 
        $or: [
            { timestamp: { $gte: new Date('2026-05-25T00:00:00Z') } },
            { updatedAt: { $gte: new Date('2026-05-25T00:00:00Z') } },
            { timestamp: { $regex: /^2026-05-25/ } },
            { _id: { $regex: /17797/ } } // Timestamp for today in ms
        ]
    }).toArray(); // NO LIMIT!
    
    console.log("Total items updated/created today: " + todaySegments.length);
    
    // Filter specifically for items CREATED today (not just updated)
    const actuallyFromToday = todaySegments.filter(s => {
        if (typeof s.timestamp === 'string' && s.timestamp.startsWith('2026-05-25')) return true;
        if (s.timestamp instanceof Date && s.timestamp.toISOString().startsWith('2026-05-25')) return true;
        if (s._id.includes('17797')) return true; // msg-17797 is from today
        return false;
    });
    
    console.log("Total items CREATED today: " + actuallyFromToday.length);
    
    actuallyFromToday.forEach(s => {
        console.log(`ID: ${s._id}`);
        console.log(`timestamp: ${s.timestamp} (Type: ${typeof s.timestamp})`);
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
