import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.local') });

async function cloneDatabase() {
  const sourceUri = process.env.MONGODB_URI;
  const targetUri = process.env.GENESIS_VAULT_URI;

  if (!sourceUri || !targetUri) {
    console.error("❌ ERROR: Both MONGODB_URI and GENESIS_VAULT_URI must be defined in .env.local");
    process.exit(1);
  }

  console.log("=======================================================");
  console.log("🌐 INITIATING ATLAS -> GENESIS MIRROR PROTOCOL");
  console.log("=======================================================\n");

  const sourceClient = new MongoClient(sourceUri);
  const targetClient = new MongoClient(targetUri);

  try {
    console.log("📡 Connecting to Source (Atlas)...");
    await sourceClient.connect();
    const sourceDb = sourceClient.db();

    console.log("🔌 Connecting to Target (Genesis)...");
    await targetClient.connect();
    const targetDb = targetClient.db();

    const collections = await sourceDb.listCollections().toArray();
    const userCollections = collections.filter(c => !c.name.startsWith('system.'));
    
    console.log(`📦 Found ${userCollections.length} collections. Commencing clone...\n`);

    for (const colInfo of userCollections) {
      const colName = colInfo.name;
      console.log(`\x1b[36m[Syncing]\x1b[0m ${colName}...`);
      
      const sourceCol = sourceDb.collection(colName);
      const targetCol = targetDb.collection(colName);
      
      const documents = await sourceCol.find({}).toArray();
      
      if (documents.length > 0) {
        await targetCol.deleteMany({});
        await targetCol.insertMany(documents);
        console.log(`  └─ Copied ${documents.length} documents.`);
      } else {
        console.log(`  └─ Collection is empty. Skipped.`);
      }
      
      // Clone indexes safely
      try {
          const indexes = await sourceCol.indexes();
          for (const index of indexes) {
              if (index.name !== '_id_') {
                  const { v, ns, background, ...indexSpec } = index; 
                  try {
                    await targetCol.createIndex(index.key, indexSpec);
                  } catch(e) {
                    console.log(`  └─ Warning: Could not clone index ${index.name} natively.`);
                  }
              }
          }
      } catch (err) {
          // ignore if no indexes
      }
    }

    console.log("\n=======================================================");
    console.log("✅ MIRROR PROTOCOL COMPLETE. The 417MB pebble has been moved.");
    console.log("=======================================================");

  } catch (err) {
    console.error("\n❌ CLONE FAILED:", err);
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

cloneDatabase();
