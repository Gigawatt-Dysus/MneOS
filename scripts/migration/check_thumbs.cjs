const { MongoClient } = require('mongodb');
async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    const db = client.db('LifeOS');
    const count = await db.collection('pending_accessions').countDocuments({
        thumbnailUrls: { $exists: false },
        fileType: { $regex: '^image/' }
    });
    console.log('Images missing thumbnails:', count);
    await client.close();
}
run().catch(console.error);
