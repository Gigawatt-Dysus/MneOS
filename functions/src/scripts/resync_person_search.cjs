const admin = require('firebase-admin');
const path = require('path');
const axios = require('axios');
const serviceAccount = require('../../../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

// IDs found earlier
const ALEX_ID = 'tag-1765458513866';
const LIZZIE_ID = 'tag-new-1763324952564';

async function main() {
    console.log(`\n=== SEARCH RE-SYNC: Indexing Person-Linked Artifacts ===\n`);

    const configRef = await db.collection('users').doc(UID).collection('zen_config').doc('main').get();
    const config = configRef.data();

    // 1. Get all media for Alex and Lizzie
    const mediaSnap = await db
        .collection('users').doc(UID)
        .collection('media')
        .get();

    let syncedCount = 0;
    for (const doc of mediaSnap.docs) {
        const media = doc.data();
        const tagIds = media.tagIds || [];
        
        // If linked to Alex, Lizzie, or mentions 2010
        const isTarget = tagIds.includes(ALEX_ID) || 
                         tagIds.includes(LIZZIE_ID) || 
                         `${media.title} ${media.description} ${media.originalName}`.includes('2010');

        if (isTarget) {
            const ts = media.logicalDate ? (media.logicalDate._seconds ? media.logicalDate._seconds * 1000 : new Date(media.logicalDate).getTime()) : Date.now();
            
            const document = {
                id: doc.id,
                title: media.title || '',
                description: media.description || '',
                tags: tagIds,
                year: media.dateStr || 'Unknown',
                type: 'image',
                timestamp: Math.floor(ts / 1000),
                address: media.location?.address || '',
                userId: UID
            };

            try {
                const url = `https://${config.typesenseHost}/collections/media_v1/documents?action=upsert`;
                await axios.post(url, document, {
                    headers: { 'X-TYPESENSE-API-KEY': config.typesenseKey, 'Content-Type': 'application/json' }
                });
                console.log(`✅ Synced: ${doc.id}`);
                syncedCount++;
            } catch (e) {
                console.error(`❌ Fail ${doc.id}:`, e.message);
            }
        }
    }

    console.log(`\nTotal Matrix Synchronizations: ${syncedCount}`);
    console.log('\n=== DONE ===\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
