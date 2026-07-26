const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.resolve(__dirname, '../../../serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';
const ALEX_ID = 'tag-1765458513866';

async function main() {
    console.log(`\n=== REVERSE LOOKUP: Searching for Media tagged with ${ALEX_ID} ===\n`);

    const mediaSnap = await db
        .collection('users').doc(UID)
        .collection('media')
        .where('tagIds', 'array-contains', ALEX_ID)
        .get();

    console.log(`Total Media Artifacts found: ${mediaSnap.size}\n`);

    mediaSnap.docs.forEach((doc, i) => {
        const data = doc.data();
        console.log(`[${i}] ID: ${doc.id}`);
        console.log(`    Title: ${data.title || 'Untitled'}`);
        console.log(`    URL: ${data.url ? data.url.substring(0, 70) + '...' : '⚠️  MISSING'}`);
        console.log(`    Date: ${data.logicalDate || data.uploadDate || 'Unknown'}`);
    });

    console.log('\n=== DONE ===\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
