const { MongoClient } = require('mongodb');
(async () => {
    const cloudUri = 'mongodb+srv://dysus2026:alpha-Omega-911@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster';
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
