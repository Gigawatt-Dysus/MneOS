const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('../../../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';

async function main() {
    console.log(`\n=== SOVEREIGN REPAIR: Wyatt and Alex URL ===\n`);

    const mediaId = 'LYXWxWRPxPMqPMICL8Cz';
    const mediaRef = db.collection('users').doc(UID).collection('media').doc(mediaId);
    
    const doc = await mediaRef.get();
    if (!doc.exists) {
        console.log('Artifact not found.');
        process.exit(1);
    }

    const data = doc.data();
    const oldUrl = data.url;
    
    // Check if it's missing the bucket prefix
    if (oldUrl.includes('media.gigiwatt.com/') && !oldUrl.includes('/file/LifeOS-Media/')) {
        const newUrl = oldUrl.replace('media.gigiwatt.com/', 'media.gigiwatt.com/file/LifeOS-Media/');
        console.log(`REPAIRING URL:\nOLD: ${oldUrl}\nNEW: ${newUrl}`);
        
        await mediaRef.update({
            url: newUrl,
            fileType: 'image/jpeg', // Ensure type is set
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ URL Repaired.');
    } else {
        console.log('URL already has prefix or is not a gigiwatt link.');
    }

    console.log('\n=== DONE ===\n');
    process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
