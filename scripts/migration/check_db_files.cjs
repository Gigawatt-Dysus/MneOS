const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
  await client.connect();
  const db = client.db('LifeOS');
  const res = await db.collection('pending_accessions').aggregate([{ $group: { _id: '$fileType', count: { $sum: 1 } } }]).toArray();
  console.log(res);
  process.exit(0);
}
run();
