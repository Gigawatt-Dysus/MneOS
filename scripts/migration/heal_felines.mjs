import { MongoClient } from 'mongodb';

const MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017";
const DB_NAME = "LifeOS";

async function healFelines() {
    console.log(`\n=========================================`);
    console.log(`[INIT] MneOS Feline Rotation Healer`);
    console.log(`=========================================\n`);

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection('media');

        console.log("🔍 Scanning for incorrectly rotated Google Photos assets in the Matrix...");
        
        // Find documents from May 17th and 19th
        const query = {
            $or: [
                { logicalDate: { $gte: new Date('2026-05-19T00:00:00Z'), $lte: new Date('2026-05-19T23:59:59Z') } },
                { logicalDate: { $gte: new Date('2026-05-17T00:00:00Z'), $lte: new Date('2026-05-17T23:59:59Z') } },
                { logicalDate: { $regex: '2026-05-19' } },
                { logicalDate: { $regex: '2026-05-17' } }
            ]
        };

        const cursor = collection.find(query).sort({ logicalDate: -1 }).limit(20);
        
        for await (const doc of cursor) {
            console.log(`- ${doc.originalName || doc._id} | Date: ${doc.logicalDate} | Rot: ${doc.rotation} | WxH: ${doc.width}x${doc.height} | Src: ${doc.source}`);
        }

        console.log(`\n=========================================`);
        console.log(`🎉 Diagnostic query complete.`);
        console.log(`=========================================\n`);
    } catch (e) {
        console.error("❌ Healing failed:", e);
    } finally {
        await client.close();
    }
}

healFelines().catch(console.error);
