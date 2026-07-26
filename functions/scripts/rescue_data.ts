const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize (Run locally with credentials or via firebase shell)
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = getFirestore();

async function healData(uid) {
    console.log(`[Rescue] Scanning user ${uid} for corrupt records...`);
    const segmentsRef = db.collection('users').doc(uid).collection('chat_segments');

    // Target Date: Dec 23, 2025
    const targetDate = new Date('2025-12-23T00:00:00Z');

    // Find docs created AFTER target date that lack metadata
    // Note: We can't query for "missing field" easily, so we fetch recent and filter JS-side
    const snapshot = await segmentsRef
        .where('timestamp', '>', targetDate)
        .get();

    let count = 0;
    const batchSize = 500;

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // IDENTIFY NAKED RECORD
        if (!data.search_metadata || !data.search_metadata.keywords) {
            console.log(`[Rescue] Found Patient Zero: ${doc.id}`);

            // THE CURE: A No-Op Update to trigger the Cloud Function
            // We just set a flag 'rescued: true' which does nothing but fire the trigger
            await doc.ref.update({ rescued: true });

            count++;
            await new Promise(r => setTimeout(r, 100)); // Rate limit 10/sec
        }
    }

    console.log(`[Rescue] Mission Complete. ${count} records injected with cure.`);
}

// USAGE: Change UID to target
healData("9MPVGVTxE8dXvkCrl1XrWHQzCl23");

module.exports = { healData };
