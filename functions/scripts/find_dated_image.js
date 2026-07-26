const { MongoClient } = require('mongodb');
async function run() {
    const client = new MongoClient('mongodb://zen:sovereign@100.116.12.18:27017');
    await client.connect();
    
    // Find an image that actually has a date or timestamp
    const coll = client.db('LifeOS').collection('pending_accessions');
    const doc = await coll.findOne({ 
        $or: [
            { fileType: { $regex: "^image/", $options: "i" } },
            { type: "IMAGE" }
        ],
        timestamp: { $exists: true, $ne: null }
    });
    
    console.log("Image with timestamp:", doc ? doc.originalName : "NONE");

    const doc2 = await coll.findOne({ 
        $or: [
            { fileType: { $regex: "^image/", $options: "i" } },
            { type: "IMAGE" }
        ],
        date: { $exists: true, $ne: null }
    });

    console.log("Image with date:", doc2 ? doc2.originalName : "NONE");

    await client.close();
}
run();
