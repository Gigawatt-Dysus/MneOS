const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// 1. Read .env.local for password
let password = '';
try {
    const envPath = path.resolve('.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value && key.trim() === 'MONGODB_PASSWORD') {
                password = value.trim();
            }
        });
    }
} catch (e) {
    console.warn("Could not read .env.local:", e.message);
}

// Support command-line argument fallback
if (!password && process.argv[2]) {
    password = process.argv[2];
}

if (!password) {
    console.error("❌ Error: MongoDB password not found. Please add MONGODB_PASSWORD to your .env.local file or pass it as an argument: node mongo_migrate.cjs <password>");
    process.exit(1);
}

// 2. Locate backup file
const BACKUP_DIR = '_backups';
let backupFile = '';
try {
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('firestore_optimized_') && f.endsWith('.json'))
        .sort(); // Sort so the latest one is last
    if (files.length === 0) {
        throw new Error("No firestore_optimized_*.json backups found.");
    }
    backupFile = path.join(BACKUP_DIR, files[files.length - 1]);
} catch (e) {
    console.error("❌ Error locating backup file:", e.message);
    process.exit(1);
}

console.log(`📂 Found Firestore backup file: ${backupFile}`);
const rawData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

// 3. Connect to MongoDB
const encodedPassword = encodeURIComponent(password);
const uri = `mongodb+srv://dysus2026:${encodedPassword}@lifeos-cluster.qmjogz8.mongodb.net/LifeOS?retryWrites=true&w=majority&appName=LifeOS-Cluster`;

const client = new MongoClient(uri);

const USER_SUBCOLLECTIONS = [
    'events',
    'tags',
    'media',
    'chat_segments',
    'gigiJournal',
    'communication_archives',
    'transmissions',
    'verts',
    'pending_accessions',
    'notifications',
    'airlock',
    'leads',
    'settings'
];

async function migrate() {
    console.log("🚚 Initiating migration to MongoDB Atlas...");
    try {
        await client.connect();
        console.log("🔌 Connected successfully to MongoDB Atlas Cluster.");
        const db = client.db("LifeOS");

        // We will keep a count of all records migrated
        const stats = {};

        // 4. Migrate Root Collections
        for (const [colId, docs] of Object.entries(rawData)) {
            if (colId === 'users') continue; // Handled separately to unpack subcollections

            if (!docs || docs.length === 0) continue;

            console.log(`📥 Migrating root collection: ${colId} (${docs.length} docs)...`);
            const collection = db.collection(colId);

            // Clean up old collection if present
            await collection.deleteMany({});

            const mongoDocs = docs.map(doc => ({
                _id: doc._id,
                ...doc._data
            }));

            const result = await collection.insertMany(mongoDocs);
            stats[colId] = result.insertedCount;
        }

        // 5. Migrate Users and Unpack Subcollections
        if (rawData.users && rawData.users.length > 0) {
            console.log(`📥 Migrating root collection: users (${rawData.users.length} docs)...`);
            const usersCol = db.collection('users');
            await usersCol.deleteMany({});

            const userDocs = rawData.users.map(u => ({
                _id: u._id,
                ...u._data
            }));
            const userResult = await usersCol.insertMany(userDocs);
            stats['users'] = userResult.insertedCount;

            // Pre-clean subcollections before seeding
            for (const subId of USER_SUBCOLLECTIONS) {
                await db.collection(subId).deleteMany({});
                stats[subId] = 0;
            }

            // Unpack subcollections
            for (const u of rawData.users) {
                const userId = u._id;
                const subColls = u._subcollections || {};

                for (const [subId, docs] of Object.entries(subColls)) {
                    if (!docs || docs.length === 0) continue;

                    console.log(`   ├── [User: ${userId}] Writing subcollection: ${subId} (${docs.length} docs)...`);
                    const subCol = db.collection(subId);

                    const mongoDocs = docs.map(doc => ({
                        _id: `${userId}_${doc._id}`,
                        id: doc._id,
                        userId: userId,
                        ...doc._data
                    }));

                    const result = await subCol.insertMany(mongoDocs);
                    stats[subId] = (stats[subId] || 0) + result.insertedCount;
                }
            }
        }

        // 6. Print Migration Summary Report
        console.log("\n===========================================");
        console.log("🏆 MIGRATION COMPLETE SUMMARY REPORT");
        console.log("===========================================");
        for (const [colName, count] of Object.entries(stats)) {
            console.log(`📊 Collection: ${colName.padEnd(25)} -> ${count} documents migrated.`);
        }
        console.log("===========================================");
        console.log("🎉 All data successfully loaded into MongoDB Atlas!");

    } catch (e) {
        console.error("❌ Migration failed:", e);
    } finally {
        await client.close();
        process.exit(0);
    }
}

migrate();
