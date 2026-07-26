import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkUploadedData() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db();
        
        // Check exact schema of one pending doc
        const sampleDoc = await db.collection('pending_accessions').findOne();
        
        let pendingBytes = 0;
        let mediaBytes = 0;

        if (sampleDoc) {
             const sizeField = sampleDoc.size !== undefined ? "$size" : "$metadata.size";
             const pendingAgg = await db.collection('pending_accessions').aggregate([
                 { $group: { _id: null, totalBytes: { $sum: sizeField }, count: { $sum: 1 } } }
             ]).toArray();
             pendingBytes = pendingAgg[0]?.totalBytes || 0;
        }

        const mediaAgg = await db.collection('media').aggregate([
            { $group: { _id: null, totalBytes: { $sum: "$metadata.size" }, count: { $sum: 1 } } }
        ]).toArray();

        mediaBytes = mediaAgg[0]?.totalBytes || 0;
        const totalUploadedGB = (pendingBytes + mediaBytes) / (1024 ** 3);

        console.log(`\n=== MONGODB UPLOADED TOTAL ===`);
        console.log(`Total Uploaded to B2 : ${totalUploadedGB.toFixed(2)} GB`);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkUploadedData();
