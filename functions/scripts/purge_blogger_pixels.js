require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');

async function run() {
    console.log('\n=======================================================');
    console.log('dYOO PURGING THE BLOG BOOSTER PIXEL');
    console.log('=======================================================\n');

    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');

    const events = await db.collection('events').find({ "metadata.importSource": "blogspot" }).toArray();
    console.log(`[*] Found ${events.length} Blogger events to scan.`);

    let patchedCount = 0;

    for (const event of events) {
        if (!event.details) continue;
        
        // Remove markdown image syntax for theblogbooster.com/pixel.gif
        const regex = /!\[.*?\]\(http:\/\/theblogbooster\.com\/pixel\.gif\)/gi;
        if (regex.test(event.details)) {
            const newDetails = event.details.replace(regex, '');
            const res = await db.collection('events').updateOne(
                { _id: event._id },
                { $set: { details: newDetails } }
            );
            if (res.modifiedCount > 0) {
                console.log(`  [OK] Patched Event ${event._id}`);
                patchedCount++;
            }
        }
    }

    console.log('=======================================================');
    console.log(`dY"S [REPORT] Patched ${patchedCount} Event records.`);
    console.log('=======================================================\n');
    await client.close();
}

run().catch(console.error);
