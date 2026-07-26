import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://zen:sovereign@100.116.12.18:27017';
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db('LifeOS');

// Find a known image from the screenshots, like the selfie or the cat or the girl with bread
// We'll search by checking if it has a processing_lock or thumbnail_metadata_healed
const docs = await db.collection('media').find({ thumbnail_metadata_healed: true }).limit(5).toArray();

console.log("Sample records that were HEALED by Swarm:");
docs.forEach(d => {
    console.log(`ID: ${d.id}`);
    console.log(`Name: ${d.originalName}`);
    console.log(`Dims: ${d.width}x${d.height}`);
    console.log(`Rotation: ${d.rotation}`);
    console.log(`Thumbnails:`, d.thumbnailUrls);
    console.log('---');
});

// Let's specifically find records that have rotation > 0 (the cat)
const cat = await db.collection('media').find({ rotation: 90 }).limit(1).toArray();
if (cat.length) {
    console.log("CAT (rotation 90):");
    console.log(`Name: ${cat[0].originalName}`);
    console.log(`Healed by swarm? ${cat[0].thumbnail_metadata_healed}`);
    console.log(`Thumbnails:`, cat[0].thumbnailUrls);
}

await client.close();
