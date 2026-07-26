const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
  await client.connect();
  const db = client.db('LifeOS');
  
  const query = {
    fileType: { $regex: /^image\// },
    thumbnail_metadata_healed: { $ne: true },
    processing_lock: { $exists: false }
  };
  
  console.log('Testing findOne on pending_accessions...');
  const doc = await db.collection('pending_accessions').findOne(query);
  console.log('Result:', doc ? doc._id : null);
  
  console.log('Testing findOneAndUpdate on pending_accessions...');
  const updated = await db.collection('pending_accessions').findOneAndUpdate(query, { $set: { processing_lock: "TEST" } });
  console.log('Updated:', updated ? updated._id : null);
  
  process.exit(0);
}
check().catch(console.error);
