require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function test() {
  const uri = process.env.MONGODB_URI;
  console.log(`Connecting to ${uri.replace(/:sovereign@/, ':***@')} ...`);
  const client = new MongoClient(uri, { family: 4, serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    console.log("Connected successfully!");
    const db = client.db('LifeOS');
    const user = await db.collection('users').findOne({ _id: '9MPVGVTxE8dXvkCrl1XrWHQzCl23' });
    console.log("Found user:", !!user);
  } catch (err) {
    console.error("Connection failed:", err.message);
  } finally {
    await client.close();
  }
}
test();
