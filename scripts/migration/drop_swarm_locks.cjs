require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const readline = require('readline');

const uri = process.env.MONGODB_URI || 'mongodb://zen:sovereign@100.116.12.18:27017/LifeOS?authSource=admin';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function dropLocks() {
    console.log(`\n⚠️  WARNING: You are about to drop the Swarm gates.`);
    console.log(`This will reset the thumbnail_metadata_healed and processing_lock flags across ALL media.`);
    console.log(`The Swarm will begin regenerating and overwriting ALL thumbnails in B2.`);
    
    console.log(`\n🔥 BURN IT DOWN AUTHORIZED BY COMMANDER. The gates are dropping.`);

    const client = new MongoClient(uri);
    try {
            await client.connect();
            const db = client.db('LifeOS');
            const collections = ['media', 'pending_accessions'];
            
            for (const colName of collections) {
                console.log(`\nDropping locks in ${colName}...`);
                const col = db.collection(colName);
                
                const result = await col.updateMany(
                    {},
                    { $unset: { thumbnail_metadata_healed: "", processing_lock: "", locked_at: "", processing_error: "" } }
                );
                
                console.log(`✅ ${colName}: Unset flags on ${result.modifiedCount} documents.`);
            }
            
            console.log(`\n🔥 The gates have been dropped. The Swarm is clear to engage.`);
        } catch (err) {
            console.error("Error:", err.message);
        } finally {
            await client.close();
            process.exit(0);
        }
}

dropLocks();
