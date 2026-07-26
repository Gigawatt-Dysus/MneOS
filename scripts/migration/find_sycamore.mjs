import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://zen:sovereign@100.116.12.18:27017';
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db('LifeOS');

// Search for the string across originalName, title, description, narrative, etc.
const query = {
    $or: [
        { originalName: { $regex: 'Sycamore Park Elementary', $options: 'i' } },
        { title: { $regex: 'Sycamore Park Elementary', $options: 'i' } },
        { description: { $regex: 'Sycamore Park Elementary', $options: 'i' } },
        { narrative: { $regex: 'Sycamore Park Elementary', $options: 'i' } },
        { ocrText: { $regex: 'Sycamore Park Elementary', $options: 'i' } },
        { 'azureVibe.caption': { $regex: 'Sycamore Park Elementary', $options: 'i' } }
    ]
};

const docs = await db.collection('media').find(query).toArray();

console.log(`Found ${docs.length} matching records in 'media'.`);
docs.forEach(d => {
    console.log(`ID: ${d._id}`);
    console.log(`Name: ${d.originalName}`);
    console.log(`Rotation: ${d.rotation}`);
    console.log(`Dims: ${d.width}x${d.height}`);
    console.log(`ThumbUrls:`, d.thumbnailUrls);
    console.log(`Description/Narrative:`, d.description || d.narrative || d.azureVibe?.caption);
    console.log('---');
});

const airlockDocs = await db.collection('pending_accessions').find(query).toArray();
console.log(`Found ${airlockDocs.length} matching records in 'pending_accessions'.`);
airlockDocs.forEach(d => {
    console.log(`ID: ${d._id}`);
    console.log(`Name: ${d.originalName}`);
});

await client.close();
