const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, 'service-account.json');
const serviceAccount = require(serviceAccountPath);

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

async function purgeGateway() {
    console.log("Starting aggressive purge of pending_accessions...");
    const usersSnap = await db.collection('users').get();
    
    for (const userDoc of usersSnap.docs) {
        console.log(`Checking user: ${userDoc.id}`);
        const pendingRef = db.collection(`users/${userDoc.id}/pending_accessions`);
        
        while (true) {
            const snap = await pendingRef.limit(450).get();
            if (snap.empty) {
                console.log(`Cleared all for ${userDoc.id}`);
                break;
            }
            
            const batch = db.batch();
            snap.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`Deleted ${snap.size} items...`);
        }
    }
    console.log("Purge complete.");
}

purgeGateway().catch(console.error).finally(() => process.exit(0));
