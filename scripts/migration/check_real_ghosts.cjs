const { MongoClient } = require('mongodb');
async function check() { 
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin'); 
    await client.connect(); 
    const db = client.db('LifeOS'); 
    const c1 = await db.collection('pending_accessions').countDocuments({thumbnail_metadata_healed: true, thumbnailUrls: {$exists: false}}); 
    const c2 = await db.collection('media').countDocuments({thumbnail_metadata_healed: true, thumbnailUrls: {$exists: false}}); 
    console.log('Pending:', c1, 'Media:', c2, 'Total:', c1+c2); 
    await client.close(); 
} 
check().catch(console.error);
