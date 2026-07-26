const { MongoClient } = require('mongodb');

async function run() {
    const atlasUri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
    const client = new MongoClient(atlasUri);
    
    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        console.log("=== ATLAS STORAGE DIAGNOSTIC ===");
        
        const stats = await db.command({ dbStats: 1, scale: 1024 * 1024 }); // Return size in MB
        console.log(`Total Database Data Size : ${stats.dataSize.toFixed(2)} MB`);
        console.log(`Total Storage Size (Disk): ${stats.storageSize.toFixed(2)} MB`);
        console.log(`Objects (Documents)      : ${stats.objects}`);
        
        console.log("\n--- Breakdown ---");
        const collections = ['media_polluted_archive_2026-06-21', 'pending_accessions_polluted_archive_2026-06-21', 'media', 'pending_accessions'];
        
        for (const coll of collections) {
            const collStats = await db.command({ collStats: coll, scale: 1024 * 1024 });
            console.log(`[${coll}]`);
            console.log(`  Data Size   : ${collStats.size.toFixed(2)} MB`);
            console.log(`  Storage Size: ${collStats.storageSize.toFixed(2)} MB (Compressed)`);
        }
        
    } catch (e) {
        console.error("Failed to fetch stats:", e);
    } finally {
        await client.close();
    }
}

run();
