/**
 * RELINK MATRIX: The "Mapper"
 * * PROBLEM: Thumbnails exist in Storage, but Firestore doesn't know about them.
 * * SOLUTION: Predicts the thumbnail URLs based on file naming conventions 
 * and writes them to the database.
 * * Usage: node relink-matrix.cjs
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const serviceAccountPath = './serviceAccountKey.json';
const TARGET_UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23';
const STORAGE_BUCKET = 'gigi-time-machine.firebasestorage.app'; 
// ---------------------

if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ ERROR: serviceAccountKey.json not found.");
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
  storageBucket: STORAGE_BUCKET
});

const db = admin.firestore();

// Helper: Construct Public URL properly (handling the %2F issue)
const constructPublicUrl = (storagePath) => {
    if (!storagePath) return null;
    // Ensure no leading slash
    const cleanPath = storagePath.startsWith('/') ? storagePath.slice(1) : storagePath;
    // Encode every segment (e.g. "1997" and "Jennifer file.jpg")
    const encodedPath = cleanPath.split('/').map(encodeURIComponent).join('%2F');
    return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media`;
};

async function runRelinkProtocol() {
    console.log("🔗 Starting RELINK PROTOCOL (Connecting DB to Existing Files)...");
    
    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef.get();

    if (snapshot.empty) {
        console.log("No media found.");
        return;
    }

    console.log(`Auditing ${snapshot.size} index cards...`);
    let updatedCount = 0;
    let skippedCount = 0;

    for (const [index, doc] of snapshot.docs.entries()) {
        const data = doc.data();
        const docId = doc.id;
        let updates = {};
        let needsUpdate = false;

        // Check if thumbnails are missing
        if (!data.thumbnailUrls || !data.thumbnailUrls.medium) {
            
            // We need a base path to guess the thumbnail location
            let basePath = data.storagePath;
            
            // Fallback: If storagePath is missing, try to derive it from the Name
            // (This matches the logic used in previous repair scripts)
            if (!basePath && data.originalName) {
                basePath = `users/${TARGET_UID}/uploads/${data.originalName}`;
            }

            if (basePath) {
                const dir = path.dirname(basePath);
                const ext = path.extname(basePath);
                const name = path.basename(basePath, ext);

                // PREDICT THE PATHS based on your screenshot naming convention
                // Example: "Jennifer - age ~11" -> "Jennifer - age ~11_medium.jpg"
                const smallPath = path.join(dir, `${name}_small.jpg`).replace(/\\/g, '/');
                const mediumPath = path.join(dir, `${name}_medium.jpg`).replace(/\\/g, '/');
                const largePath = path.join(dir, `${name}_large.jpg`).replace(/\\/g, '/');

                updates.thumbnailUrls = {
                    small: constructPublicUrl(smallPath),
                    medium: constructPublicUrl(mediumPath),
                    large: constructPublicUrl(largePath)
                };
                
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            await doc.ref.update({
                ...updates,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                relinkVersion: 1
            });
            console.log(`[${index + 1}] 🔗 Linked: ${data.originalName || docId}`);
            updatedCount++;
        } else {
            skippedCount++;
            process.stdout.write('.');
        }
    }

    console.log(`\n\n✨ Relinking Complete.`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (Already Linked): ${skippedCount}`);
    console.log("👉 REFRESH APP NOW.");
}

runRelinkProtocol();