const { MongoClient } = require('mongodb');
(async () => {
    const cloudUri = process.env.ATLAS_CLOUD_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/LifeOS';
    const cloudClient = new MongoClient(cloudUri);
    try {
        await cloudClient.connect();
        const cloudDb = cloudClient.db('LifeOS');
        const cloudRuth = await cloudDb.collection('tags').findOne({ name: { $regex: /Ruth/, $options: 'i' } });
        console.log('Ruth tag found?', !!cloudRuth);
        if (cloudRuth) {
            console.log('Name:', cloudRuth.name);
            console.log('Has metadata?', !!cloudRuth.metadata);
            if (cloudRuth.metadata) {
                console.log('Metadata keys:', Object.keys(cloudRuth.metadata));
            }
        }
    } finally {
        await cloudClient.close();
    }
})();
