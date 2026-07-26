// migrate-gallery.js - Inspects the first 25 media items to diagnose data structure.
// Run: node migrate-gallery.js

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBdSPXluDaF6C4UydWV-9mFWUo7iBG_saA",
  authDomain: "gigi-time-machine.firebaseapp.com",
  projectId: "gigi-time-machine",
  storageBucket: "gigi-time-machine.firebasestorage.app",
  messagingSenderId: "459534779564",
  appId: "1:459534779564:web:6a0b708fc92d49683ecb09",
  measurementId: "G-HZ5999MGQQ"
};

const USER_EMAIL = "dysus2024@gmail.com";
const USER_PASSWORD = "Wyatt1122!"; // SET THIS
const TARGET_UID = "user-1763160623569-tphfri"; 

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, limit, query } = require("firebase/firestore");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");

if (USER_PASSWORD === "YOUR_PASSWORD_HERE") {
    console.error("❌ ERROR: Please set your USER_PASSWORD.");
    process.exit(1);
}

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

async function inspectBatch() {
    try {
        console.log("🔑 Authenticating...");
        await signInWithEmailAndPassword(auth, USER_EMAIL, USER_PASSWORD);
        
        console.log(`🔍 Inspecting first 25 items in: users/${TARGET_UID}/media`);
        const mediaCol = collection(db, 'users', TARGET_UID, 'media');
        
        // Get first 25 documents
        const q = query(mediaCol, limit(125));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("⚠️ No media documents found.");
            process.exit(0);
        }

        console.log(`Found ${snapshot.size} items. Analyzing data structure...`);
        console.log("---------------------------------------------------");

        snapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            const hasUrl = !!data.url;
            const hasBase64 = !!data.base64Data;
            const urlLen = data.url ? data.url.length : 0;
            const b64Len = data.base64Data ? data.base64Data.length : 0;

            console.log(`[${index + 1}] ID: ${doc.id}`);
            console.log(`    - URL: ${hasUrl ? `Present (${urlLen} chars)` : 'MISSING/EMPTY'}`);
            console.log(`    - Base64: ${hasBase64 ? `Present (${b64Len} chars)` : 'MISSING'}`);
            
            if (hasUrl && urlLen > 0) console.log(`      -> Value: "${data.url.substring(0, 50)}..."`);
        });

        console.log("---------------------------------------------------");
        process.exit(0);

    } catch (e) {
        console.error("🔥 FATAL:", e);
        process.exit(1);
    }
}

inspectBatch();