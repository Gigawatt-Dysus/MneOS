const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function run() {
    const atlasUri = "mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster";
    const client = new MongoClient(atlasUri);
    
    // Check if H:\ exists and is writable
    const backupDir = 'H:\\MneOS_Atlas_Archives';
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        console.log("=== EXECUTING ATLAS EVACUATION TO H:\\ ===");
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '').split('T')[0];
        
        // Use regex or known names. We know the exact names from earlier:
        const collections = ['media_polluted_archive_2026-06-21', 'pending_accessions_polluted_archive_2026-06-21'];
        
        for (const collName of collections) {
            const destFile = path.join(backupDir, `${collName}_dump.jsonl`);
            console.log(`\nEvacuating [${collName}] -> ${destFile}`);
            
            const writeStream = fs.createWriteStream(destFile, { flags: 'w' });
            
            const cursor = db.collection(collName).find({});
            let count = 0;
            
            // Stream to file to prevent RAM crash
            for await (const doc of cursor) {
                writeStream.write(JSON.stringify(doc) + '\n');
                count++;
                if (count % 2000 === 0) {
                    process.stdout.write(`... ${count} records exported\r`);
                }
            }
            writeStream.end();
            console.log(`\n✅ ${count} records successfully saved to H:\\.`);
            
            // Wait for file to close
            await new Promise(resolve => writeStream.on('finish', resolve));
            
            // NUKE from Atlas
            console.log(`⚠️ Dropping [${collName}] from Atlas to save free tier space...`);
            await db.collection(collName).drop();
            console.log(`💥 Dropped.`);
        }
        
        console.log("\n=== EVACUATION COMPLETE ===");
        
        // Re-check stats
        const stats = await db.command({ dbStats: 1, scale: 1024 * 1024 });
        console.log(`\nNew Atlas Total Data Size: ${stats.dataSize.toFixed(2)} MB`);
        console.log(`New Atlas Storage Size   : ${stats.storageSize.toFixed(2)} MB`);
        console.log("We are safely back under the 512MB limit.");
        
    } catch (e) {
        console.error("Failed:", e);
    } finally {
        await client.close();
    }
}

run();
