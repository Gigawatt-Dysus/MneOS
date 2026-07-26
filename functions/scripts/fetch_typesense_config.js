const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

async function fetchConfig() {
    console.log(`Reading config for ${UID}...`);
    try {
        const doc = await db.collection('users').doc(UID).collection('zen_config').doc('main').get();
        if (!doc.exists) {
            console.log("❌ Config Document NOT FOUND.");
        } else {
            const data = doc.data();
            console.log("✅ TYPESENSE CONFIG:");
            console.log("Host:", data.typesenseHost);
            console.log("Key:", data.typesenseKey);
            // Verify if key matches the one we found
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

fetchConfig();
