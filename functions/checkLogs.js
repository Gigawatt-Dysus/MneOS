const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkLogs() {
    console.log("🕵️ Checking Flight Recorder logs...");
    const snapshot = await db.collection('debug_logs').orderBy('timestamp', 'desc').limit(5).get();
    
    if (snapshot.empty) {
        console.log("📭 Flight Recorder is empty.");
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\n--- Log: ${doc.id} ---`);
        console.log(`Time: ${data.timestamp?.toDate().toLocaleString()}`);
        console.log(`Action: ${data.action}`);
        console.log(`Data: ${JSON.stringify(data.data, null, 2)}`);
        if (data.error) console.error(`Error: ${data.error}`);
    });
}

checkLogs();
