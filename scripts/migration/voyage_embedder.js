import { MongoClient } from 'mongodb';

// Attempt dynamic import of dotenv for local dev, fail gracefully if standard Node --env-file is used
try {
  const dotenv = await import('dotenv');
  dotenv.default.config({ path: '.env.local' });
  dotenv.default.config();
} catch (e) {
  // Silent fallback
}

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
if (!VOYAGE_API_KEY) {
  console.error("❌ VOYAGE_API_KEY is missing. Add it to .env.local or run with --env-file=.env.local");
  process.exit(1);
}

const uris = [
  'mongodb://zen:sovereign@localhost:27017',
  'mongodb://zen:sovereign@100.116.12.18:27017' // GGA Tailscale IP fallback
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getVoyageEmbedding(text) {
  const maxRetries = 5;
  let delay = 1000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Using Node.js native fetch (v18+)
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VOYAGE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: [text],
          model: 'voyage-4-large',
          output_dimension: 1024 // Matryoshka dimension truncation
        })
      });

      if (response.status === 429) {
        console.warn(`⚠️ Rate limited by Voyage API. Retrying in ${delay}ms...`);
        await sleep(delay);
        delay *= 2; 
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error("Invalid response structure from Voyage API.");
      }
      return data.data[0].embedding;

    } catch (err) {
      if (i === maxRetries - 1) throw err;
      console.warn(`⚠️ Network error. Retrying in ${delay}ms... (${err.message})`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

async function runEmbedder() {
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

  console.log(`✅ Voyage Embedder connected to MongoDB at ${connectedUri}`);
  const db = client.db('LifeOS');
  const collections = ['media', 'pending_accessions'];
  
  console.log("🚀 Polling for orphaned Moondream captions to embed (voyage-4-large / 1024d)...");

  while (true) {
    let processedAny = false;

    for (const collName of collections) {
      const collection = db.collection(collName);
      
      const query = { 
        caption: { $exists: true, $type: "string", $ne: "" }, 
        embedding: { $exists: false },
        embedding_error: { $exists: false } // Prevent infinite looping on poison records
      };

      // Process in small batches
      const pendingDocs = await collection.find(query).limit(5).toArray();

      for (const doc of pendingDocs) {
        processedAny = true;
        try {
          const preview = doc.caption.length > 40 ? doc.caption.substring(0, 40) + '...' : doc.caption;
          console.log(`📡 Embedding [${doc._id}] | ${preview}`);
          
          const startTime = Date.now();
          const vector = await getVoyageEmbedding(doc.caption);
          const latency = Date.now() - startTime;
          
          console.log(`   ✅ Success in ${latency}ms`);

          await collection.updateOne(
            { _id: doc._id },
            { $set: { embedding: vector } }
          );

        } catch (err) {
          console.error(`   ❌ Failed to embed [${doc._id}]:`, err.message);
          await collection.updateOne(
            { _id: doc._id },
            { $set: { embedding_error: err.message } }
          );
        }
      }
    }

    if (!processedAny) {
      // Idle backoff if no pending records
      await sleep(3000);
    }
  }
}

process.on('SIGINT', async () => {
  console.log("\n🛑 Terminating embedder loop safely...");
  process.exit(0);
});

runEmbedder();
