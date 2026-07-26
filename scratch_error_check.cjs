const { MongoClient } = require('mongodb');
async function run() {
    const c = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await c.connect();
    const db = c.db('LifeOS');
    const res = await db.collection('pending_accessions').aggregate([
        { $match: { processing_error: { $exists: true } } },
        { $group: { _id: "$processing_error", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]).toArray();
    console.log(res);
    await c.close();
}
run();
