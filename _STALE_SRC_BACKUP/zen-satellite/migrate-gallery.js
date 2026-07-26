// migrate-gallery.js - Fixes missing Width/Height metadata for the Matrix Gallery
// Run: node migrate-gallery.js

// --- CONFIGURATION (PASTE YOURS) ---
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBdSPXluDaF6C4UydWV-9mFWUo7iBG_saA",
  authDomain: "gigi-time-machine.firebaseapp.com",
  projectId: "gigi-time-machine",
  storageBucket: "gigi-time-machine.firebasestorage.app",
  messagingSenderId: "459534779564",
  appId: "1:459534779564:web:6a0b708fc92d49683ecb09",
  measurementId: "G-HZ5999MGQQ"
};

const USER_EMAIL = "dysus2024@gmail.com"; // Your Dev Email
const USER_PASSWORD = "Wyatt1122!"; // Your Dev Password
// const APP_ID = "default-zen"; // UNUSED: Data is in root 'users' collection
const TARGET_UID = "9MPVGVTxE8dXvkCrl1XrWHQzCl23"; 

// --- DEPENDENCIES ---
const { initializeApp } = require("firebase/app");
const { 
  getFirestore, collection, getDocs, updateDoc, doc 
} = require("firebase/firestore");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const probe = require('probe-image-size');

// --- INIT ---
if (USER_PASSWORD === "YOUR_PASSWORD_HERE") {
    console.error("❌ ERROR: Please set your USER_PASSWORD in the script.");
    process.exit(1);
}

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

async function startMigration() {
    try {
        console.log("🔑 Authenticating...");
        await signInWithEmailAndPassword(auth, USER_EMAIL, USER_PASSWORD);
        console.log("✅ Authenticated.");

        // FIX: Changed path to root 'users' collection based on screenshot
        console.log(`📂 Accessing Gallery: users/${TARGET_UID}/media`);
        
        const mediaCol = collection(db, 'users', TARGET_UID, 'media');
        const snapshot = await getDocs(mediaCol);

        if (snapshot.empty) {
            console.log("⚠️ No media found in this collection.");
            return;
        }

        console.log(`Found ${snapshot.size} items. Scanning for missing metadata...`);
        console.log("---------------------------------------------------");

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const docId = docSnap.id;

            // Check if metadata already exists
            if (data.width && data.height) {
                skippedCount++;
                continue;
            }

            if (!data.url) {
                console.log(`[SKIP] ${docId} has no URL.`);
                errorCount++;
                continue;
            }

            process.stdout.write(`[FIXING] ${docId}... `);

            try {
                // 3. Probe the image (downloads only header)
                const result = await probe(data.url);
                
                // 4. Update Firestore
                const docRef = doc(db, 'users', TARGET_UID, 'media', docId);
                await updateDoc(docRef, {
                    width: result.width,
                    height: result.height,
                    orientation: result.width >= result.height ? 'landscape' : 'portrait',
                    metadataUpdated: new Date().toISOString()
                });

                console.log(`✅ FIXED: ${result.width}x${result.height}`);
                updatedCount++;

            } catch (err) {
                console.log(`❌ ERROR: ${err.message}`);
                errorCount++;
            }
        }

        console.log("---------------------------------------------------");
        console.log(`🎉 MIGRATION COMPLETE`);
        console.log(`   Updated: ${updatedCount}`);
        console.log(`   Skipped: ${skippedCount}`);
        console.log(`   Errors:  ${errorCount}`);
        
        process.exit(0);

    } catch (error) {
        console.error("🔥 CRITICAL ERROR:", error);
        process.exit(1);
    }
}

startMigration();