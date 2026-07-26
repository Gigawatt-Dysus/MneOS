const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = getFirestore();

// FINAL SWEEP (Local Execution)
async function finalSweep(uid) {
    console.log(`[FinalSweep] Scanning user ${uid}...`);

    // Dec 23rd cutoff
    const targetDate = new Date('2025-12-23T00:00:00Z');
    const segmentsRef = db.collection('users').doc(uid).collection('chat_segments');

    const snapshot = await segmentsRef
        .where('timestamp', '>', targetDate)
        .get();

    let scanned = 0;
    let healed = 0;
    let synced = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Check Enrichment Status
        // Must have array of keywords to be considered "enriched"
        const isEnriched = data.search_metadata &&
            Array.isArray(data.search_metadata.keywords) &&
            data.search_metadata.keywords.length > 0;

        if (isEnriched) {
            // A. FORCE SYNC (It's ready, just needs a push)
            await doc.ref.update({
                last_synced_attempt: admin.firestore.FieldValue.serverTimestamp()
            });
            synced++;
        } else {
            // B. FORCE RESCUE (It's stuck/naked)
            // We write a NEW timestamp to guarantee a Firestore Write Event
            // This wakes up 'enrichChatSegment', which creates metadata, which then wakes up 'syncToTypesense'
            console.log(`[Rescue] Kickstarting stuck record: ${doc.id}`);
            await doc.ref.update({
                rescue_attempt: admin.firestore.FieldValue.serverTimestamp(),
                rescued: true
            });
            healed++;
        }

        scanned++;
        if (scanned % 10 === 0) {
            process.stdout.write("."); // Progress dot
            await new Promise(r => setTimeout(r, 50)); // Rate limit
        }
    }

    console.log(`\n\n[FinalSweep] Mission Complete.`);
    console.log(`Total Scanned: ${scanned}`);
    console.log(`Healed (Re-Triggered Enrichment): ${healed}`);
    console.log(`Synced (Pushed to Typesense): ${synced}`);
}

finalSweep("9MPVGVTxE8dXvkCrl1XrWHQzCl23"); 
