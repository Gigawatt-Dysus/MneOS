import { MongoClient } from 'mongodb';

const MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017";

async function run() {
    console.log(`\n=========================================`);
    console.log(`[INIT] MneOS: Isolating Google "Auto-Enhanced" Files`);
    console.log(`=========================================\n`);

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db('LifeOS');
        const sourceColl = db.collection('pending_accessions');
        const targetColl = db.collection('google_edited');

        const cursor = sourceColl.find({ originalName: { $regex: '-edit', $options: 'i' } });
        let count = 0;
        const batchSize = 1000;
        let batch = [];

        for await (const doc of cursor) {
            batch.push(doc);
            if (batch.length >= batchSize) {
                await targetColl.insertMany(batch);
                const ids = batch.map(d => d._id);
                await sourceColl.deleteMany({ _id: { $in: ids } });
                count += batch.length;
                console.log(`⏳ Moved ${count} edited files...`);
                batch = [];
            }
        }

        if (batch.length > 0) {
            await targetColl.insertMany(batch);
            const ids = batch.map(d => d._id);
            await sourceColl.deleteMany({ _id: { $in: ids } });
            count += batch.length;
        }

        console.log(`\n=========================================`);
        console.log(`✅ COMPLETE: Safely quarantined ${count} files into 'google_edited' silo.`);
        console.log(`=========================================\n`);

    } finally {
        await client.close();
    }
}

run().catch(console.error);
