/**
 * [ZEN RESCUE MISSION] Stage 1: Soul Extraction (ADMIN MODE)
 * Uses the serviceAccountKey.json skeleton key to bypass security rules
 * and pull all core data from the suspended Firebase project.
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// 1. Load the Skeleton Key
const serviceAccountPath = path.resolve('c:/Users/artin/Documents/Project-GIGI-Firebase/Project-GIGI/serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const COLLECTIONS = [
    'users',
    'events',
    'tags',
    'media',
    'chatHistory',
    'gigiJournal',
    'verts',
    'settings',
    'notifications',
    'airlock'
];

async function runAdminRescue() {
    console.log("🗝️ [RESCUE] Skeleton Key Accepted. Initiating Admin Extraction...");
    
    // Create directory if it doesn't exist
    const rescueDir = 'rescue_data_admin';
    if (!fs.existsSync(rescueDir)) fs.mkdirSync(rescueDir);

    for (const colName of COLLECTIONS) {
        try {
            console.log(`📥 [RESCUE] Admin-Pulling collection: ${colName}...`);
            const snapshot = await db.collection(colName).get();
            
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const filePath = path.join(rescueDir, `${colName}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`✅ [RESCUE] Saved ${data.length} records to ${filePath}`);
        } catch (err) {
            console.error(`❌ [RESCUE] Admin pull failed for ${colName}:`, err.message);
        }
    }
    
    console.log("\n💎 [RESCUE] Admin Extraction Complete.");
    console.log(`📂 [RESCUE] Data secured in c:/Users/artin/Documents/Project-GIGI-Firebase/Project-GIGI/${rescueDir}/`);
    process.exit(0);
}

runAdminRescue();
