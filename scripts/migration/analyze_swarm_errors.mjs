import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://zen:sovereign@100.116.12.18:27017';
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db('LifeOS');

const errors = await db.collection('pending_accessions').aggregate([
    { $match: { processing_lock: { $regex: /^ERROR_/ } } },
    { $group: { _id: "$processing_error", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
]).toArray();

console.log("Top 10 Errors in pending_accessions:");
errors.forEach(e => console.log(`[${e.count}] ${e._id}`));

const errorsMedia = await db.collection('media').aggregate([
    { $match: { processing_lock: { $regex: /^ERROR_/ } } },
    { $group: { _id: "$processing_error", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
]).toArray();

console.log("\nTop 10 Errors in media:");
errorsMedia.forEach(e => console.log(`[${e.count}] ${e._id}`));

await client.close();
