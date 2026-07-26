import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://zen:sovereign@100.116.12.18:27017';
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db('LifeOS');

async function checkHealed(colName) {
    const col = db.collection(colName);
    const total = await col.countDocuments();
    const healedFlag = await col.countDocuments({ thumbnail_metadata_healed: true });
    const quarantined = await col.countDocuments({ processing_lock: { $regex: /^ERROR_/ } });
    const locked = await col.countDocuments({ processing_lock: { $exists: true, $not: { $regex: /^ERROR_/ } } });
    
    return { total, healedFlag, quarantined, locked };
}

const mediaStats = await checkHealed('media');
const airlockStats = await checkHealed('pending_accessions');

console.log(`--- COLLECTION: media ---`);
console.log(`Total: ${mediaStats.total}`);
console.log(`thumbnail_metadata_healed=true: ${mediaStats.healedFlag}`);
console.log(`QUARANTINED (ERROR_): ${mediaStats.quarantined}`);
console.log(`LOCKED (Working): ${mediaStats.locked}`);

console.log(`\n--- COLLECTION: pending_accessions (Airlock) ---`);
console.log(`Total: ${airlockStats.total}`);
console.log(`thumbnail_metadata_healed=true: ${airlockStats.healedFlag}`);
console.log(`QUARANTINED (ERROR_): ${airlockStats.quarantined}`);
console.log(`LOCKED (Working): ${airlockStats.locked}`);

await client.close();
