const { MongoClient } = require('mongodb');
async function run() {
  const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
  await client.connect();
  const db = client.db('LifeOS');
  
  const mRes = await db.collection('media').updateMany({}, { $unset: { 'triage.summary': '' } });
  const pRes = await db.collection('pending_accessions').updateMany({}, { $unset: { 'triage.summary': '' } });
  
  console.log(`Hallucinations purged. Media: ${mRes.modifiedCount}, Pending: ${pRes.modifiedCount}`);
  process.exit(0);
}
run();
