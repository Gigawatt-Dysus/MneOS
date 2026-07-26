const { MongoClient } = require('mongodb');
async function heal() { 
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin'); 
    await client.connect(); 
    const db = client.db('LifeOS'); 
    const c1 = await db.collection('pending_accessions').updateMany(
        {thumbnail_metadata_healed: true, rotation: {$exists: true}}, 
        {$unset: {rotation: '', orientation: ''}}
    ); 
    const c2 = await db.collection('media').updateMany(
        {thumbnail_metadata_healed: true, rotation: {$exists: true}}, 
        {$unset: {rotation: '', orientation: ''}}
    ); 
    console.log('Pending updated:', c1.modifiedCount, 'Media updated:', c2.modifiedCount); 
    await client.close(); 
} 
heal().catch(console.error);
