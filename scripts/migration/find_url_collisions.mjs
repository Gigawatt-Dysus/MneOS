import { MongoClient } from 'mongodb';

async function findUrlCollisions() {
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

        for (const [url, docs] of urlMap.entries()) {
            if (docs.length > 1) {
                // Check if any are from 2007
                const is2007 = docs.some(d => JSON.stringify(d).includes('2007'));
                if (is2007) {
                    console.log(`\n🚨 FOUND 2007 URL COLLISION!`);
                    console.log(`URL: ${url}`);
                    docs.forEach(d => {
                        console.log(`  -> ID: ${d._id}`);
                        console.log(`  -> Title: ${d.title} | Desc: ${d.description ? d.description.substring(0,50) : ''}`);
                    });
                }
            }
        }
        console.log("Done checking URL collisions.");
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

findUrlCollisions();
