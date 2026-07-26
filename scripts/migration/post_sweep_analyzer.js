import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars so we can connect to Mongo
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const uri = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
if (!uri) {
    console.error("⚠️ MONGODB_URI missing from .env.local");
    process.exit(1);
}

// The Failure Matrix
const FAILURE_KEYWORDS = [
    "blurry", "unclear", "document", "text", "cannot see", 
    "difficult to make out", "screenshot", "meme", "cannot determine",
    "too dark", "low resolution", "graphic", "cartoon"
];

const MIN_WORDS = 15;

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function run() {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    const mediaCol = db.collection('media');

    console.log("🕵️‍♂️ Starting Detective Sweep Daemon...");

    while (true) {
        try {
            console.log("\n[ " + new Date().toLocaleTimeString() + " ] 🔍 Initiating sweep...");
            const cursor = mediaCol.find({
                aiProcessed: true,
                reviewStatus: { $nin: ['reviewed', 'pending_review'] }
            });

            let flagCount = 0;
            let totalCount = 0;

            for await (const doc of cursor) {
                totalCount++;
                if (!doc.caption) {
                    await mediaCol.updateOne(
                        { _id: doc._id }, 
                        { $set: { reviewStatus: 'pending_review', reviewReason: 'Missing caption' } }
                    );
                    flagCount++;
                    continue;
                }

                const caption = doc.caption.toLowerCase();
                const words = caption.split(/\s+/).filter(w => w.length > 0);
                
                let flagged = false;
                let reason = '';

                if (words.length < MIN_WORDS) {
                    flagged = true;
                    reason = `Low word count (${words.length} words)`;
                } else {
                    for (const kw of FAILURE_KEYWORDS) {
                        if (caption.includes(kw)) {
                            flagged = true;
                            reason = `Contains trigger: '${kw}'`;
                            break;
                        }
                    }
                }

                if (flagged) {
                    await mediaCol.updateOne(
                        { _id: doc._id },
                        { $set: { reviewStatus: 'pending_review', reviewReason: reason } }
                    );
                    flagCount++;
                    console.log(`🚩 Flagged [${doc._id || doc.id}]: ${reason}`);
                }
            }

            console.log(`✅ Sweep Complete. Scanned: ${totalCount} | Flagged: ${flagCount}`);
            
        } catch (err) {
            console.error("❌ Error during detective sweep:", err);
        }

        console.log(`💤 Sleeping for ${POLL_INTERVAL / 1000} seconds...`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
}

run().catch(console.error);
