import { MongoClient } from 'mongodb';

async function find2007OriginalNameCollisions() {
    const client = new MongoClient("mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin");
    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        const allMedia = [];
        for (const colName of ['media', 'pending_accessions']) {
            const docs = await db.collection(colName).find({}).toArray();
            docs.forEach(d => { d._col = colName; allMedia.push(d); });
        }
        
        console.log(`Scanning ${allMedia.length} total records...`);
        
        const nameMap = new Map();
        
        for (const doc of allMedia) {
            const dates = [doc.logicalDate, doc.dateAdded].map(d => {
                if (!d) return '';
                if (d instanceof Date) return d.toISOString();
                if (typeof d === 'number') return new Date(d).toISOString();
                return String(d);
            });
            
            const is2007 = dates.some(d => d.includes('2007'));
            if (!is2007) continue;
            
            let name = doc.originalName;
            // If originalName is missing, maybe we can extract from URL
            if (!name && doc.url) {
                const parts = doc.url.split('/');
                const filename = parts[parts.length - 1].split('?')[0];
                // strip timestamp: 1781035156171-highres-_DSC0070.JPG -> _DSC0070.JPG
                name = filename.replace(/^\d+-(highres-)?/, '');
            }
            if (!name) continue;
            
            const lowerName = name.toLowerCase();
            if (!nameMap.has(lowerName)) nameMap.set(lowerName, []);
            nameMap.get(lowerName).push(doc);
        }

        let foundCount = 0;
        for (const [name, docs] of nameMap.entries()) {
            if (docs.length > 1) {
                console.log(`\n🚨 2007 FILENAME COLLISION: ${name}`);
                docs.forEach((d) => {
                    const date = d.logicalDate ? new Date(d.logicalDate).toISOString() : 'N/A';
                    console.log(`  -> ID: ${d._id} [${d._col}] | Date: ${date} | URL: ${d.url}`);
                });
                foundCount++;
            }
        }
        
        if (foundCount === 0) {
            console.log("\nNo filename collisions found in 2007!");
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

find2007OriginalNameCollisions();
