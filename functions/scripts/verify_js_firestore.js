// Disable OpenTelemetry to prevent gRPC crashes in this environment
process.env.OTEL_SDK_DISABLED = "true";

const admin = require('firebase-admin');

// Initialize with default credentials
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}
const db = admin.firestore();

async function run() {
    const uid = "9MPVGVTxE8dXvkCrl1XrWHQzCl23";
    console.log(`[Verify] Scanning for Rescued/Naked records for ${uid}...`);

    try {
        const snap = await db.collection('users').doc(uid).collection('chat_segments')
            .where('rescued', '==', true)
            .limit(1)
            .get();

        if (snap.empty) {
            console.log("No 'rescued' records found.");
            return;
        }

        const doc = snap.docs[0];
        const data = doc.data();

        console.log(`\n=== RECORD: ${doc.id} ===`);
        console.log(`Source: ${data.source}`);
        console.log(`Rescued Flag: ${data.rescued}`);
        console.log(`Metadata:`, JSON.stringify(data.search_metadata, null, 2));

        if (data.search_metadata && data.search_metadata.keywords) {
            console.log("STATUS: ✅ ENRICHED");
        } else {
            console.log("STATUS: ❌ NAKED (Confirming user report)");
        }

    } catch (e) {
        console.error("CRASH:", e);
    }
}

run();
