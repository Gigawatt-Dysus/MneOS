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
  
  console.log('Counting pending_accessions...');
  const paCount = await db.collection('pending_accessions').countDocuments(query);
  console.log('pending_accessions count:', paCount);
  
  console.log('Counting media...');
  const mediaCount = await db.collection('media').countDocuments(query);
  console.log('media count:', mediaCount);
  
  process.exit(0);
}
check().catch(console.error);
