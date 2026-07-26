const { MongoClient } = require('mongodb');

async function run() {
    const localUri = "mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin";
    const atlasUri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
    
    const localClient = new MongoClient(localUri);
    const atlasClient = new MongoClient(atlasUri);
    
    try {
        await localClient.connect();
        await atlasClient.connect();
        
        const localDb = localClient.db('LifeOS');
        const atlasDb = atlasClient.db('LifeOS');
        
        console.log("=== CROSS-REFERENCE DIAGNOSTIC ===");
        
        for (const coll of ['media', 'pending_accessions']) {
            console.log(`\nAnalyzing [${coll}]...`);
            
            // Get all IDs from Atlas
            const atlasDocs = await atlasDb.collection(coll).find({}, { projection: { _id: 1, id: 1, updatedAt: 1, dateAdded: 1 } }).toArray();
            const atlasIds = new Set(atlasDocs.map(d => d.id || d._id.toString()));
            
            // Get all IDs from Local
            const localDocs = await localDb.collection(coll).find({}, { projection: { _id: 1, id: 1, updatedAt: 1, dateAdded: 1 } }).toArray();
            const localIds = new Set(localDocs.map(d => d.id || d._id.toString()));
            
            // Check for Atlas orphans (in Atlas, but NOT in Local)
            const atlasOrphans = atlasDocs.filter(d => !localIds.has(d.id || d._id.toString()));
            console.log(`  Records in Atlas but missing from Local: ${atlasOrphans.length}`);
            
            // Check for timestamps
            const hasTimestamps = atlasDocs.some(d => d.updatedAt || d.dateAdded);
            console.log(`  Timestamps present in schema: ${hasTimestamps ? '✅ YES' : '❌ NO'}`);
            
            // Check for version conflicts (newer in Atlas)
            let newerInAtlas = 0;
            const localMap = new Map(localDocs.map(d => [d.id || d._id.toString(), d]));
            
            for (const aDoc of atlasDocs) {
                const lDoc = localMap.get(aDoc.id || aDoc._id.toString());
                if (lDoc) {
                    const aTime = new Date(aDoc.updatedAt || aDoc.dateAdded || 0).getTime();
                    const lTime = new Date(lDoc.updatedAt || lDoc.dateAdded || 0).getTime();
                    if (aTime > lTime) {
                        newerInAtlas++;
                    }
                }
            }
            
            console.log(`  Records where Atlas is explicitly newer than Local: ${newerInAtlas}`);
        }
        
    } catch (e) {
        console.error(e);
    } finally {
        await localClient.close();
        await atlasClient.close();
    }
}

run();
