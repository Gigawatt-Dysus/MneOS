import { MongoClient } from 'mongodb';

const uris = [
  'mongodb://zen:sovereign@localhost:27017',
  'mongodb://zen:sovereign@100.116.12.18:27017' // GGA Tailscale IP fallback
];

async function resetForMoondream() {
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

  console.log("🔄 Resetting aiProcessed flags and scrubbing legacy fields...");

  try {
    const mediaResult = await db.collection('media').updateMany(
      {}, 
      { 
        $set: { aiProcessed: false },
        $unset: { caption: "", error_msg: "" } 
      }
    );

    const pendingResult = await db.collection('pending_accessions').updateMany(
      {}, 
      { 
        $set: { aiProcessed: false },
        $unset: { caption: "", error_msg: "" }
      }
    );

    console.log(`✅ Reset complete.`);
    console.log(`   media collection: ${mediaResult.modifiedCount} records updated`);
    console.log(`   pending_accessions: ${pendingResult.modifiedCount} records updated`);

  } catch (err) {
    console.error("❌ Reset failed:", err);
  } finally {
    await client.close();
  }
}

resetForMoondream();
