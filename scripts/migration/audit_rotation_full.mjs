import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://zen:sovereign@100.116.12.18:27017';
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db('LifeOS');

async function checkCollection(colName) {
    const col = db.collection(colName);
    const total = await col.countDocuments();
    const rot0 = await col.countDocuments({ $or: [{ rotation: 0 }, { rotation: null }, { rotation: { $exists: false } }] });
    const rotSet = await col.countDocuments({ rotation: { $gt: 0 } });
    return { total, rot0, rotSet };
}

const mediaStats = await checkCollection('media');
const airlockStats = await checkCollection('pending_accessions');

console.log(`--- COLLECTION: media ---`);
console.log(`Total: ${mediaStats.total}`);
console.log(`Unhealed (rotation 0/null/missing): ${mediaStats.rot0}`);
console.log(`Healed (rotation > 0): ${mediaStats.rotSet}`);

console.log(`\n--- COLLECTION: pending_accessions (Airlock) ---`);
console.log(`Total: ${airlockStats.total}`);
console.log(`Unhealed (rotation 0/null/missing): ${airlockStats.rot0}`);
console.log(`Healed (rotation > 0): ${airlockStats.rotSet}`);

const totalItems = mediaStats.total + airlockStats.total;
const totalUnhealed = mediaStats.rot0 + airlockStats.rot0;
const totalHealed = mediaStats.rotSet + airlockStats.rotSet;

console.log(`\n--- GRAND TOTAL ---`);
console.log(`Total Files: ${totalItems}`);
console.log(`Total Unhealed: ${totalUnhealed}`);
console.log(`Total Healed: ${totalHealed}`);

await client.close();
