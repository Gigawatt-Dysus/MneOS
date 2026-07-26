const admin = require('firebase-admin');
const serviceAccount = require('../dev-tools/serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const userId = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

async function inspectUserProfile() {
    console.log(`inspecting user profile for ${userId}...`);
    const docRef = db.collection('users').doc(userId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        console.log("User not found!");
        return;
    }
    const data = docSnap.data();
    console.log("Sovereign Memex:", JSON.stringify(data.sovereignMemex || {}, null, 2));
    const companions = data.aiCompanions || [];
    console.log(`Found ${companions.length} companions.`);
    companions.forEach(c => {
        console.log(`\nCompanion: ${c.name} (ID: ${c.id})`);
        console.log(`- selfConcept: ${c.selfConcept || 'undefined/empty'}`);
        console.log(`- selfConceptSnapshot: ${c.selfConceptSnapshot || 'undefined/empty'}`);
    });
}

inspectUserProfile();
