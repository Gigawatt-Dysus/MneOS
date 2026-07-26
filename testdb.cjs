const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'C:\\LifeOS\\.env.local' });

const userId = '9MPVGVTxE8dXvkCrl1XrWHQzCl23'; // Your legacy UID in MongoDB

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('LifeOS');
  const collection = db.collection('pending_accessions');

  // Simulate what sovereignDbQuery now does for pending_accessions
  const query = {
    $or: [
      { _id: { $regex: `^${userId}_` } },
      { userId: userId },
    ]
  };

  const count = await collection.countDocuments(query);
  console.log('[SIMULATION] sovereignDbQuery count result:', count);

  client.close();
}
run();
