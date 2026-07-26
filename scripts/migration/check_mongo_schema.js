import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkUploadedData() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db('gigi-time-machine');
        
        const doc = await db.collection('pending_accessions').findOne({});
        console.log("Sample doc:", JSON.stringify(doc, null, 2));

        const count = await db.collection('pending_accessions').countDocuments();
        console.log(`Total count: ${count}`);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

checkUploadedData();
