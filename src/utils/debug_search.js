import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

// Load config from the project (mocking the structure)
const configRaw = fs.readFileSync('c:/Users/artin/Documents/Project-GIGI-Firebase/Project-GIGI/firebaseConfig.ts', 'utf8');
const configMatch = configRaw.match(/firebaseConfig = (\{[\s\S]*?\});/);
if (!configMatch) {
    console.error("Could not find firebaseConfig");
    process.exit(1);
}

const firebaseConfig = eval(`(${configMatch[1]})`);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUser() {
    const email = 'dysus2024@gmail.com';
    console.log(`Searching for user: ${email}`);
    const q = query(collection(db, 'users'), where('email', '==', email));
    try {
        const snap = await getDocs(q);
        if (snap.empty) {
            console.log("User NOT FOUND.");
        } else {
            snap.forEach(doc => {
                const data = doc.data();
                console.log("User FOUND:");
                console.log(JSON.stringify({
                    id: doc.id,
                    displayName: data.displayName,
                    email: data.email,
                    privacy: data.privacy
                }, null, 2));
            });
        }
    } catch (e) {
        console.error("Search failed:", e.message);
    }
    process.exit(0);
}

checkUser();
