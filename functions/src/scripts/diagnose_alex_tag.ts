/**
 * DIAGNOSTIC SCRIPT — READ ONLY
 * Finds the "Alex" person tag and reports its mediaGallery / mediaIds state.
 * Run with: npx ts-node src/scripts/diagnose_alex_tag.ts
 */
import * as admin from 'firebase-admin';
import * as path from 'path';

// Point at your service account key — adjust path if needed
const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccountPath) });

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

    // Find any tag whose name contains "Alex"
    const alexTags = tagsSnap.docs.filter(d =>
        (d.data().name || '').toLowerCase().includes('alex')
    );

    if (alexTags.length === 0) {
        console.log('❌ No person tag found with "Alex" in the name.');
        console.log('\nAll person tag names:');
        tagsSnap.docs.forEach(d => console.log(` - [${d.id}] ${d.data().name}`));
        process.exit(0);
    }

    for (const doc of alexTags) {
        const data = doc.data();
        console.log(`\n✅ Found: "${data.name}" [ID: ${doc.id}]`);
        console.log(`   Type: ${data.type}`);

        const mediaIds: string[] = data.mediaIds || [];
        console.log(`\n   mediaIds count: ${mediaIds.length}`);
        if (mediaIds.length > 0) {
            console.log('   First 10 IDs:', mediaIds.slice(0, 10));
        }

        const gallery: any[] = data.mediaGallery || [];
        console.log(`\n   mediaGallery count: ${gallery.length}`);
        let emptyUrlCount = 0;
        let noMediaIdCount = 0;
        gallery.forEach((entry, i) => {
            const hasUrl = entry.url && typeof entry.url === 'string' && entry.url.startsWith('http');
            const hasMediaId = !!entry.mediaId;
            if (!hasUrl) emptyUrlCount++;
            if (!hasMediaId) noMediaIdCount++;
            if (i < 15) {
                console.log(`   [${i}] mediaId=${entry.mediaId || 'MISSING'} | url=${hasUrl ? entry.url.substring(0, 60) + '...' : '⚠️  EMPTY/BAD: ' + JSON.stringify(entry.url)}`);
            }
        });

        if (gallery.length > 15) {
            console.log(`   ... and ${gallery.length - 15} more entries`);
        }

        console.log(`\n   ⚠️  Entries with bad/empty URL: ${emptyUrlCount}`);
        console.log(`   ⚠️  Entries with missing mediaId: ${noMediaIdCount}`);
    }

    console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
    process.exit(0);
}

main().catch(e => {
    console.error('FATAL:', e.message);
    process.exit(1);
});
