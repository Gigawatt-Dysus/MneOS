const { MongoClient } = require('mongodb');

(async () => {
    const localUri = 'mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin';
    const localClient = new MongoClient(localUri);

    const cloudUri = process.env.ATLAS_CLOUD_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/LifeOS';
    const cloudClient = new MongoClient(cloudUri);

    try {
        await localClient.connect();
        await cloudClient.connect();
        const localDb = localClient.db('LifeOS');
        const cloudDb = cloudClient.db('LifeOS');
        
        const now = new Date();
        const resultLocal = await localDb.collection('tags').updateMany(
            {},
            { $set: { updatedAt: now.toISOString() } }
        );
        const resultCloud = await cloudDb.collection('tags').updateMany(
            {},
            { $set: { updatedAt: now.toISOString() } }
        );
        
        console.log(`Busted cache for ${resultLocal.modifiedCount} local tags and ${resultCloud.modifiedCount} cloud tags by updating updatedAt to ${now.toISOString()}.`);
    } catch (e) {
        console.error('Cache bust failed:', e);
    } finally {
        await localClient.close();
        await cloudClient.close();
    }
})();
