const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

(async () => {
    const cloudUri = 'mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster';
    const cloudClient = new MongoClient(cloudUri);

    try {
        console.log('Connecting to Atlas Cloud to analyze duplicates...');
        await cloudClient.connect();
        const cloudDb = cloudClient.db('LifeOS');

        const allTags = await cloudDb.collection('tags').find({}).toArray();
        console.log(`Fetched ${allTags.length} tags from Atlas.`);

        const groupedByName = {};
        for (const tag of allTags) {
            const nameKey = (tag.name || 'UNNAMED').toLowerCase().trim();
            if (!groupedByName[nameKey]) {
                groupedByName[nameKey] = [];
            }
            groupedByName[nameKey].push(tag);
        }

        const report = {};
        let duplicateCount = 0;

        for (const [nameKey, tags] of Object.entries(groupedByName)) {
            if (tags.length > 1) {
                duplicateCount++;
                const originalName = tags[0].name;
                report[originalName] = tags.map(t => {
                    return {
                        id: t.id || t._id,
                        type: t.type,
                        description: t.description || null,
                        mediaIdsCount: t.mediaIds ? t.mediaIds.length : 0,
                        metadataKeys: t.metadata ? Object.keys(t.metadata) : [],
                        // Show actual populated values to help Commander decide
                        populatedMetadata: t.metadata ? Object.fromEntries(
                            Object.entries(t.metadata).filter(([k, v]) => {
                                if (Array.isArray(v)) return v.length > 0;
                                if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0;
                                return v !== null && v !== undefined && v !== '';
                            })
                        ) : {}
                    };
                });
            }
        }

        const outPath = path.join(__dirname, '..', 'scratch', 'tag_duplicate_report.json');
        if (!fs.existsSync(path.dirname(outPath))) {
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
        }
        
        fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
        
        console.log(`\nAnalysis complete. Found ${duplicateCount} unique names with duplicates.`);
        console.log(`Report written to: ${outPath}`);
        
    } catch (e) {
        console.error('Analysis failed:', e);
    } finally {
        await cloudClient.close();
        console.log('Done.');
    }
})();
