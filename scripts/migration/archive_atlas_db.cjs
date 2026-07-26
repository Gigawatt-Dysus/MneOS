const { MongoClient } = require('mongodb');

async function run() {
    const atlasUri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
    const client = new MongoClient(atlasUri);
    
    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '').split('T')[0];
        
        console.log(`[Atlas Backup] Beginning Belt-and-Suspenders Archive Protocol...`);
        
        for (const coll of ['media', 'pending_accessions']) {
            const archiveName = `${coll}_polluted_archive_${timestamp}`;
            console.log(`\nArchiving [${coll}] -> [${archiveName}]`);
            
            // $out pipeline creates a full collection copy server-side
            await db.collection(coll).aggregate([
                { $match: {} },
                { $out: archiveName }
            ]).toArray();
            
            const count = await db.collection(archiveName).countDocuments();
            console.log(`✅ Success. ${count} records secured in [${archiveName}].`);
        }
        
        console.log("\n[Atlas Backup] Archive complete. The live collections can now be safely overwritten from Alpha when ready.");
        
    } catch (e) {
        console.error("[Atlas Backup] Failed:", e);
    } finally {
        await client.close();
    }
}

run();
