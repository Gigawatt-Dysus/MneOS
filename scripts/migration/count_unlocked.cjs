const { MongoClient } = require('mongodb');

async function test() {
  const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
  await client.connect();
  const db = client.db('LifeOS');
  
  const query = {
    fileType: { $regex: /^image\//i },
    thumbnail_metadata_healed: { $ne: true },
    processing_lock: { $exists: false }
  };
  
  const count1 = await db.collection('media').countDocuments(query);
  const count2 = await db.collection('pending_accessions').countDocuments(query);
  
  console.log('Unlocked Media:', count1);
  console.log('Unlocked Pending:', count2);
  process.exit(0);
}
test().catch(console.error);
