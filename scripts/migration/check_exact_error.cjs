const { MongoClient } = require('mongodb');

async function test() {
  const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
  await client.connect();
  const db = client.db('LifeOS');
  
  const doc = await db.collection('media').findOne({ processing_lock: { $regex: /^ERROR_VICTUS/ } });
  if (doc) console.log('ERROR:', doc.processing_lock);
  else {
    const doc2 = await db.collection('pending_accessions').findOne({ processing_lock: { $regex: /^ERROR_VICTUS/ } });
    if (doc2) console.log('ERROR:', doc2.processing_lock);
    else console.log('No ERROR_VICTUS found.');
  }
  process.exit(0);
}
test().catch(console.error);
