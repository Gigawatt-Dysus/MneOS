// manualUplink.js
const admin = require("firebase-admin");

// [ZEN] MANUAL UPLINK - Using your local CLI login
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "gigi-time-machine"
    });
}

const db = admin.firestore();
const DEV_UID = "9MPVGVTxE8dXvkCrl1XrWHQzCl23";

async function injectHeartbeat() {
    console.log("🚀 [ManualUplink] Injecting Sovereign Heartbeat into 'gigi-time-machine'...");
    
    try {
        const docRef = await db.collection("users").doc(DEV_UID).collection("chat_segments").add({
            role: "user",
            content: "💓 [MANUAL UPLINK]: The Sovereign Pipe is OPEN!",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            source: "manual_injector",
            author: { name: "Eric (Sovereign)" },
        });
        
        console.log(`✅ [ManualUplink] Success! Doc ID: ${docRef.id}`);
        process.exit(0);
    } catch (e) {
        console.error("❌ [ManualUplink] Failed:", e.message);
        console.log("\nTIP: Make sure you are logged in with 'firebase login' and have the right project active.");
        process.exit(1);
    }
}

injectHeartbeat();
