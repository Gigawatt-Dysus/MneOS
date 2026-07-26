const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function touchRecord(uid, docId) {
    console.log(`[Touch] Poking ${docId} to trigger Cloud Function...`);
    const ref = db.collection('users').doc(uid).collection('chat_segments').doc(docId);

    await ref.update({
        force_enrich_trigger: Date.now(),
        // Clear rescued flag to allow re-processing if logic checks it
        rescued: false
    });

    console.log("✅ Touch complete. Watch logs/Typesense.");
}

const args = process.argv.slice(2);
const targetId = args[0]; // Pass ID from command line

if (targetId) {
    touchRecord("9MPVGVTxE8dXvkCrl1XrWHQzCl23", targetId);
} else {
    console.log("Usage: node scripts/touch_record.js <DOC_ID>");
    // Auto-find one for convenience
    (async () => {
        const uid = "9MPVGVTxE8dXvkCrl1XrWHQzCl23";
        const snap = await db.collection('users').doc(uid).collection('chat_segments')
            .where('rescued', '==', true)
            .limit(1)
            .get();
        if (!snap.empty) {
            await touchRecord(uid, snap.docs[0].id);
        } else {
            console.log("No records found to touch.");
        }
    })();
}
