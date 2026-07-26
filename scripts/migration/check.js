const { MongoClient } = require('mongodb');
MongoClient.connect('mongodb://zen:sovereign@100.116.12.18:27017').then(async c => {
    const db = c.db('LifeOS');
    const doc = await db.collection('pending_accessions').findOne({ size: { $exists: true } });
    console.log(doc ? Object.keys(doc) : 'No size');
    if (doc) console.log('Size:', doc.size, 'OriginalName:', doc.originalName);
    c.close();
});
