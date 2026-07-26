const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });
const readline = require('readline');

async function runHUD() {
    const uris = [
        { name: 'Alpha Vault', uri: process.env.MONGODB_URI },
        { name: 'Atlas Cloud', uri: process.env.ATLAS_CLOUD_URI }
    ].filter(db => db.uri);

    const clients = [];
    const dbs = [];

    // Initialize connections
    for (const dbConfig of uris) {
        const client = new MongoClient(dbConfig.uri);
        await client.connect();
        clients.push(client);
        dbs.push({ name: dbConfig.name, db: client.db('LifeOS') });
    }

    console.clear();
    console.log("🚀 Initializing Genesis Swarm HUD...\n");

    let previousUnhealed = null;
    let startTime = Date.now();
    let startingUnhealed = 115189; // Known starting baseline from our diagnostic

    const drawHUD = async () => {
        let currentUnhealed = 0;
        let activeNodes = {};

        // Poll databases
        for (const { name, db } of dbs) {
            const collections = await db.listCollections().toArray();
            for (const col of collections) {
                const collection = db.collection(col.name);
                
                // Count remaining unhealed (excluding those permanently quarantined)
                const unhealedCount = await collection.countDocuments({
                    fileType: { $regex: /^image\//i },
                    thumbnail_metadata_healed: { $ne: true },
                    processing_lock: { $not: { $regex: /^ERROR_/ } }
                });
                currentUnhealed += unhealedCount;

                // Count active locks (who is working right now?)
                const locks = await collection.aggregate([
                    { $match: { 
                        processing_lock: { $exists: true, $not: { $regex: /^ERROR_/ } } 
                    } },
                    { $group: { _id: "$processing_lock", count: { $sum: 1 } } }
                ]).toArray();

                for (const lock of locks) {
                    if (lock._id) {
                        activeNodes[lock._id] = (activeNodes[lock._id] || 0) + lock.count;
                    }
                }

                // Count quarantined records
                const quarantined = await collection.countDocuments({
                    processing_lock: { $regex: /^ERROR_/ }
                });
                activeNodes['QUARANTINED'] = (activeNodes['QUARANTINED'] || 0) + quarantined;
            }
        }

        // Initialize starting base if first run
        if (previousUnhealed === null) {
            startingUnhealed = currentUnhealed;
            previousUnhealed = currentUnhealed;
        }

        // Calculate Velocity
        const elapsedMinutes = (Date.now() - startTime) / 60000;
        const totalHealedSinceStart = startingUnhealed - currentUnhealed;
        const velocityPerMinute = elapsedMinutes > 0 ? Math.round(totalHealedSinceStart / elapsedMinutes) : 0;
        
        // Calculate ETA
        let etaMinutes = velocityPerMinute > 0 ? Math.round(currentUnhealed / velocityPerMinute) : 0;
        const etaHours = Math.floor(etaMinutes / 60);
        const etaMins = etaMinutes % 60;
        const etaString = velocityPerMinute > 0 ? `${etaHours}h ${etaMins}m` : 'Calculating...';

        // Calculate Progress Bar
        const progressPercent = Math.min(100, Math.max(0, ((startingUnhealed - currentUnhealed) / startingUnhealed) * 100));
        const barLength = 40;
        const filledBar = Math.round((progressPercent / 100) * barLength);
        const bar = '█'.repeat(filledBar) + '░'.repeat(barLength - filledBar);

        // Render HUD
        console.clear();
        console.log(`================================================================`);
        console.log(` 🌐 GENESIS SWARM FORENSIC HUD  |  Time Active: ${Math.round(elapsedMinutes)} mins`);
        console.log(`================================================================\n`);
        
        console.log(` 🎯 REMAINING: ${currentUnhealed.toLocaleString()} files`);
        console.log(` 🚀 VELOCITY:  ${velocityPerMinute} files / minute`);
        console.log(` ⏳ ETA:       ${etaString}\n`);
        
        console.log(` 📊 PROGRESS:  [${bar}] ${progressPercent.toFixed(2)}%\n`);
        
        console.log(`--- ACTIVE SWARM NODES (Threads Locked) ---`);
        const nodes = Object.entries(activeNodes).filter(([node]) => node !== 'QUARANTINED');
        if (nodes.length === 0) {
            console.log(`    (No nodes currently engaged)`);
        } else {
            nodes.forEach(([node, threads]) => {
                console.log(`    🟢 [${node}] -> ${threads} concurrent threads grinding`);
            });
        }
        
        if (activeNodes['QUARANTINED']) {
            console.log(`\n--- QUARANTINED CASUALTIES (Locked & Bypassed) ---`);
            console.log(`    🛑 ${activeNodes['QUARANTINED']} fundamentally corrupted files safely isolated.`);
        }
        
        console.log(`\n================================================================`);
        console.log(` Press CTRL+C to exit dashboard. Auto-refreshing every 3s...`);

        previousUnhealed = currentUnhealed;
    };

    // Run loop
    while (true) {
        try {
            await drawHUD();
        } catch (e) {
            console.log("HUD Refresh Error:", e.message);
        }
        await new Promise(res => setTimeout(res, 3000));
    }
}

runHUD().catch(console.error);
