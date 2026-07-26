const { MongoClient } = require('mongodb');

async function run() {
    const client = new MongoClient('mongodb://100.116.12.18:27017');
    await client.connect();
    const db = client.db('LifeOS');
    
    const pendingQuery = {
        $or: [
            { "thumbnailUrls.medium": { $exists: false } },
            { "thumbnailUrls.medium": null },
            { "thumbnailUrls.medium": "" }
        ]
    };
    
    const pendingCount = await db.collection('pending_accessions').countDocuments(pendingQuery);
    const mediaCount = await db.collection('media').countDocuments(pendingQuery);
    const totalPending = await db.collection('pending_accessions').countDocuments({});
    
    console.log(`Pending Missing Thumbs: ${pendingCount} / ${totalPending}`);
    console.log(`Media Missing Thumbs: ${mediaCount}`);
    
    client.close();
}

run();
