require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');

async function run() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');

    const event = await db.collection('events').findOne({ "metadata.importSource": "blogspot" });
    if (!event) {
        console.log("No event found.");
        process.exit(0);
    }

    console.log(`Event Date: ${event.date}`);
    console.log(`Event MediaIds: ${JSON.stringify(event.mediaIds)}`);

    for (const id of event.mediaIds || []) {
        const media = await db.collection('media').findOne({ _id: id });
        if (media) {
            console.log(`Media ${id} logicalDate: ${media.logicalDate}`);
            console.log(`Media ${id} uploadDate: ${media.uploadDate}`);
            console.log(`Media ${id} date: ${media.date}`);
            console.log(`Media ${id} source: ${media.source}`);
        } else {
            console.log(`Media ${id} NOT FOUND.`);
        }
    }

    await client.close();
}
run().catch(console.error);
