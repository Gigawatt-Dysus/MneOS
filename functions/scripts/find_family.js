const { MongoClient } = require('mongodb');
async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    
    // Find documents with a string date that starts with 2024, 2025, or 2026
    const docs = await client.db('LifeOS').collection('pending_accessions')
        .find({ 
            aiProcessed: false,
            date: { $regex: /^(2024|2025|2026)/ }
        })
        .limit(5)
        .toArray();
        
    console.log("FOUND BY DATE STRING:");
    docs.forEach(d => console.log(d.originalName, d.date));

    // Also check for timestamp numbers
    const docs2 = await client.db('LifeOS').collection('pending_accessions')
        .find({ 
            aiProcessed: false,
            timestamp: { $gt: 1704067200000 } // 2024
        })
        .limit(5)
        .toArray();

    console.log("FOUND BY TIMESTAMP NUMBER:");
    docs2.forEach(d => console.log(d.originalName, new Date(d.timestamp)));

    await client.close();
}
run();
