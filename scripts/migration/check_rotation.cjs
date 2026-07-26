const { MongoClient } = require('mongodb');

async function test() {
  const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
  await client.connect();
  const db = client.db('LifeOS');
  
  const doc = await db.collection('pending_accessions').findOne({ rotation: { $in: [90, 180, 270, -90] } });
  console.log('Rotated doc found:', doc ? 'YES, rotation=' + doc.rotation : 'NO');
  process.exit(0);
}
test().catch(console.error);
