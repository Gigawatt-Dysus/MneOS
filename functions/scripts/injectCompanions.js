const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Manually parse .env to avoid dotenv dependency
let uri = '';
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
        if (line.trim().startsWith('MONGODB_URI=')) {
            uri = line.substring(line.indexOf('=') + 1).trim();
            break;
        }
    }
}

const userId = "9MPVGVTxE8dXvkCrl1XrWHQzCl23";

if (!uri) {
    console.error("❌ Error: MONGODB_URI not found in environment. Make sure C:/MneOS/functions/.env exists and is configured.");
    process.exit(1);
}

async function run() {
    console.log("🚀 [COMPANION INJECTOR] Initiating manual companion profile injection...");
    console.log(`🔗 Connecting to MongoDB Atlas cluster...`);
    
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        const db = client.db("LifeOS");
        const users = db.collection("users");
        
        console.log(`🔍 Verifying user profile document for ID: ${userId}...`);
        const userDoc = await users.findOne({ _id: userId });
        if (!userDoc) {
            console.error("❌ Error: Target user document not found in MongoDB!");
            process.exit(1);
        }
        console.log(`✅ Found user profile: ${userDoc.displayName} (${userDoc.email})`);
        
        // Read companions backup JSON file
        const backupPath = path.join(__dirname, '../companions_backup.json');
        if (!fs.existsSync(backupPath)) {
            console.error("❌ Error: companions_backup.json not found! Run extract_companions.js first.");
            process.exit(1);
        }
        
        const companions = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        console.log(`📊 Loaded ${companions.length} companions from backup.`);
        
        // Clean up Brita's avatarUrl to use our Backblaze B2 permanent mirror
        const cleanedCompanions = companions.map(c => {
            if (c.name === "Brita") {
                const b2Url = "https://media.gigiwatt.com/file/LifeOS-Media/users/9MPVGVTxE8dXvkCrl1XrWHQzCl23/uploads/1764160012431_RME_RennFair__1987_face_only2.jpg";
                console.log(`✨ Re-linking Brita's avatarUrl to Backblaze B2 mirror: ${b2Url}`);
                return {
                    ...c,
                    avatarUrl: b2Url
                };
            }
            return c;
        });
        
        console.log(`📝 Performing atomic database update (aiCompanions)...`);
        const result = await users.updateOne(
            { _id: userId },
            { $set: { aiCompanions: cleanedCompanions, updatedAt: new Date() } }
        );
        
        if (result.modifiedCount > 0 || result.matchedCount > 0) {
            console.log(`\n🎉 SUCCESS! Companion profiles injected successfully.`);
            console.log(`- Matched documents: ${result.matchedCount}`);
            console.log(`- Modified documents: ${result.modifiedCount}`);
            
            // Double check by querying the updated user profile
            const updatedUser = await users.findOne({ _id: userId });
            console.log(`\n🔬 Post-Injection Verification:`);
            console.log(`- ID: ${updatedUser.id}`);
            console.log(`- Registered companions count: ${updatedUser.aiCompanions.length}`);
            updatedUser.aiCompanions.forEach((c, idx) => {
                console.log(`  [${idx + 1}] Name: ${c.name} | ID: ${c.id} | Avatar: ${c.avatarUrl.substring(0, 80)}...`);
            });
        } else {
            console.warn("⚠️ Warning: Document matched but no changes were made to the database.");
        }
        
    } catch (e) {
        console.error("❌ Fatal Error during injection:", e);
    } finally {
        await client.close();
        console.log("🔌 Connection closed.");
    }
}

run();
