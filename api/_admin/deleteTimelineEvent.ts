import { MongoClient } from 'mongodb';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

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

const sha256 = (text: string) => crypto.createHash('sha256').update(text).digest('hex');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { userId, eventId } = req.body;
    if (!userId || !eventId) {
      return res.status(400).json({ error: 'userId and eventId are required.' });
    }

    const db = await getDatabase();
    const eventsCollection = db.collection('events');
    const ledgerCollection = db.collection('ledger');

    const userIdStr = String(userId);
    const eventKey = `${userIdStr}_${eventId}`;

    const originalDoc = await eventsCollection.findOne({ _id: eventKey });
    if (!originalDoc) {
      return res.status(404).json({ error: 'Timeline event not found in database.' });
    }

    // Generate SHA-256 and insert forensic tombstone
    const contentStr = originalDoc.details || originalDoc.description || '';
    const ledgerEntry = {
      _id: `ledger_${crypto.randomUUID()}`,
      originalId: originalDoc._id,
      checksum: sha256(contentStr),
      deletedAt: new Date(),
      operator: "Eric Carl Douglas Cornett",
      backupText: contentStr.substring(0, 500),
      originalDoc: originalDoc
    };

    await ledgerCollection.insertOne(ledgerEntry);
    await eventsCollection.deleteOne({ _id: eventKey });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[deleteTimelineEvent] failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
