/**
 * [ZEN RESCUE MISSION] Stage 1: Soul Extraction (Pure JS Version)
 * This script pulls all core data from the suspended Firebase project
 * and saves it locally to bypass Google's billing lockdown.
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// 1. Load Env Config
const envPath = path.resolve('c:/Users/artin/Documents/Project-GIGI-Firebase/Project-GIGI/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: "gigi-time-machine.firebaseapp.com",
    projectId: "gigi-time-machine",
    storageBucket: "gigi-time-machine.appspot.com",
    messagingSenderId: "367332213769",
    appId: "1:367332213769:web:3e659b964344073385287d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTIONS = [
    'users',
    'events',
    'tags',
    'media',
    'chatHistory',
    'gigiJournal',
    'verts',
    'settings'
];

async function runRescue() {
    console.log("🚀 [RESCUE] Initiating Soul Extraction...");
    
    for (const colName of COLLECTIONS) {
        try {
            console.log(`📥 [RESCUE] Pulling collection: ${colName}...`);
            const colRef = collection(db, colName);
            const snapshot = await getDocs(colRef);
            
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            const filePath = path.join('rescue_data', `${colName}.json`);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`✅ [RESCUE] Saved ${data.length} records to ${filePath}`);
        } catch (err) {
            console.error(`❌ [RESCUE] Failed to pull ${colName}:`, err);
        }
    }
    
    console.log("\n💎 [RESCUE] Extraction Phase 1 Complete.");
    console.log("📂 [RESCUE] Your data is now safe in c:/Users/artin/Documents/Project-GIGI-Firebase/Project-GIGI/rescue_data/");
    process.exit(0);
}

runRescue();
