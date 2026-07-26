const { MongoClient } = require('mongodb');

async function unlock() {
  const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin');
  await client.connect();
  const db = client.db('LifeOS');
  
  console.log('Clearing EXACT VICTUS locks...');
  const res1 = await db.collection('media').updateMany({ processing_lock: 'VICTUS' }, { $unset: { processing_lock: '', locked_at: '' } });
  const res2 = await db.collection('pending_accessions').updateMany({ processing_lock: 'VICTUS' }, { $unset: { processing_lock: '', locked_at: '' } });
  
  console.log('Unlocked media:', res1.modifiedCount, 'Unlocked pending:', res2.modifiedCount);
  process.exit(0);
}
unlock().catch(console.error);
