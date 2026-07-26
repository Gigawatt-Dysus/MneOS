const { MongoClient } = require('mongodb');
async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    const count = await client.db('LifeOS').collection('pending_accessions').countDocuments({ 
        originalName: { $not: /^DSC/i }, 
        aiProcessed: false, 
        $or: [ 
            { fileType: { $regex: '^image/', $options: 'i' } }, 
            { type: 'IMAGE' } 
        ] 
    }); 
    console.log('Non-DSC images:', count); 
    await client.close();
}
run();
