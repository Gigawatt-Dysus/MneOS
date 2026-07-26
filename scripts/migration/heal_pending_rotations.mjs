import { MongoClient } from 'mongodb'; 

const MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017";
const DB_NAME = "LifeOS";

async function healRotations() {
    console.log(`\n=========================================`);
    console.log(`[INIT] MneOS Pending Accessions Rotation Healer`);
    console.log(`=========================================\n`);

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('pending_accessions');

        const query = { rotation: { $in: [90, 180, 270, -90, -180, -270] } };
        const cursor = collection.find(query);
        
        let count = 0;
        let swapCount = 0;
        let justZeroCount = 0;

        const bulkOps = [];

        for await (const doc of cursor) {
            let newWidth = doc.width;
            let newHeight = doc.height;
            let needsSwap = false;

            if ([90, 270, -90, -270].includes(doc.rotation)) {
                if (doc.width && doc.height) {
                    newWidth = doc.height;
                    newHeight = doc.width;
                    needsSwap = true;
                    swapCount++;
                } else {
                    justZeroCount++;
                }
            } else {
                justZeroCount++;
            }

            const updateFields = { rotation: 0 };
            if (needsSwap) {
                updateFields.width = newWidth;
                updateFields.height = newHeight;
            }

            bulkOps.push({
                updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: updateFields }
                }
            });

            count++;

            if (bulkOps.length >= 1000) {
                await collection.bulkWrite(bulkOps);
                console.log(`Processed ${count} records...`);
                bulkOps.length = 0;
            }
        }

        if (bulkOps.length > 0) {
            await collection.bulkWrite(bulkOps);
        }

        console.log(`\n=========================================`);
        console.log(`[SUCCESS] Rotation Healing Complete!`);
        console.log(`Total fixed: ${count}`);
        console.log(`Dimension swapped: ${swapCount}`);
        console.log(`Rotation zeroed only: ${justZeroCount}`);
        console.log(`=========================================\n`);
    } catch (e) {
        console.error("[ERROR] Healing failed:", e);
    } finally {
        await client.close();
    }
}

healRotations().catch(console.error);
