const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();
const uri = process.env.MONGODB_URI;

async function runSweep() {
    console.log("🚀 Sweeping for ID across all collections...");
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        const collections = await db.listCollections().toArray();
        const targetIdStr = "6a2a4242d53cd915bc593201";
        
        for (const colInfo of collections) {
            const colName = colInfo.name;
            const collection = db.collection(colName);
            
            let query;
            try {
                query = { $or: [{ id: targetIdStr }, { _id: targetIdStr }, { _id: new ObjectId(targetIdStr) }] };
            } catch (e) {
                query = { $or: [{ id: targetIdStr }, { _id: targetIdStr }] };
            }
            
            const doc = await collection.findOne(query);
            
            if (doc) {
                console.log(`\n🎯 TARGET FOUND IN [${colName}]`);
                console.log(JSON.stringify(doc, null, 2));
            }
        }
        
    } catch (e) {
        console.error("❌ Sweep failed:", e);
    } finally {
        await client.close();
    }
}

runSweep();
