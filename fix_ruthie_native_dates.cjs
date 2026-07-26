const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'C:/MneOS/.env' });

async function fixRuthie() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        console.log("Fixing Ruthie's document to use native Date objects...");
        
        // Find Ruthie
        const doc = await db.collection('tags').findOne({ _id: '9MPVGVTxE8dXvkCrl1XrWHQzCl23_tag-1763214032814' });
        
        if (!doc) {
            console.error("Could not find Ruthie!");
            return;
        }

        const updates = {
            updatedAt: new Date(), // Set to a fresh native Date object
        };

        // Fix birth date if it's an object
        if (doc.metadata && doc.metadata.dates && doc.metadata.dates.birth) {
            const b = doc.metadata.dates.birth;
            if (b._seconds !== undefined) {
                updates['metadata.dates.birth'] = new Date(b._seconds * 1000);
            } else if (typeof b === 'string') {
                updates['metadata.dates.birth'] = new Date(b);
            }
        }

        const result = await db.collection('tags').findOneAndUpdate(
            { _id: '9MPVGVTxE8dXvkCrl1XrWHQzCl23_tag-1763214032814' },
            { $set: updates },
            { returnDocument: 'after' }
        );

        console.log("Successfully updated Ruthie!");
        console.log("New updatedAt:", result.updatedAt);
        console.log("New birth date:", result.metadata.dates.birth);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

fixRuthie();
