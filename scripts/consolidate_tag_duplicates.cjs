const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Deep merge helper for metadata objects
function mergeMetadata(primary, fragment) {
    if (!fragment) return;
    if (!primary) primary = {};

    for (const [key, val] of Object.entries(fragment)) {
        // Skip empty fragment values
        if (val === null || val === undefined || val === '') continue;
        if (Array.isArray(val) && val.length === 0) continue;
        if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) continue;

        if (!primary[key]) {
            // Primary lacks this field, inherit from fragment
            primary[key] = val;
        } else if (Array.isArray(primary[key]) && Array.isArray(val)) {
            // Append arrays without duplicating strings
            const mergedArray = [...primary[key]];
            for (const item of val) {
                if (typeof item === 'string') {
                    if (!mergedArray.includes(item)) mergedArray.push(item);
                } else {
                    mergedArray.push(item); // Objects like face descriptors push normally
                }
            }
            primary[key] = mergedArray;
        } else if (typeof primary[key] === 'object' && typeof val === 'object') {
            // Deep merge objects (like address, dates)
            mergeMetadata(primary[key], val);
        }
    }
}

(async () => {
    const cloudUri = process.env.ATLAS_CLOUD_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/LifeOS';
    const localUri = 'mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin';
    
    const cloudClient = new MongoClient(cloudUri);
    const localClient = new MongoClient(localUri);

    try {
        console.log('Connecting to databases to run consolidation...');
        await cloudClient.connect();
        await localClient.connect();
        
        const cloudDb = cloudClient.db('LifeOS');
        const localDb = localClient.db('LifeOS');

        const allTags = await cloudDb.collection('tags').find({}).toArray();
        const groupedByName = {};
        
        for (const tag of allTags) {
            const nameKey = (tag.name || 'UNNAMED').toLowerCase().trim();
            if (!groupedByName[nameKey]) groupedByName[nameKey] = [];
            groupedByName[nameKey].push(tag);
        }

        const logStream = fs.createWriteStream(path.join(__dirname, '..', 'scratch', 'consolidation_log.txt'));
        
        let mergedCount = 0;
        let deletedCount = 0;

        for (const [nameKey, tags] of Object.entries(groupedByName)) {
            if (tags.length > 1 && nameKey !== 'unnamed') {
                // Determine the Primary tag (sort by richest metadata/media)
                tags.sort((a, b) => {
                    const scoreA = (a.mediaIds ? a.mediaIds.length : 0) * 10 + (a.metadata ? Object.keys(a.metadata).length : 0);
                    const scoreB = (b.mediaIds ? b.mediaIds.length : 0) * 10 + (b.metadata ? Object.keys(b.metadata).length : 0);
                    return scoreB - scoreA;
                });

                const primary = tags[0];
                const fragments = tags.slice(1);
                
                logStream.write(`\n--- CONSOLIDATING: ${primary.name} ---\n`);
                logStream.write(`Primary ID: ${primary.id || primary._id}\n`);

                let needsUpdate = false;

                for (const frag of fragments) {
                    logStream.write(`Merging Fragment ID: ${frag.id || frag._id}\n`);

                    // Merge Media
                    if (frag.mediaIds && frag.mediaIds.length > 0) {
                        if (!primary.mediaIds) primary.mediaIds = [];
                        const oldLen = primary.mediaIds.length;
                        primary.mediaIds = [...new Set([...primary.mediaIds, ...frag.mediaIds])];
                        if (primary.mediaIds.length > oldLen) needsUpdate = true;
                    }

                    // Merge Metadata
                    if (frag.metadata) {
                        if (!primary.metadata) primary.metadata = {};
                        const oldMetaStr = JSON.stringify(primary.metadata);
                        mergeMetadata(primary.metadata, frag.metadata);
                        if (JSON.stringify(primary.metadata) !== oldMetaStr) needsUpdate = true;
                    }

                    // Merge description if primary lacks one
                    if (!primary.description && frag.description) {
                        primary.description = frag.description;
                        needsUpdate = true;
                    }

                    // Delete the fragment from both databases
                    const fragId = frag.id || frag._id;
                    await cloudDb.collection('tags').deleteOne({ id: fragId });
                    await localDb.collection('tags').deleteOne({ id: fragId });
                    deletedCount++;
                    logStream.write(`Deleted fragment: ${fragId}\n`);
                }

                // Save the Primary back if it was updated
                if (needsUpdate) {
                    const primaryId = primary.id || primary._id;
                    await cloudDb.collection('tags').updateOne({ id: primaryId }, { $set: primary });
                    await localDb.collection('tags').updateOne({ id: primaryId }, { $set: primary });
                    mergedCount++;
                    logStream.write(`Updated Primary Tag with merged data.\n`);
                }
            }
        }

        logStream.end();
        console.log(`\nConsolidation complete!`);
        console.log(`Merged fragments into ${mergedCount} Primary Tags.`);
        console.log(`Deleted ${deletedCount} dummy/duplicate tags.`);
        console.log(`Review consolidation_log.txt for a full audit trail.`);
        
    } catch (e) {
        console.error('Consolidation failed:', e);
    } finally {
        await cloudClient.close();
        await localClient.close();
    }
})();
