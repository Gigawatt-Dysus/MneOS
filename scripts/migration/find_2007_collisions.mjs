import { MongoClient } from 'mongodb';

async function findCollisions() {
    const client = new MongoClient("mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin");
    try {
        await client.connect();
        const db = client.db('LifeOS');
        const mediaCol = db.collection('media');

        console.log("🕵️ Scanning for B2 Thumbnail Collisions...");

        // Find all media
        const allMedia = await mediaCol.find({}).toArray();
        
        // Map by thumbnail URL
        const thumbMap = new Map();
        
        for (const doc of allMedia) {
            const thumbUrl = doc.thumbnailUrls?.medium;
            if (!thumbUrl) continue;
            
            // Strip the cache-busting '?v=' tag from the URL to find physical collisions
            const rawUrl = thumbUrl.split('?')[0];
            
            if (!thumbMap.has(rawUrl)) {
                thumbMap.set(rawUrl, []);
            }
            thumbMap.get(rawUrl).push(doc);
        }

        let collisionFound = false;
        for (const [url, docs] of thumbMap.entries()) {
            if (docs.length > 1) {
                // We found a collision! Let's see if it looks like the 2007 Christmas photos
                const dates = docs.map(d => {
                    const ts = d.logicalDate || d.dateAdded;
                    if (!ts) return 'Unknown Date';
                    if (ts instanceof Date) return ts.toISOString();
                    if (typeof ts === 'number') return new Date(ts).toISOString();
                    return String(ts);
                });
                
                const is2007 = dates.some(d => String(d).includes('2007'));
                
                if (is2007) {
                    collisionFound = true;
                    console.log(`\n🚨 FOUND 2007 COLLISION!`);
                    console.log(`URL: ${url}`);
                    docs.forEach(d => {
                        console.log(`  -> ID: ${d._id}`);
                        console.log(`  -> Original Name: ${d.originalName || 'N/A'}`);
                        console.log(`  -> Title: ${d.title || 'N/A'}`);
                        console.log(`  -> Date: ${d.logicalDate ? new Date(d.logicalDate).toISOString() : 'N/A'}`);
                    });
                }
            }
        }
        
        if (!collisionFound) {
            console.log("\nNo specific 2007 collisions found. Showing top 5 generic collisions instead:");
            let i = 0;
            for (const [url, docs] of thumbMap.entries()) {
                if (docs.length > 1) {
                    console.log(`\nURL: ${url}`);
                    docs.forEach(d => console.log(`  -> ID: ${d._id} | Name: ${d.originalName}`));
                    i++;
                    if (i >= 5) break;
                }
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

findCollisions();
