const { MongoClient } = require('mongodb');
async function healGhosts() { 
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin'); 
    await client.connect(); 
    const db = client.db('LifeOS'); 
    const names = ['20230306_063720.jpg', '20251221_163536.jpg', '20251221_163541.jpg', '20251213_184958.jpg', '20251212_171745.jpg']; 
    
    const pRes = await db.collection('pending_accessions').updateMany({originalName: {$in: names}}, {$unset: {processing_error: ''}}); 
    console.log('pending_accessions healed:', pRes.modifiedCount);
    
    const mRes = await db.collection('media').updateMany({originalName: {$in: names}}, {$unset: {processing_error: ''}}); 
    console.log('media healed:', mRes.modifiedCount);

    console.log('Healed the final 5 survivors.'); 
    await client.close(); 
} 
healGhosts().catch(console.error);
