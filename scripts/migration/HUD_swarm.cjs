require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin';

async function runHUD() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        console.clear();
        console.log(`\n======================================================`);
        console.log(`🛰️  MneOS GENESIS CLUSTER HUD : ATOMIC SWARM MONITOR`);
        console.log(`======================================================\n`);

        const collections = ['media', 'pending_accessions'];
        let totalAll = 0;
        let healedAll = 0;
        
        for (const colName of collections) {
            const col = db.collection(colName);
            const total = await col.countDocuments({ fileType: { $regex: /^image\//i } });
            const healed = await col.countDocuments({ fileType: { $regex: /^image\//i }, thumbnail_metadata_healed: true });
            const locked = await col.countDocuments({ processing_lock: { $exists: true } });
            const errors = await col.countDocuments({ processing_error: { $exists: true } });

            totalAll += total;
            healedAll += healed;

            const percentage = total === 0 ? 0 : ((healed / total) * 100).toFixed(2);
            
            console.log(`📦 Collection: ${colName.toUpperCase()}`);
            console.log(`------------------------------------------------------`);
            console.log(`Total Images : ${total.toLocaleString()}`);
            console.log(`Healed       : ${healed.toLocaleString()} (${percentage}%)`);
            console.log(`Active Locks : ${locked.toLocaleString()}`);
            if (errors > 0) console.log(`Errors       : ${errors.toLocaleString()}`);
            console.log(`\n`);
        }

        const globalPercentage = totalAll === 0 ? 0 : ((healedAll / totalAll) * 100).toFixed(2);
        console.log(`======================================================`);
        console.log(`GLOBAL SWARM PROGRESS: ${globalPercentage}%`);
        console.log(`======================================================\n`);
        
    } catch (err) {
        console.error("HUD Error:", err.message);
    } finally {
        await client.close();
    }
}

runHUD();
setInterval(runHUD, 3000);
