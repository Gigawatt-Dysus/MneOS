const admin = require('firebase-admin');
const path = require('path');
const axios = require('axios');
const serviceAccount = require('../../../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

async function main() {
    console.log(`\n=== SEARCH BACKFILL: Indexing 2010 Artifacts ===\n`);

    // 1. Get Typesense Config
    const configRef = await db.collection('users').doc(UID).collection('zen_config').doc('main').get();
    const config = configRef.data();
    if (!config || !config.typesenseHost || !config.typesenseKey) {
        console.error('❌ Typesense config missing!');
        process.exit(1);
    }

    // 2. Query for 2010 media
    // We'll look for anything with year '2010' or dateStr '2010'
    const mediaSnap = await db
        .collection('users').doc(UID)
        .collection('media')
        .where('dateStr', '==', '2010')
        .get();

    console.log(`Found ${mediaSnap.size} artifacts from 2010.`);

    for (const doc of mediaSnap.docs) {
        const media = doc.data();
        const id = doc.id;
        
        const ts = media.logicalDate ? (media.logicalDate._seconds ? media.logicalDate._seconds * 1000 : new Date(media.logicalDate).getTime()) : 
                   (media.uploadDate ? (media.uploadDate._seconds ? media.uploadDate._seconds * 1000 : new Date(media.uploadDate).getTime()) : Date.now());

        const document = {
            id: id,
            title: media.title || '',
            description: media.description || '',
            originalName: media.originalName || '',
            tags: media.tagIds || [],
            year: '2010',
            type: media.fileType?.startsWith('video') ? 'video' : 'image',
            timestamp: Math.floor(ts / 1000),
            address: media.location?.address || '',
            userId: UID
        };

        try {
            const url = `https://${config.typesenseHost}/collections/media_v1/documents?action=upsert`;
            await axios.post(url, document, {
                headers: {
                    'X-TYPESENSE-API-KEY': config.typesenseKey,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`✅ Indexed: ${id} - ${media.title || 'Untitled'}`);
        } catch (e) {
            console.error(`❌ Failed to index ${id}:`, e.response?.data || e.message);
        }
    }

    console.log('\n=== BACKFILL COMPLETE ===\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
