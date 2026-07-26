const { MongoClient } = require('mongodb');
(async () => {
    const localUri = 'mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin';
    const localClient = new MongoClient(localUri);
    try {
        await localClient.connect();
        const localDb = localClient.db('LifeOS');
        const ruth = await localDb.collection('tags').findOne({ name: { $regex: /Ruth/, $options: 'i' } });
        if (ruth) {
            console.log('Ruth tag root keys:', Object.keys(ruth));
            console.log('Ruth userId:', ruth.userId);
            console.log('Ruth id:', ruth.id || ruth._id);
        }
    } finally {
        await localClient.close();
    }
})();
