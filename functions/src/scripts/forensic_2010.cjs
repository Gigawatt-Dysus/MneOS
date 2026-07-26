const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('../../../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

async function main() {
    console.log(`\n=== FORENSIC SEARCH: Searching for '2010' in Metadata ===\n`);

    const mediaSnap = await db
        .collection('users').doc(UID)
        .collection('media')
        .get();

    let foundCount = 0;
    mediaSnap.docs.forEach(doc => {
        const data = doc.data();
        const searchString = `${data.title} ${data.description} ${data.originalName} ${data.dateStr}`.toLowerCase();
        
        if (searchString.includes('2010')) {
            console.log(`Found: ${doc.id} | Title: ${data.title || 'Untitled'} | DateStr: ${data.dateStr || 'None'}`);
            foundCount++;
        }
    });

    console.log(`\nTotal Metadata Matches for '2010': ${foundCount}`);
    console.log('\n=== DONE ===\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
