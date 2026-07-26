import { MongoClient } from 'mongodb';

// Replace with your actual local MongoDB URI and DB name if different
const MONGO_URI = process.env.LOCAL_MONGO_URI || 'mongodb://zen:sovereign@100.116.12.18:27017';
const DB_NAME = 'LifeOS';

async function resetAiProcessedFlags() {
    console.log(`🔌 Connecting to local MongoDB at ${MONGO_URI}...`);
    const client = new MongoClient(MONGO_URI);
    
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        
        console.log(`\n🧹 Target acquired: ${DB_NAME} database.`);
        console.log(`Setting 'aiProcessed: false' on all records in 'media' and 'pending_accessions'...`);

        const mediaCollection = db.collection('media');
        const mediaResult = await mediaCollection.updateMany(
            {}, 
            { $set: { aiProcessed: false } }
        );
        console.log(`✅ Media Collection: Reset ${mediaResult.modifiedCount} records.`);

        // If you have a separate pending_accessions collection
        const pendingCollection = db.collection('pending_accessions');
        const pendingResult = await pendingCollection.updateMany(
            {}, 
            { $set: { aiProcessed: false } }
        );
        console.log(`✅ Pending Accessions: Reset ${pendingResult.modifiedCount} records.`);

        console.log(`\n🎉 Reset complete! The VLM Sweeper is officially authorized to re-caption the vault.`);

    } catch (err) {
        console.error('❌ FATAL ERROR during reset:', err);
    } finally {
        await client.close();
        console.log('🔌 Connection closed.');
    }
}

resetAiProcessedFlags();
