import { MongoClient } from 'mongodb';

const uris = [
  'mongodb://zen:sovereign@localhost:27017',
  'mongodb://zen:sovereign@100.116.12.18:27017' // GGA Tailscale IP fallback
];

async function check() {
  let client;
  let connectedUri;
  for (const uri of uris) {
    try {
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 });
      await client.connect();
      connectedUri = uri;
      break;
    } catch (e) {
      // Try next
    }
  }

  if (!client) {
    console.error("❌ Could not connect to sovereign MongoDB.");
    process.exit(1);
  }

  console.log(`✅ Connected to MongoDB at ${connectedUri}`);
  const db = client.db('LifeOS');
  
  for (const coll of ['media', 'pending_accessions']) {
    const total = await db.collection(coll).countDocuments();
    const pending = await db.collection(coll).countDocuments({ aiProcessed: false });
    const processed = await db.collection(coll).countDocuments({ aiProcessed: true });
    console.log(`\n📦 Collection: ${coll}`);
    console.log(`   Total Documents:   ${total}`);
    console.log(`   Pending (false):   ${pending}`);
    console.log(`   Legacy/Complete (true): ${processed}`);
  }

  await client.close();
}

check().catch(console.error);
