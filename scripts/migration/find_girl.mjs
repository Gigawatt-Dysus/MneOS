import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://zen:sovereign@100.116.12.18:27017';
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db('LifeOS');

// Search for the girl with bread or cat by date
const dateTarget = new Date('2026-04-24T00:00:00.000Z');
const docs = await db.collection('media').find({
    logicalDate: {
        $gte: new Date('2026-04-23T00:00:00.000Z'),
        $lt: new Date('2026-04-26T00:00:00.000Z')
    }
}).toArray();

console.log(`Found ${docs.length} docs in 'media' around April 24, 2026`);
docs.forEach(d => {
    console.log(`Name: ${d.originalName}`);
    console.log(`Rotation: ${d.rotation}`);
    console.log(`Thumbnail Healed: ${d.thumbnail_metadata_healed}`);
    console.log(`ThumbUrls:`, d.thumbnailUrls);
    console.log('---');
});

await client.close();
