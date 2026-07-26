import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configure __dirname for ES modules if needed, or just use process.cwd()
const rootDir = process.cwd();
dotenv.config({ path: path.join(rootDir, '.env.local') });

const uri = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;

if (!uri) {
    console.error("❌ ERROR: Could not find MongoDB URI in .env.local");
    process.exit(1);
}

const backupDir = path.join(rootDir, '_backups', `mongo_snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}`);

async function runBackup() {
    console.log("=======================================");
    console.log("🛡️ Sovereign Database Backup Initiated");
    console.log("=======================================");
    
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
        console.log(`📁 Created backup directory: ${backupDir}`);
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("✅ Connected to MongoDB Atlas");
        
        // Target database (usually 'test' or specified in URI)
        const db = client.db();
        
        const collections = await db.listCollections().toArray();
        console.log(`🔍 Found ${collections.length} collections to backup...`);

        for (const colInfo of collections) {
            const colName = colInfo.name;
            const col = db.collection(colName);
            
            process.stdout.write(`⏳ Backing up ${colName}... `);
            const data = await col.find({}).toArray();
            
            const outFile = path.join(backupDir, `${colName}.json`);
            fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
            console.log(`Done. (${data.length} records)`);
        }
        
        console.log("=======================================");
        console.log("🎉 Backup complete! All data secured.");
        console.log(`💾 Location: ${backupDir}`);
        console.log("=======================================");
        
    } catch (err) {
        console.error("❌ Backup failed:", err);
    } finally {
        await client.close();
    }
}

runBackup();
