const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function checkRecord(uid, docId) {
    console.log(`[Verify] Inspecting ${docId}...`);
    const doc = await db.collection('users').doc(uid).collection('chat_segments').doc(docId).get();

    if (!doc.exists) {
        console.log("❌ Document does not exist.");
        return;
    }

    const data = doc.data();
    console.log("=== DATA SNAPSHOT ===");
    console.log(`Role: ${data.role}`);
    console.log(`Source: ${data.source}`);
    console.log(`Rescued: ${data.rescued}`);
    console.log(`Metadata:`, JSON.stringify(data.search_metadata, null, 2));

    if (data.search_metadata && data.search_metadata.keywords) {
        console.log("✅ ENRICHED");
    } else {
        console.log("❌ NAKED (Missing Metadata)");
    }
}

// Inspect the specific record user mentioned if possible, or search for one
async function findAndCheck() {
    const uid = "9MPVGVTxE8dXvkCrl1XrWHQzCl23";

    // Find a naked record
    const snap = await db.collection('users').doc(uid).collection('chat_segments')
        .where('rescued', '==', true)
        .limit(1)
        .get();

    if (snap.empty) {
        console.log("No 'rescued' records found to clear.");
    } else {
        const doc = snap.docs[0];
        await checkRecord(uid, doc.id);
        // Pass ID to next step via console for manual copy or just know it exists
        console.log(`TARGET_ID: ${doc.id}`);
    }
}

findAndCheck();
