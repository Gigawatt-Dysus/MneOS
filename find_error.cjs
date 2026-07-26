const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'C:/LifeOS/.env.local' });

async function run() {
    const client = new MongoClient(process.env.MONGODB_URI || process.env.VITE_MONGODB_URI);
    await client.connect();
    const db = client.db();
    
    console.log("Searching media...");
    const docs1 = await db.collection('media').find({ error_msg: { $exists: true } }).toArray();
    docs1.forEach(d => console.log(`MEDIA: ${d.url} (File: ${d.originalName || d.title}) - ${d.error_msg}`));

    console.log("Searching pending_accessions...");
    const docs2 = await db.collection('pending_accessions').find({ error_msg: { $exists: true } }).toArray();
    docs2.forEach(d => console.log(`PENDING: ${d.url} (File: ${d.originalName || d.title}) - ${d.error_msg}`));

    process.exit(0);
}

run();
