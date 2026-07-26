require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');

async function run() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');

    console.log('Searching media for pixel.gif...');
    const media = await db.collection('media').find({
        $or: [
            { "url": /pixel\.gif/i },
            { "originalName": /pixel\.gif/i }
        ]
    }).toArray();

    console.log(`Found ${media.length} media records to delete.`);

    if (media.length > 0) {
        const idsToDelete = media.map(m => m._id);
        const res = await db.collection('media').deleteMany({ _id: { $in: idsToDelete } });
        console.log(`Deleted ${res.deletedCount} media records.`);
        
        // Remove those mediaIds from events
        for (const mId of idsToDelete) {
            await db.collection('events').updateMany(
                { mediaIds: mId },
                { $pull: { mediaIds: mId } }
            );
        }
        console.log('Purged mediaIds from events.');
    }

    await client.close();
}

run().catch(console.error);
