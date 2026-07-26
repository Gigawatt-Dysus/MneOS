const { MongoClient } = require('mongodb');

async function checkDb() {
  const uri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    const collections = await db.listCollections().toArray();
    for (let col of collections) {
      const colName = col.name;
      const todaySegments = await db.collection(colName).find({ 
          $or: [
              { timestamp: { $gte: new Date('2026-05-25T00:00:00Z') } },
              { updatedAt: { $gte: new Date('2026-05-25T00:00:00Z') } },
              { timestamp: { $regex: /^2026-05-25/ } },
              { _id: { $regex: /17797/ } } // Timestamp for today in ms
          ]
      }).limit(5).toArray();
      
      if (todaySegments.length > 0) {
          console.log(`Found ${todaySegments.length} items from TODAY in collection: ${colName}`);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

checkDb();
