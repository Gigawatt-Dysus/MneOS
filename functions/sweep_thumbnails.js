const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

async function runSweep() {
    console.log("🚀 Targeted Sensor Sweep for _DSC0037.JPG...");
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        const collectionsToSweep = ['pending_accessions', 'media'];
        
        for (const colName of collectionsToSweep) {
            console.log(`\n📡 Sweeping collection: [${colName}]`);
            const collection = db.collection(colName);
            
            const query = { id: "6a2a4242d53cd915bc593201" };
            
            const cursor = collection.find(query);
            
            for await (const doc of cursor) {
                console.log(`\n🎯 TARGET FOUND IN [${colName}]`);
                console.log(JSON.stringify(doc, null, 2));
            }
        }
        
    } catch (e) {
        console.error("❌ Sweep failed:", e);
    } finally {
        await client.close();
        console.log("\n🏁 Sensor Sweep Complete.");
    }
}

runSweep();
