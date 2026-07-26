const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb://zen:sovereign@100.116.12.18:27017";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('LifeOS');
    
    console.log("==================================================");
    console.log("🔍 EmoRAG Caption Quality Review");
    console.log("==================================================\n");

    const collections = ['pending_accessions', 'media'];
    let count = 0;

    for (const collName of collections) {
      const coll = db.collection(collName);
      
      const docs = await coll.find({ aiModel: "llava:13b" })
                             .sort({ aiProcessedAt: -1 })
                             .limit(10)
                             .toArray();
      
      for (const doc of docs) {
         count++;
         console.log(`🖼️ IMAGE: ${doc.originalName || doc.fileName || 'Unknown'}`);
         console.log(`🕒 DATE: ${doc.date || doc.createdAt}`);
         console.log(`📝 CAPTION: ${doc.caption}\n`);
      }
    }
    
    if (count === 0) {
        console.log("⚠️ No Llama 3.2 Vision captions found yet. Did you run the sweeper?");
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}
run();
