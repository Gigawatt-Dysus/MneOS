/**
 * [ZEN RESCUE MISSION] Stage 1: Deep Soul Extraction
 * Iterates through all users and pulls their private subcollections
 * to ensure no data is left behind in the suspended project.
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// 1. Load the Skeleton Key
const serviceAccountPath = path.resolve('c:/Users/artin/Documents/Project-GIGI-Firebase/Project-GIGI/serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

// Load the users we found
const usersPath = path.resolve('c:/Users/artin/Documents/Project-GIGI-Firebase/Project-GIGI/rescue_data_admin/users.json');
const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

const SUB_COLLECTIONS = [
    'events',
    'tags',
    'media',
    'chatHistory',
    'gigiJournal',
    'notifications',
    'airlock',
    'leads',
    'settings'
];

async function runDeepRescue() {
    console.log("🌊 [RESCUE] Initiating Deep Subcollection Dive...");
    
    const rescueDir = 'rescue_data_deep';
    if (!fs.existsSync(rescueDir)) fs.mkdirSync(rescueDir);

    for (const user of users) {
        console.log(`\n👤 [RESCUE] Processing User: ${user.email || user.id}`);
        const userDir = path.join(rescueDir, user.id);
        if (!fs.existsSync(userDir)) fs.mkdirSync(userDir);

        for (const colName of SUB_COLLECTIONS) {
            try {
                // Path: users/[userId]/[collection]
                const snapshot = await db.collection('users').doc(user.id).collection(colName).get();
                
                if (snapshot.empty) continue;

                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                const filePath = path.join(userDir, `${colName}.json`);
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                console.log(`   ✅ Saved ${data.length} records to ${colName}.json`);
            } catch (err) {
                console.error(`   ❌ Failed for ${colName}:`, err.message);
            }
        }
    }
    
    console.log("\n💎 [RESCUE] Deep Extraction Complete.");
    console.log(`📂 [RESCUE] Full archive secured in c:/Users/artin/Documents/Project-GIGI-Firebase/Project-GIGI/${rescueDir}/`);
    process.exit(0);
}

runDeepRescue();
