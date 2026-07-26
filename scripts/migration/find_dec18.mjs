import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://zen:sovereign@100.116.12.18:27017';
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db('LifeOS');

// Find the sideways image from December 18th, 2025
// Dimensions are 1868x4000
const docs = await db.collection('media').find({
    width: 1868,
    height: 4000
}).toArray();

console.log(`Found ${docs.length} docs with 1868x4000`);
docs.forEach(d => {
    console.log(`Name: ${d.originalName}`);
    console.log(`Rotation: ${d.rotation}`);
    console.log(`Thumbnail Healed: ${d.thumbnail_metadata_healed}`);
    console.log(`ThumbUrls:`, d.thumbnailUrls);
    console.log('---');
});

await client.close();
