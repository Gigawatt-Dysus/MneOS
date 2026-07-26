const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

function extractCoreName(url) {
    if (!url) return null;
    let parts = url.split('/');
    let filename = parts[parts.length - 1];
    
    // Remove query params
    filename = filename.split('?')[0];
    
    // Remove suffix junk
    filename = filename.replace(/__url$/, '');
    filename = filename.replace(/__thumbnailUrls\.medium$/, '');
    filename = filename.replace(/__thumbnailUrls\.small$/, '');
    filename = filename.replace(/__thumbnailUrls\.large$/, '');
    
    // Strip extensions (do it multiple times in case of .jpg.webp)
    filename = filename.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '');
    filename = filename.replace(/\.(webp|jpg|jpeg|png|gif)$/i, '');
    
    // Strip common thumbnail artifacts at the end
    filename = filename.replace(/_(medium|small|large|thumb)$/, '');
    filename = filename.replace(/-variant_(medium|small|large)$/, '');
    
    // Strip timestamps at the end if they are \d{13}
    filename = filename.replace(/_\d{13}$/, '');
    filename = filename.replace(/-\d{13}$/, '');
    
    // Strip timestamps at the beginning if they are \d{13}_
    filename = filename.replace(/^\d{13}_(medium_|small_|large_|thumb_)?/, '');
    filename = filename.replace(/^\d{13}-variant_(medium_|small_|large_)?/, '');
    filename = filename.replace(/^\d{13}-avatar_(variant_medium_)?/, '');
    filename = filename.replace(/^\d{13}_/, '');

    // Sometimes the remaining is just another timestamp
    filename = filename.replace(/^\d{13}$/, '');
    
    return filename.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function runSweep() {
    console.log("🚀 Sweeping for TRUE mismatches with refined algorithm...");
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        const collectionsToSweep = ['pending_accessions'];
        let totalFixed = 0;
        
        for (const colName of collectionsToSweep) {
            console.log(`\n📡 Sweeping collection: [${colName}]`);
            const collection = db.collection(colName);
            
            const cursor = collection.find({ "thumbnailUrls.medium": { $exists: true, $ne: null } });
            
            let mismatches = 0;
            const bulkOps = [];
            
            for await (const doc of cursor) {
                const mainUrl = doc.url;
                const thumbUrl = doc.thumbnailUrls.medium;
                
                if (!mainUrl || !thumbUrl) continue;
                if (thumbUrl === 'WIREFRAME_PLACEHOLDER') continue;
                
                let mainCore = extractCoreName(mainUrl);
                let thumbCore = extractCoreName(thumbUrl);
                
                if (!mainCore || !thumbCore) {
                    // if one becomes empty after stripping, they might have been pure timestamps. 
                    // Let's just skip unless we want to be very aggressive.
                    if (mainCore !== thumbCore) {
                        mismatches++;
                        bulkOps.push({
                            updateOne: {
                                filter: { _id: doc._id },
                                update: { $unset: { thumbnailUrls: "" } }
                            }
                        });
                    }
                    continue;
                }
                
                // If the cores don't match AND one is not a substring of the other
                if (mainCore !== thumbCore && !mainCore.includes(thumbCore) && !thumbCore.includes(mainCore)) {
                    mismatches++;
                    console.log(`🎯 TRUE MISMATCH:`);
                    console.log(`   ID        : ${doc._id}`);
                    console.log(`   Main      : ${mainUrl}`);
                    console.log(`   Thumb     : ${thumbUrl}`);
                    console.log(`   Core Diff : [${mainCore}] vs [${thumbCore}]`);
                    
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: doc._id },
                            update: { $unset: { thumbnailUrls: "" } }
                        }
                    });
                }
            }
            
            console.log(`✅ Found ${mismatches} TRUE mismatches in ${colName}.`);
            
            if (bulkOps.length > 0) {
                console.log(`🛠️ Executing ${bulkOps.length} fix operations...`);
                const result = await collection.bulkWrite(bulkOps);
                console.log(`✅ Fixed ${result.modifiedCount} records in ${colName}.`);
                totalFixed += result.modifiedCount;
            }
        }
        console.log(`\n🎉 Sweep Complete! Total repaired: ${totalFixed}`);
        
    } catch (e) {
        console.error("❌ Sweep failed:", e);
    } finally {
        await client.close();
    }
}

runSweep();
