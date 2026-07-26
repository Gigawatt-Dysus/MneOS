import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load the local environment variables to get the MongoDB URI
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const uri = process.env.MONGODB_URI || '';
if (!uri) {
    console.error("❌ MONGODB_URI not found in .env.local");
    process.exit(1);
}

const client = new MongoClient(uri, {
    family: 4 // Force IPv4
});

async function main() {
    console.log("\n=======================================================");
    console.log("🚀 Sovereign Vector Engine - Live Fire Test");
    console.log("=======================================================\n");

    try {
        await client.connect();
        const db = client.db('LifeOS');
        const collection = db.collection('takeout_media');

        console.log("📡 Connected to Atlas. Fetching a random target vector...");

        // 1. Grab a random document that has an embedding
        const targetDoc = await collection.findOne({ embedding: { $exists: true }, userId: "eric_cornett" });
        
        if (!targetDoc) {
            console.error("❌ Could not find any documents with an embedding!");
            return;
        }

        console.log(`🎯 Target acquired: ${targetDoc.filename}`);
        console.log(`   Dimensions: ${targetDoc.embedding.length}`);
        
        const queryVector = targetDoc.embedding;

        console.log("\n🔍 Firing $vectorSearch query into the HNSW graph...");
        const startTime = Date.now();

        // 2. Perform the Vector Search using the acquired vector
        const results = await collection.aggregate([
            {
                $vectorSearch: {
                    index: "vector_index",
                    path: "embedding",
                    queryVector: queryVector,
                    numCandidates: 100,
                    limit: 5,
                    filter: { userId: "eric_cornett" } // Security sweep test
                }
            },
            {
                $project: {
                    _id: 0,
                    filename: 1,
                    filepath: 1,
                    size: 1,
                    score: { $meta: "vectorSearchScore" }
                }
            }
        ]).toArray();

        const latency = Date.now() - startTime;

        console.log(`\n✅ Query returned in ${latency}ms\n`);
        console.log("🏆 Top 5 Semantic Matches:");
        
        results.forEach((doc, i) => {
            console.log(`\n[Rank ${i + 1}] Score: ${doc.score}`);
            console.log(`   File: ${doc.filename}`);
            console.log(`   Path: ${doc.filepath}`);
        });

    } catch (err) {
        console.error("\n❌ Atlas Error:", err);
    } finally {
        await client.close();
    }
}

main().catch(console.error);
