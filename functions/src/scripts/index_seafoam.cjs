const admin = require('firebase-admin');
const path = require('path');
const axios = require('axios');
const serviceAccount = require('../../../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';
const ARTIFACT_ID = 'wzYAGAXlx9wYcc7mWPPP';

async function main() {
    console.log(`\n=== TARGETED INDEX: Sea Foam Motel (${ARTIFACT_ID}) ===\n`);

    const configRef = await db.collection('users').doc(UID).collection('zen_config').doc('main').get();
    const config = configRef.data();
    
    const mediaDoc = await db.collection('users').doc(UID).collection('media').doc(ARTIFACT_ID).get();
    const media = mediaDoc.data();

    const document = {
        id: ARTIFACT_ID,
        title: media.title || '',
        description: media.description || '',
        originalName: media.originalName || '',
        tags: media.tagIds || [],
        year: '2010',
        type: 'image',
        timestamp: Math.floor(new Date('2010-01-01T05:00:00Z').getTime() / 1000),
        address: media.location?.address || 'Sea Foam Motel, Nags Head',
        userId: UID
    };

    const url = `https://${config.typesenseHost}/collections/media_v1/documents?action=upsert`;
    await axios.post(url, document, {
        headers: {
            'X-TYPESENSE-API-KEY': config.typesenseKey,
            'Content-Type': 'application/json'
        }
    });

    console.log(`✅ SUCCESS: Sea Foam Motel indexed for 2010.`);
    process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.response?.data || e.message); process.exit(1); });
