import { MongoClient } from 'mongodb';

async function findAllUrlCollisions() {
    const client = new MongoClient("mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin");
    try {
        await client.connect();
        const db = client.db('LifeOS');
        const mediaCol = db.collection('media');

        const allMedia = await mediaCol.find({}).toArray();
        const urlMap = new Map();
        
        for (const doc of allMedia) {
            const url = doc.url;
            if (!url) continue;
            
            const rawUrl = url.split('?')[0];
            if (!urlMap.has(rawUrl)) urlMap.set(rawUrl, []);
            urlMap.get(rawUrl).push(doc);
        }

        let collisionCount = 0;
        for (const [url, docs] of urlMap.entries()) {
            if (docs.length > 1) {
                const dates = docs.map(d => {
                    const d1 = d.logicalDate || d.dateAdded;
                    if (!d1) return '';
                    if (d1 instanceof Date) return d1.toISOString();
                    if (typeof d1 === 'number') return new Date(d1).toISOString();
                    return String(d1);
                });
                
                const originalNames = docs.map(d => d.originalName).join(', ');
                
                console.log(`\n🚨 COLLISION: ${url}`);
                docs.forEach((d, i) => {
                    console.log(`  -> ID: ${d._id} | Date: ${dates[i]} | Orig: ${d.originalName} | Title: ${d.title ? d.title.substring(0,40) : ''}`);
                });
                collisionCount++;
                if (collisionCount > 20) {
                    console.log("... Truncating further results.");
                    break;
                }
            }
        }
        console.log(`Total unique colliding URLs: ${collisionCount}`);
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

findAllUrlCollisions();
