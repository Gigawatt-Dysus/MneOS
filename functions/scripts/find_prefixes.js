const { MongoClient } = require('mongodb');
async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    
    const docs = await client.db('LifeOS').collection('pending_accessions')
        .find({ 
            $or: [
                { fileType: { $regex: "^image/", $options: "i" } },
                { type: "IMAGE" }
            ]
        })
        .limit(200)
        .toArray();
        
    const names = docs.map(d => d.originalName);
    
    // Group by prefix (e.g. DSC, IMG, etc)
    const prefixes = {};
    for (const name of names) {
        if (!name) continue;
        const prefix = name.substring(0, 4);
        prefixes[prefix] = (prefixes[prefix] || 0) + 1;
    }
    console.log(prefixes);

    await client.close();
}
run();
