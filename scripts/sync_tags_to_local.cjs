const { MongoClient } = require('mongodb');

(async () => {
    const cloudUri = process.env.ATLAS_CLOUD_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/LifeOS';
    const localUri = 'mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin';

    const cloudClient = new MongoClient(cloudUri);
    const localClient = new MongoClient(localUri);

    try {
        console.log('Connecting to Atlas Cloud...');
        await cloudClient.connect();
        const cloudDb = cloudClient.db('LifeOS');

        console.log('Connecting to Local GGA Cluster...');
        await localClient.connect();
        const localDb = localClient.db('LifeOS');

        const cloudTags = await cloudDb.collection('tags').find({}).toArray();
        console.log(`Fetched ${cloudTags.length} tags from Atlas.`);
        
        // Let's check Ruth's metadata in Cloud
        const cloudRuth = cloudTags.find(t => t.name === 'Ruthie M. Evers');
        if (cloudRuth) {
            console.log('Cloud Ruth metadata present?', !!cloudRuth.metadata);
            if (cloudRuth.metadata) {
                console.log('Cloud Ruth metadata keys:', Object.keys(cloudRuth.metadata));
            }
        }

        if (cloudTags.length > 0) {
            console.log('Purging local tags collection...');
            await localDb.collection('tags').deleteMany({});
            
            console.log('Rehydrating local tags with Cloud data...');
            const result = await localDb.collection('tags').insertMany(cloudTags);
            console.log(`Successfully synced ${result.insertedCount} tags to Local GGA Cluster.`);
        } else {
            console.log('Warning: No tags found in Cloud to sync.');
        }

    } catch (e) {
        console.error('Sync failed:', e);
    } finally {
        await cloudClient.close();
        await localClient.close();
        console.log('Done.');
    }
})();
