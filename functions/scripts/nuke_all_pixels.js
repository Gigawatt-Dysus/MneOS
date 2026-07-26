require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });
const { MongoClient } = require('mongodb');

async function run() {
    const uri = process.env.MONGODB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('LifeOS');

    const collections = await db.listCollections().toArray();
    let foundAny = false;

    for (const c of collections) {
        // Need to do a full scan since not all collections have text indexes
        const docs = await db.collection(c.name).find().toArray();
        let foundInCol = 0;
        for (const doc of docs) {
            const str = JSON.stringify(doc);
            if (str.toLowerCase().includes('blogbooster') || str.toLowerCase().includes('bloghooster') || str.toLowerCase().includes('pixel.gif')) {
                console.log(`Found in collection ${c.name}, document ${doc._id}`);
                foundInCol++;
                foundAny = true;
                
                // Let's actually delete/update it
                if (c.name === 'events' && doc.details) {
                     const newDetails = doc.details.replace(/<img[^>]*pixel\.gif[^>]*>/gi, '')
                                                  .replace(/!\[.*?\]\(.*?pixel\.gif\)/gi, '')
                                                  .replace(/http:\/\/theblogbooster\.com\/pixel\.gif/gi, '');
                     await db.collection('events').updateOne({_id: doc._id}, {$set: {details: newDetails}});
                     console.log('Cleaned event details.');
                }
            }
        }
        if (foundInCol > 0) {
            console.log(`Total found in ${c.name}: ${foundInCol}`);
        }
    }
    
    if (!foundAny) {
        console.log("No blogbooster or pixel.gif found anywhere in MongoDB!");
    }

    await client.close();
}

run().catch(console.error);
