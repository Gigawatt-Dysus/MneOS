require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');

async function run() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');

    const events = await db.collection('events').find({ "metadata.importSource": "blogspot" }).toArray();
    console.log(`[*] Found ${events.length} Blogger events to scan.`);

    let patchedCount = 0;

    for (const event of events) {
        if (!event.mediaIds || event.mediaIds.length === 0) continue;
        
        const eventLogicalDate = new Date(event.date).toISOString();

        for (const mediaId of event.mediaIds) {
            const res = await db.collection('media').updateOne(
                { _id: mediaId },
                { $set: { 
                    logicalDate: eventLogicalDate, 
                    datePrecision: 'day',
                    uploadDate: new Date(event.date),
                    date: new Date(event.date),
                    updatedAt: new Date()
                } }
            );
            if (res.modifiedCount > 0) {
                console.log(`  [OK] Patched Media ${mediaId} with Event Date: ${eventLogicalDate}`);
                patchedCount++;
            }
        }
    }

    console.log(`[REPORT] Patched ${patchedCount} Media records.`);
    await client.close();
}

run().catch(console.error);
