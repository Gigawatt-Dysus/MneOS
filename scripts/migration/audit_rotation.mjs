import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://zen:sovereign@100.116.12.18:27017';
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db('LifeOS');
const col = db.collection('media');

const total = await col.countDocuments();
const rot0 = await col.countDocuments({ $or: [{ rotation: 0 }, { rotation: null }, { rotation: { $exists: false } }] });
const rotSet = await col.countDocuments({ rotation: { $gt: 0 } });

console.log(`Total media: ${total}`);
console.log(`rotation=0 or missing: ${rot0}`);
console.log(`rotation > 0 (healed): ${rotSet}`);

// Rotation value distribution
const rotValues = await col.aggregate([
    { $group: { _id: "$rotation", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
]).toArray();
console.log('\nRotation value distribution:');
rotValues.forEach(r => console.log(`  rotation=${r._id}: ${r.count} records`));

// Sample un-healed records
const sample = await col.find(
    { $or: [{ rotation: 0 }, { rotation: null }, { rotation: { $exists: false } }] }
).sort({ _id: -1 }).limit(10).project({ id: 1, width: 1, height: 1, rotation: 1, originalName: 1 }).toArray();
console.log('\nSample un-healed records (rotation=0 or missing):');
sample.forEach(r => console.log(`  ${r.originalName || r.id} => ${r.width}x${r.height} rot:${r.rotation}`));

// Also check: how many have width > height (raw landscape sensor) BUT rotation > 0 (needs display rotation)?
const landscapeWithRot = await col.countDocuments({ 
    $expr: { $gt: ["$width", "$height"] }, 
    rotation: { $in: [90, 6] } 
});
console.log(`\nLandscape pixels + rotation 90 or 6 (confirmed sideways thumbnails): ${landscapeWithRot}`);

// And how many are landscape pixels with rotation 0 (could be legitimately landscape OR un-healed)?
const landscapeNoRot = await col.countDocuments({ 
    $expr: { $gt: ["$width", "$height"] }, 
    $or: [{ rotation: 0 }, { rotation: null }, { rotation: { $exists: false } }]
});
console.log(`Landscape pixels + rotation 0/missing (ambiguous): ${landscapeNoRot}`);

await client.close();
