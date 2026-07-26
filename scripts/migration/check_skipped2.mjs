import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://zen:sovereign@100.116.12.18:27017';
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db('LifeOS');

const healedWithThumbs = await db.collection('pending_accessions').countDocuments({ 
    thumbnail_metadata_healed: true,
    thumbnailUrls: { $exists: true }
});

const healedWithoutThumbs = await db.collection('pending_accessions').countDocuments({ 
    thumbnail_metadata_healed: true,
    thumbnailUrls: { $exists: false }
});

console.log(`[Airlock] Healed with thumbs (ACTUALLY processed): ${healedWithThumbs}`);
console.log(`[Airlock] Healed WITHOUT thumbs (SKIPPED by the if-statement): ${healedWithoutThumbs}`);

await client.close();
