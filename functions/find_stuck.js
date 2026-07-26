const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
  await client.connect();
  const db = client.db('LifeOS');
  const doc = await db.collection('media').findOne({ aiProcessed: true, reviewStatus: { $ne: 'completed' } }, { sort: { aiProcessedAt: -1 } });
  console.log(doc);
  await client.close();
}
run();
