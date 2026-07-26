import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const mongoUri = process.env.MONGODB_URI;

async function checkMongo() {
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db("LifeOS");
    const collection = db.collection("chat_segments");

    const docs = await collection.find({ userId: 'eric_cornett', is_lab_import: true }).toArray();
    console.log(`Found ${docs.length} imported docs`);
    if (docs.length > 0) {
      console.log('Sample doc:', docs[0]);
    }
  } finally {
    await client.close();
  }
}

checkMongo().catch(console.error);
