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
    const { action, ledgerId } = req.body;
    const db = await getDatabase();
    const chatCollection = db.collection('chat_segments');
    const ledgerCollection = db.collection('ledger');

    if (action === 'list') {
      const ledgerItems = await ledgerCollection.find({}).sort({ deletedAt: -1 }).toArray();
      return res.status(200).json({ success: true, data: ledgerItems });
    }

    if (action === 'rehydrate') {
      if (!ledgerId) {
        return res.status(400).json({ error: 'ledgerId is required.' });
      }

      const ledgerEntry = await ledgerCollection.findOne({ _id: ledgerId });
      if (!ledgerEntry) {
        return res.status(404).json({ error: 'Ledger entry not found.' });
      }

      const { originalDoc } = ledgerEntry;
      if (!originalDoc) {
        return res.status(400).json({ error: 'Ledger entry is missing original document.' });
      }

      // Re-insert original document into live collection
      await chatCollection.insertOne(originalDoc);

      // Remove the ledger recovery tombstone
      await ledgerCollection.deleteOne({ _id: ledgerId });

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action.' });
  } catch (error: any) {
    console.error("[rehydrateMessage] failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
