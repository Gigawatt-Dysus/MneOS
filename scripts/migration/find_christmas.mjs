import { MongoClient } from 'mongodb';

async function find2007MissingOrChristmas() {
    const client = new MongoClient("mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin");
    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        for (const colName of ['media', 'pending_accessions']) {
            const col = db.collection(colName);
            
            // Look for any docs from 2007 with 'christmas' or missing dimensions
            const allDocs = await col.find({}).toArray();
            
            console.log(`\n--- Scanning ${colName} ---`);
            let count = 0;
            
            for (const doc of allDocs) {
                const dates = [doc.logicalDate, doc.dateAdded].map(d => {
                    if (!d) return '';
                    if (d instanceof Date) return d.toISOString();
                    if (typeof d === 'number') return new Date(d).toISOString();
                    return String(d);
                });
                
                const is2007 = dates.some(d => d.includes('2007'));
                const hasChristmas = JSON.stringify(doc).toLowerCase().includes('christmas');
                const hasZeroDim = doc.width === 0 || doc.height === 0 || !doc.width || !doc.height;
                
                if (is2007 || hasChristmas) {
                    if (hasChristmas) {
                        console.log(`🎄 CHRISTMAS FOUND [${colName}]: ID=${doc._id} | Date=${dates[0]} | Title=${doc.title} | OriginalName=${doc.originalName} | WxH=${doc.width}x${doc.height}`);
                        count++;
                    } else if (hasZeroDim) {
                        console.log(`⚠️ ZERO DIMENSIONS 2007 [${colName}]: ID=${doc._id} | Date=${dates[0]} | Title=${doc.title}`);
                        count++;
                    }
                }
            }
            if (count === 0) console.log("No hits found.");
        }
        
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

find2007MissingOrChristmas();
