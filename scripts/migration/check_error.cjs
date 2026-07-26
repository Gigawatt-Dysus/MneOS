const { MongoClient } = require('mongodb');

async function test() {
  const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
  await client.connect();
  const db = client.db('LifeOS');
  
  const doc1 = await db.collection('media').findOne({ processing_lock: { $regex: /^ERROR_VICTUS/ } });
  const doc2 = await db.collection('pending_accessions').findOne({ processing_lock: { $regex: /^ERROR_VICTUS/ } });
  
  console.log('Media ERROR:', doc1 ? doc1.processing_lock : 'None');
  console.log('Pending ERROR:', doc2 ? doc2.processing_lock : 'None');
  process.exit(0);
}
test().catch(console.error);
