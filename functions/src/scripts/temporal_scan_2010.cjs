const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('../../../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

async function main() {
    console.log(`\n=== TEMPORAL SCAN: Searching for any Media in 2010 ===\n`);

    const start = new Date('2010-01-01T00:00:00Z');
    const end = new Date('2010-12-31T23:59:59Z');

    const mediaSnap = await db
        .collection('users').doc(UID)
        .collection('media')
        .where('logicalDate', '>=', start)
        .where('logicalDate', '<=', end)
        .get();

    console.log(`Found ${mediaSnap.size} artifacts in the year 2010.`);

    mediaSnap.docs.forEach((doc, i) => {
        const data = doc.data();
        console.log(`[${i}] ID: ${doc.id} | Title: ${data.title || 'Untitled'} | Date: ${data.logicalDate.toDate().toISOString()}`);
    });

    console.log('\n=== DONE ===\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
