import { MongoClient } from 'mongodb';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const uri = process.env.MONGODB_URI || '';
const client = new MongoClient(uri, {
  family: 4,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000
});

let dbInstance: any = null;

async function getDatabase() {
  if (!dbInstance) {
    await client.connect();
    dbInstance = client.db('LifeOS');
  }
  return dbInstance;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { userId, collectionName = 'chat_segments' } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    const validCollections = ['chat_segments', 'events', 'tags'];
    if (!validCollections.includes(collectionName)) {
      return res.status(400).json({ error: 'Invalid collection scope requested.' });
    }

    const db = await getDatabase();
    const collection = db.collection(collectionName);

    const userIdStr = String(userId);
    const docs = await collection.find({
      _id: { $regex: `^${userIdStr}_` }
    }).toArray();

    return res.status(200).json({ success: true, data: docs });
  } catch (error: any) {
    console.error("[fetchPurificationPayload] failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
