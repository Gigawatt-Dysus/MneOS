// DIAGNOSTIC SCRIPT — READ ONLY
// Usage: node src/scripts/diagnose_alex_tag.cjs

const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.resolve(__dirname, '../../../serviceAccountKey.json'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

async function main() {
    console.log('\n=== DIAGNOSTIC: Searching for Alex person tag ===\n');

    const tagsSnap = await db
        .collection('users').doc(UID)
        .collection('tags')
        .where('type', '==', 'person')
        .get();

    console.log(`Total person tags found: ${tagsSnap.size}\n`);

    const alexTags = tagsSnap.docs.filter(d =>
        (d.data().name || '').toLowerCase().includes('alex')
    );

    if (alexTags.length === 0) {
        console.log('No person tag found with "Alex" in the name.\n');
        console.log('All person tag names:');
        tagsSnap.docs.forEach(d => console.log(` - [${d.id}] ${d.data().name}`));
        process.exit(0);
    }

    for (const doc of alexTags) {
        const data = doc.data();
        console.log(`Found: "${data.name}" [ID: ${doc.id}]`);

        const mediaIds = data.mediaIds || [];
        console.log(`\nmediaIds count: ${mediaIds.length}`);
        console.log('First 10:', mediaIds.slice(0, 10));

        const gallery = data.mediaGallery || [];
        console.log(`\nmediaGallery count: ${gallery.length}`);

        let emptyUrlCount = 0;
        let noMediaIdCount = 0;

        gallery.forEach((entry, i) => {
            const hasUrl = entry.url && typeof entry.url === 'string' && entry.url.startsWith('http');
            const hasMediaId = !!entry.mediaId;
            if (!hasUrl) emptyUrlCount++;
            if (!hasMediaId) noMediaIdCount++;

            if (i < 20) {
                const urlStr = hasUrl
                    ? entry.url.substring(0, 70) + '...'
                    : `BAD: ${JSON.stringify(entry.url)}`;
                console.log(`  [${i}] mediaId=${entry.mediaId || 'MISSING'} | url=${urlStr}`);
            }
        });

        if (gallery.length > 20) console.log(`  ... and ${gallery.length - 20} more`);
        console.log(`\nEntries with bad/empty URL: ${emptyUrlCount}`);
        console.log(`Entries missing mediaId: ${noMediaIdCount}`);
    }

    console.log('\n=== DONE ===\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
