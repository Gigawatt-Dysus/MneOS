
import * as admin from 'firebase-admin';

// Attempt to initialize with default credentials (local emulator or gcloud auth)
if (!admin.apps.length) {
    try {
        const serviceAccount = require('../../service-account.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        console.log("Service account not found, trying default app init...");
        admin.initializeApp();
    }
}

const db = admin.firestore();
const USER_ID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

async function main() {
    console.log(`\n🔍 INSPECTING HEALED MESSAGES for User: ${USER_ID}\n`);

    const collectionRef = db.collection('users').doc(USER_ID).collection('chat_segments');

    // Look for recent messages to spot the "empty" ones
    const q = collectionRef.orderBy('timestamp', 'desc').limit(20);
    const snapshot = await q.get();

    snapshot.forEach(doc => {
        const d = doc.data();
        const c = d.content;

        // Print everything for visibility
        console.log(`\n--------------------------------------------------`);
        console.log(`📄 DOC ID: ${doc.id}`);
        console.log(`   - role: ${d.role}`);
        console.log(`   - content (RAW): "${c}"`);
        console.log(`   - type of content: ${typeof c}`);
        console.log(`   - originalContentSnapshot:`);
        console.log(`     "${d.originalContentSnapshot}"`);
        console.log(`   - isHealed: ${d.isHealed}`);
        console.log(`   - healedAt: ${d.healedAt ? d.healedAt.toDate() : 'N/A'}`);
        console.log(`   - timestamp: ${d.timestamp ? d.timestamp.toDate() : 'N/A'}`);
    });
}

main().catch(console.error);
