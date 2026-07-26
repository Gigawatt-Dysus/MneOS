/**
 * REPAIR FILE TYPES: The "Lazarus Protocol"
 * * DIAGNOSIS: Finds media records missing 'fileType' (Zombie Data).
 * * CURE: Infers MIME type from filename extension and updates the DB.
 * * USAGE: node dev-tools/repair-file-types.cjs
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const serviceAccountPath = './serviceAccountKey.json'; 
const TARGET_UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23'; 
// ---------------------

if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ ERROR: serviceAccountKey.json not found.");
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});

const db = admin.firestore();

// Extension -> MIME Type Map
const MIME_MAP = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'svg': 'image/svg+xml',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'webm': 'video/webm',
    'pdf': 'application/pdf',
    'txt': 'text/plain'
};

const getMimeType = (filename) => {
    if (!filename) return null;
    const ext = filename.split('.').pop().toLowerCase();
    return MIME_MAP[ext] || null;
};

async function runRepair() {
    console.log("🧪 INITIATING LAZARUS PROTOCOL...");
    console.log(`Target: ${TARGET_UID}`);
    
    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef.get();

    if (snapshot.empty) {
        console.log("No media found.");
        return;
    }

    console.log(`Scanning ${snapshot.size} artifacts for missing fileTypes...`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    let unknownCount = 0;
    let batch = db.batch();
    let batchOpCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const docId = doc.id;
        
        // Check if fileType is missing or invalid
        if (!data.fileType || data.fileType === '') {
            
            // Try to find the name to infer from
            const nameToParse = data.originalName || data.fileName || data.url || "";
            
            // Clean URL query params if using URL
            const cleanName = nameToParse.split('?')[0]; 
            
            const inferredMime = getMimeType(cleanName);

            if (inferredMime) {
                console.log(`🔧 FIXING: ${cleanName.substring(0, 40)}... -> ${inferredMime}`);
                
                batch.update(doc.ref, {
                    fileType: inferredMime,
                    metadataUpdated: admin.firestore.FieldValue.serverTimestamp(),
                    fileTypeRepaired: true
                });

                fixedCount++;
                batchOpCount++;

                if (batchOpCount >= 400) {
                    process.stdout.write('💾 Committing batch...');
                    await batch.commit();
                    batch = db.batch();
                    batchOpCount = 0;
                    console.log(' Done.');
                }
            } else {
                console.warn(`⚠️  COULD NOT INFER: ${nameToParse} (Doc ID: ${docId})`);
                unknownCount++;
            }
        } else {
            skippedCount++;
        }
    }

    if (batchOpCount > 0) await batch.commit();

    console.log("---------------------------------------------------");
    console.log(`🎉 REPAIR COMPLETE.`);
    console.log(`   Zombies Resurrected: ${fixedCount}`);
    console.log(`   Healthy Records: ${skippedCount}`);
    console.log(`   Unknown Types (Manual Fix Needed): ${unknownCount}`);
}

runRepair();