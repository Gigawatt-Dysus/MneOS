const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = getFirestore();

// FORCE SYNC (The Final Push)
async function triggerSync(uid) {
    const start = Date.now();
    console.log(`[Sync] Waking up Sync Trigger for ${uid}...`);

    const targetDate = new Date('2025-12-23T00:00:00Z');
    const segmentsRef = db.collection('users').doc(uid).collection('chat_segments');

    // Get all recent docs (Enriched or otherwise)
    const snapshot = await segmentsRef
        .where('timestamp', '>', targetDate)
        .get();

    let count = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Only trigger if it HAS metadata (ready to sync)
        if (data.search_metadata && data.search_metadata.keywords) {

            // Dummy update to fire 'onDocumentWritten'
            await doc.ref.update({
                last_synced_attempt: admin.firestore.FieldValue.serverTimestamp()
            });

            process.stdout.write("."); // Progress dot
            count++;
            await new Promise(r => setTimeout(r, 50)); // Rate limit
        }
    }

    console.log(`\n[Sync] Poked ${count} records. They should appear in Typesense in ~5 seconds.`);
}

triggerSync("9MPVGVTxE8dXvkCrl1XrWHQzCl23"); 
