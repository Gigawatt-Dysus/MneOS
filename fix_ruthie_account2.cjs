const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'C:/MneOS/.env' });

async function fixOtherAccount() {
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
        await client.connect();
        const db = client.db('LifeOS');
        
        console.log("Copying metadata to the dysus@gigiwatt.com account tag...");
        
        // Find Ruthie in account 1
        const goodDoc = await db.collection('tags').findOne({ _id: '9MPVGVTxE8dXvkCrl1XrWHQzCl23_tag-1763214032814' });
        
        if (!goodDoc) {
            console.error("Could not find good Ruthie doc!");
            return;
        }

        const updates = {
            metadata: goodDoc.metadata,
            name: goodDoc.name,
            updatedAt: new Date(), // Set to a fresh native Date object
        };

        const result = await db.collection('tags').findOneAndUpdate(
            { _id: 'user-1763160623569-tphfri_tag-1763214032814' },
            { $set: updates },
            { returnDocument: 'after' }
        );

        console.log("Successfully updated Ruthie for the second account!");
        console.log("New updatedAt:", result.updatedAt);
        console.log("New birth date:", result.metadata.dates.birth);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

fixOtherAccount();
