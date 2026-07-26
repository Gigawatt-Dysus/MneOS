const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function unlockErrors() {
  console.log('Connecting to database...');
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db('LifeOS');

  const query = {
    fileType: { $regex: /^image/i },
    thumbnail_metadata_healed: { $ne: true },
    processing_lock: { $regex: /^ERROR_/ }
  };

  const update = {
    $unset: { processing_lock: "", processing_error: "" }
  };

  console.log('Unlocking errors in pending_accessions...');
  const paResult = await db.collection('pending_accessions').updateMany(query, update);
  console.log(`Unlocked ${paResult.modifiedCount} records in pending_accessions.`);

  console.log('Unlocking errors in media...');
  const mResult = await db.collection('media').updateMany(query, update);
  console.log(`Unlocked ${mResult.modifiedCount} records in media.`);

  await c.close();
  console.log('All error locks cleared. Ready for Swarm.');
}

unlockErrors().catch(console.error);
