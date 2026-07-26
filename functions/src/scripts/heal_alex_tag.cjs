const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('../../../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';
const ALEX_ID = 'tag-1765458513866';

async function main() {
    console.log(`\n=== SOVEREIGN HEAL: Synchronizing Media for Alex (${ALEX_ID}) ===\n`);

    // 1. Get all media tagged with Alex
    const mediaSnap = await db
        .collection('users').doc(UID)
        .collection('media')
        .where('tagIds', 'array-contains', ALEX_ID)
        .get();

    console.log(`Found ${mediaSnap.size} artifacts claiming to be Alex.`);

    const mediaIds = [];
    const mediaGallery = [];

    // 2. Build fresh Gallery and ID list
    mediaSnap.docs.forEach(doc => {
        const data = doc.data();
        mediaIds.push(doc.id);
        
        mediaGallery.push({
            mediaId: doc.id,
            type: data.fileType?.startsWith('video') ? 'video' : 'image',
            url: data.url,
            caption: data.title || data.caption || 'Memory',
            date: data.logicalDate || data.uploadDate || null
        });
    });

    // Sort by date (descending)
    mediaGallery.sort((a, b) => {
        const dateA = a.date ? (a.date._seconds ? a.date._seconds * 1000 : new Date(a.date).getTime()) : 0;
        const dateB = b.date ? (b.date._seconds ? b.date._seconds * 1000 : new Date(b.date).getTime()) : 0;
        return dateB - dateA;
    });

    // 3. Commit the Heal
    const tagRef = db.collection('users').doc(UID).collection('tags').doc(ALEX_ID);
    await tagRef.update({
        mediaIds: mediaIds,
        mediaGallery: mediaGallery.slice(0, 100), // Keep it lean for performance
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`\n✅ HEAL COMPLETE: Alex Carter now has ${mediaIds.length} memories stitched.`);
    console.log(`   Gallery refreshed with ${mediaGallery.length} entries.`);

    console.log('\n=== DONE ===\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
