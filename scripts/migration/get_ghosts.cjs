const { MongoClient } = require('mongodb');
async function getGhosts() { 
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin'); 
    await client.connect(); 
    const db = client.db('LifeOS'); 
    const cols = await db.listCollections().toArray(); 
    for(const c of cols) { 
        const docs = await db.collection(c.name).find({thumbnail_metadata_healed: true, processing_error: {$exists: true}}).toArray(); 
        if(docs.length > 0) { 
            console.log('Collection: ' + c.name); 
            docs.forEach(d => console.log(' - ' + (d.originalName || d.fileName))); 
        } 
    } 
    await client.close(); 
} 
getGhosts().catch(console.error);
