const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();
const uri = process.env.MONGODB_URI;

async function runSweep() {
    console.log("🚀 Sweeping for Lizzie...");
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        const collectionsToSweep = ['pending_accessions', 'media'];
        
        for (const colName of collectionsToSweep) {
            const collection = db.collection(colName);
            
            const query = {
                $and: [
                    { "thumbnailUrls.medium": { $exists: true, $ne: null } },
                    {
                        $or: [
                            { originalName: { $regex: /lizzie|pacifier|binky/i } },
                            { title: { $regex: /lizzie|pacifier|binky/i } },
                            { caption: { $regex: /lizzie|pacifier|binky/i } },
                            { description: { $regex: /lizzie|pacifier|binky/i } }
                        ]
                    }
                ]
            };
            
            const cursor = collection.find(query).limit(20);
            
            let found = 0;
            for await (const doc of cursor) {
                found++;
                console.log(`\n🎯 LIZZIE CANDIDATE IN [${colName}]`);
                console.log(`   ID          : ${doc._id}`);
                console.log(`   Title       : ${doc.title || doc.originalName || doc.caption}`);
                console.log(`   Main URL    : ${doc.url}`);
                console.log(`   Thumb Med   : ${doc.thumbnailUrls ? doc.thumbnailUrls.medium : 'NONE'}`);
                console.log(`   Thumb Small : ${doc.thumbnailUrls ? doc.thumbnailUrls.small : 'NONE'}`);
            }
            console.log(`Found ${found} candidates in ${colName}`);
        }
        
    } catch (e) {
        console.error("❌ Sweep failed:", e);
    } finally {
        await client.close();
    }
}

runSweep();
