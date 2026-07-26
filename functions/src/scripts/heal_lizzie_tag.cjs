const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('../../../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

async function main() {
    console.log(`\n=== SOVEREIGN HEAL: Searching for Lizzie ===\n`);

    const tagsSnap = await db
        .collection('users').doc(UID)
        .collection('tags')
        .where('type', '==', 'person')
        .get();

    const lizzieTags = tagsSnap.docs.filter(d =>
        (d.data().name || '').toLowerCase().includes('lizzie')
    );

    if (lizzieTags.length === 0) {
        console.log('No Lizzie tag found.');
        process.exit(0);
    }

    for (const doc of lizzieTags) {
        const data = doc.data();
        const tid = doc.id;
        console.log(`Found: "${data.name}" [ID: ${tid}]`);

        const mediaSnap = await db
            .collection('users').doc(UID)
            .collection('media')
            .where('tagIds', 'array-contains', tid)
            .get();

        console.log(`Found ${mediaSnap.size} artifacts for Lizzie.`);

        const mediaIds = [];
        const mediaGallery = [];

        mediaSnap.docs.forEach(mDoc => {
            const mData = mDoc.data();
            mediaIds.push(mDoc.id);
            mediaGallery.push({
                mediaId: mDoc.id,
                type: mData.fileType?.startsWith('video') ? 'video' : 'image',
                url: mData.url,
                caption: mData.title || mData.caption || 'Memory',
                date: mData.logicalDate || mData.uploadDate || null
            });
        });

        // Sort by date (descending)
        mediaGallery.sort((a, b) => {
            const dateA = a.date ? (a.date._seconds ? a.date._seconds * 1000 : new Date(a.date).getTime()) : 0;
            const dateB = b.date ? (b.date._seconds ? b.date._seconds * 1000 : new Date(b.date).getTime()) : 0;
            return dateB - dateA;
        });

        await db.collection('users').doc(UID).collection('tags').doc(tid).update({
            mediaIds: mediaIds,
            mediaGallery: mediaGallery.slice(0, 100),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✅ Lizzie HEALED with ${mediaIds.length} memories.`);
    }

    console.log('\n=== DONE ===\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
