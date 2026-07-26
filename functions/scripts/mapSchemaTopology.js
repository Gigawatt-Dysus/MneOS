const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// 1. Manually parse environment variables from functions/.env
function loadEnv() {
  const envPath = path.join(__dirname, '../.env');
  if (!fs.existsSync(envPath)) {
    console.error(`❌ [Topology Inventory] Error: .env file not found at ${envPath}`);
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    // Strip comments
    const cleanLine = line.split('#')[0].trim();
    if (!cleanLine) return;
    const equalIdx = cleanLine.indexOf('=');
    if (equalIdx > 0) {
      const key = cleanLine.substring(0, equalIdx).trim();
      const val = cleanLine.substring(equalIdx + 1).trim();
      env[key] = val;
    }
  });
  return env;
}

async function run() {
  console.log("🛰️ [SCHEMA INVENTORY] Initializing Non-Destructive Atlas Topology Scan...");
  
  const env = loadEnv();
  const uri = env.MONGODB_URI;
  if (!uri) {
    console.error("❌ [SCHEMA INVENTORY] Error: MONGODB_URI not found in environment configuration!");
    process.exit(1);
  }

  console.log("🔗 Connecting to MongoDB Atlas cluster...");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('LifeOS');
    const collection = db.collection('chat_segments');

    console.log("🔍 Scanning 'chat_segments' collection...");
    const docs = await collection.find({}).toArray();
    const totalCount = docs.length;

    console.log(`✅ Loaded ${totalCount} records. Analyzing data topology...\n`);

    // Quantitative metrics
    let companionIdPresent = 0;
    let companionIdMissing = 0;

    let authorIdPresent = 0;
    let authorIdMissing = 0;
    const authorIdFrequency = {};

    let fictionOnly = 0;
    let isFictionOnly = 0;
    let bothFictionFields = 0;
    let neitherFictionFields = 0;

    const legacyDay0Docs = [];

    // Structural loop
    docs.forEach(doc => {
      // 1. companionId check
      if ('companionId' in doc && doc.companionId !== undefined && doc.companionId !== null) {
        companionIdPresent++;
      } else {
        companionIdMissing++;
      }

      // 2. nested author.id check
      if (doc.author && typeof doc.author === 'object') {
        if ('id' in doc.author && doc.author.id !== undefined && doc.author.id !== null) {
          authorIdPresent++;
          const authId = String(doc.author.id);
          authorIdFrequency[authId] = (authorIdFrequency[authId] || 0) + 1;
        } else {
          authorIdMissing++;
        }
      } else {
        authorIdMissing++;
      }

      // 3. fiction vs is_fiction check
      const hasFiction = 'fiction' in doc;
      const hasIsFiction = 'is_fiction' in doc;

      if (hasFiction && hasIsFiction) {
        bothFictionFields++;
      } else if (hasFiction && !hasIsFiction) {
        fictionOnly++;
      } else if (!hasFiction && hasIsFiction) {
        isFictionOnly++;
      } else {
        neitherFictionFields++;
      }

      // 4. "Day 0" legacy structures detection
      // Standard messages should have: 'role', 'content', 'timestamp' (or logicalDate/createdDate)
      const hasStandardRole = 'role' in doc;
      const hasStandardContent = 'content' in doc;
      const hasStandardTime = 'timestamp' in doc || 'createdAt' in doc || 'uploadDate' in doc;

      if (!hasStandardRole || !hasStandardContent || !hasStandardTime) {
        legacyDay0Docs.push({
          id: doc._id || doc.id,
          keys: Object.keys(doc),
          snippet: doc.content || doc.description || doc.title || JSON.stringify(doc).substring(0, 100)
        });
      }
    });

    // Output formatting (Premium Matrix Topology Representation)
    console.log("==================================================================================");
    console.log("                      MONGODB ATLAS CHAT_SEGMENTS TOPOLOGY MATRIX                  ");
    console.log("==================================================================================");
    console.log(`TOTAL RECORDS REVIEWED : ${totalCount}`);
    console.log("----------------------------------------------------------------------------------");
    
    console.log("\n📊 1. COMPANION ID REGISTRY STATUS:");
    console.log(`  • companionId Present : ${companionIdPresent.toString().padEnd(6)} (${((companionIdPresent/totalCount)*100).toFixed(1)}%)`);
    console.log(`  • companionId Missing : ${companionIdMissing.toString().padEnd(6)} (${((companionIdMissing/totalCount)*100).toFixed(1)}%)`);

    console.log("\n👤 2. NESTED AUTHOR IDENTITY SPECTRUM:");
    console.log(`  • author.id Present   : ${authorIdPresent.toString().padEnd(6)} (${((authorIdPresent/totalCount)*100).toFixed(1)}%)`);
    console.log(`  • author.id Missing   : ${authorIdMissing.toString().padEnd(6)} (${((authorIdMissing/totalCount)*100).toFixed(1)}%)`);
    console.log("  • Unique author.id Distribution:");
    Object.entries(authorIdFrequency).forEach(([id, count]) => {
      console.log(`    - '${id}' : ${count} messages`);
    });

    console.log("\n📚 3. FICTIONALITY SCHEMATIC SPLIT:");
    console.log(`  • 'fiction' Field Only    : ${fictionOnly.toString().padEnd(6)} (${((fictionOnly/totalCount)*100).toFixed(1)}%)`);
    console.log(`  • 'is_fiction' Field Only  : ${isFictionOnly.toString().padEnd(6)} (${((isFictionOnly/totalCount)*100).toFixed(1)}%)`);
    console.log(`  • Both Fields Present      : ${bothFictionFields.toString().padEnd(6)} (${((bothFictionFields/totalCount)*100).toFixed(1)}%)`);
    console.log(`  • Neither Field Present    : ${neitherFictionFields.toString().padEnd(6)} (${((neitherFictionFields/totalCount)*100).toFixed(1)}%)`);

    console.log("\n👾 4. LEGACY 'DAY 0' STRUCTURES OR DEVIANT SCHEMAS:");
    console.log(`  • Deviant Records Found   : ${legacyDay0Docs.length}`);
    if (legacyDay0Docs.length > 0) {
      console.log("  • Sample Deviants (Top 3):");
      legacyDay0Docs.slice(0, 3).forEach((d, idx) => {
        console.log(`    [${idx + 1}] ID: ${d.id}`);
        console.log(`        Attributes present : [${d.keys.join(', ')}]`);
        console.log(`        Content Snippet    : "${d.snippet}"`);
      });
    } else {
      console.log("  • 0 deviant records detected. The collection strictly conforms to modern message schemas.");
    }
    console.log("==================================================================================");
    console.log("                         [READ-ONLY ANALYSIS SCAN COMPLETE]                       ");
    console.log("==================================================================================");

  } catch (error) {
    console.error("❌ [SCHEMA INVENTORY] Error during scan:", error);
  } finally {
    await client.close();
    console.log("🔌 Connection closed successfully.");
  }
}

run();
