const admin = require('firebase-admin');
const serviceAccount = require('../dev-tools/serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const userId = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

async function testQuery() {
    console.log("🕵️ Querying chat_segments with exact case user ID...");
    const segmentsRef = db.collection('users').doc(userId).collection('chat_segments');
    
    // Attempt 1: The original query approach
    console.log("\n--- Method 1: Order by __name__ startAt('diary-') endAt('diary-\\uf8ff') ---");
    try {
        const q1 = segmentsRef
            .orderBy(admin.firestore.FieldPath.documentId())
            .startAt('diary-')
            .endAt('diary-\uf8ff');
        const snapshot1 = await q1.get();
        console.log(`Found ${snapshot1.size} documents.`);
        snapshot1.forEach(doc => {
            console.log(`- Doc ID: ${doc.id}, role: ${doc.data().role}, content preview: ${(doc.data().content || '').substring(0, 60)}`);
        });
    } catch (e) {
        console.error("Method 1 failed:", e);
    }

    // Attempt 2: Fetch 20 docs
    console.log("\n--- Method 2: Fetch 20 docs ---");
    try {
        const snapshot2 = await segmentsRef.limit(20).get();
        console.log(`Found ${snapshot2.size} total docs in collection.`);
        snapshot2.forEach(doc => {
            console.log(`- Doc ID: ${doc.id}, role: ${doc.data().role}, content preview: ${(doc.data().content || '').substring(0, 60)}`);
        });
    } catch (e) {
        console.error("Method 2 failed:", e);
    }
}

testQuery();
