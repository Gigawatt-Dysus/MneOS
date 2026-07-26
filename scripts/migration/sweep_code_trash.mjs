import { MongoClient } from 'mongodb';

const MONGO_URI = "mongodb://zen:sovereign@100.116.12.18:27017";
const DB_NAME = "LifeOS";

async function run() {
    console.log(`\n=========================================`);
    console.log(`[INIT] MneOS Code Trash Sweeper`);
    console.log(`=========================================\n`);

    const client = new MongoClient(MONGO_URI);
    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const sourceCol = db.collection('pending_accessions');
        const targetCol = db.collection('legacy_code_archive');

        // Regex to catch all the common programming/node_modules garbage
        // Case insensitive match at the end of the filename, or exactly "LICENSE", "Makefile", etc.
        const codeTrashRegex = /\.(js|mjs|cjs|mts|ts|jsx|tsx|json|md|yml|yaml|css|scss|less|html|d\.ts|map|nycrc|toml|lock|env|proto|wasm)$|^LICENSE|^Makefile|^FUNDING\.yml|^\.npmignore|^\.gitignore|^\.prettierrc|^\.eslintrc/i;

        console.log("🔍 Scanning 'pending_accessions' for code/library trash...");
        
        // Find all documents that match the regex
        const trashDocs = await sourceCol.find({ originalName: { $regex: codeTrashRegex } }).toArray();
        
        console.log(`🗑️ Found ${trashDocs.length} code trash files to sweep.`);

        if (trashDocs.length === 0) {
            console.log("✅ No trash found. Exiting.");
            return;
        }

        console.log(`🚀 Moving ${trashDocs.length} files to 'legacy_code_archive' collection...`);

        // Insert into the new collection
        await targetCol.insertMany(trashDocs);

        // Delete from the original collection
        const idsToDelete = trashDocs.map(doc => doc._id);
        const deleteResult = await sourceCol.deleteMany({ _id: { $in: idsToDelete } });

        console.log(`\n=========================================`);
        console.log(`🎉 MASS SWEEP COMPLETE!`);
        console.log(`✅ Successfully moved ${deleteResult.deletedCount} items out of the airlock.`);
        console.log(`=========================================\n`);

    } finally {
        await client.close();
    }
}

run().catch(console.error);
