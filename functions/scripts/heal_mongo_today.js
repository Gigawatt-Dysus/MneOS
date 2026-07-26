const { MongoClient } = require('mongodb');

async function healDb() {
  const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    // Find ALL segments from today where timestamp is an object (but NOT a Date, which MongoDB treats as type 'date', while {} is type 'object')
    // In MongoDB, BSON type 3 is object. Type 9 is Date.
    const brokenSegments = await db.collection('chat_segments').find({ 
        timestamp: { $type: "object" }
    }).toArray();
    
    console.log("Total broken timestamps to heal: " + brokenSegments.length);
    
    let healedCount = 0;
    for (let s of brokenSegments) {
        let newDate = s.updatedAt || new Date();
        
        // Extract timestamp from ID if possible
        const match = s._id.match(/msg-(\\d{13})/);
        if (match && match[1]) {
            newDate = new Date(parseInt(match[1]));
        }
        
        await db.collection('chat_segments').updateOne(
            { _id: s._id },
            { $set: { timestamp: newDate } }
        );
        healedCount++;
    }
    
    console.log(`Successfully healed ${healedCount} messages!`);
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

healDb();
