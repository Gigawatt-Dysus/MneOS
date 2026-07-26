
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import * as fs from 'fs';

// Load config from the project
const configRaw = fs.readFileSync('c:/Users/artin/Documents/Project-GIGI-Firebase/Project-GIGI/firebaseConfig.ts', 'utf8');
const configMatch = configRaw.match(/firebaseConfig = (\{[\s\S]*?\});/);
if (!configMatch) {
    console.error("Could not find firebaseConfig");
    process.exit(1);
}

const firebaseConfig = eval(`(${configMatch[1]})`);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TARGET_EMAIL = 'dysus2024@gmail.com';
const TARGET_UIDS = [
    '9MPVGVTxE8dXvkCrl1XrWHQzCl23',
    'user-1763160623569-tphfri'
];

async function healRecords() {
    console.log(`[HEAL] Starting Identity Restoration Protocol...`);
    console.log(`[HEAL] Target Email: ${TARGET_EMAIL}`);

    for (const uid of TARGET_UIDS) {
        console.log(`[HEAL] 🛰️ Probing record: ${uid}`);
        const userRef = doc(db, 'users', uid);
        try {
            await updateDoc(userRef, {
                email: TARGET_EMAIL
            });
            console.log(`[HEAL] ✅ SUCCESS: Record ${uid} restored to ${TARGET_EMAIL}`);
        } catch (e) {
            console.error(`[HEAL] ❌ FAILED for ${uid}: ${e.message}`);
        }
    }
    console.log(`[HEAL] Identity Restoration Complete.`);
    process.exit(0);
}

healRecords();
