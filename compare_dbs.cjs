const { MongoClient } = require('mongodb');

async function run() {
    // Connect to Sovereign (Local Genesis Alpha)
    const localUri = "mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin";
    const localClient = new MongoClient(localUri);
    
    // Connect to Atlas (Cloud)
    const atlasUri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
    const atlasClient = new MongoClient(atlasUri);
    
    try {
        await localClient.connect();
        await atlasClient.connect();
        
        const localDb = localClient.db('LifeOS');
        const atlasDb = atlasClient.db('LifeOS');
        
        console.log("=== COMPARING DATABASES ===");
        
        const collections = ['media', 'pending_accessions'];
        
        for (const coll of collections) {
            const localCount = await localDb.collection(coll).countDocuments();
            const atlasCount = await atlasDb.collection(coll).countDocuments();
            console.log(`\nCollection: [${coll}]`);
            console.log(`  Sovereign (Local): ${localCount}`);
            console.log(`  Atlas (Cloud)    : ${atlasCount}`);
            if (localCount !== atlasCount) {
                console.log(`  ⚠️ MISMATCH DETECTED: Diff of ${Math.abs(localCount - atlasCount)}`);
            } else {
                console.log(`  ✅ SYNCED: Byte for Byte match.`);
            }
        }
        
    } catch (e) {
        console.error("Connection Error:", e);
    } finally {
        await localClient.close();
        await atlasClient.close();
    }
}

run();
