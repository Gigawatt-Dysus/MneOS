const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('../../../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

async function main() {
    console.log(`\n=== FORENSIC AUDIT: Wyatt and Alex Artifact ===\n`);

    const mediaSnap = await db
        .collection('users').doc(UID)
        .collection('media')
        .get();

    mediaSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.title && data.title.includes('Wyatt and Alex')) {
            console.log(`FOUND ARTIFACT: ${doc.id}`);
            console.log(`Title: ${data.title}`);
            console.log(`URL: ${data.url}`);
            console.log(`Thumbnail: ${data.thumbnailUrl}`);
            console.log(`File Type: ${data.fileType}`);
            console.log(`Tag IDs: ${JSON.stringify(data.tagIds)}`);
        }
    });

    console.log('\n=== DONE ===\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
