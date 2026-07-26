/**
 * FORCE RELINK V11: The "Fresh Start"
 * * PROBLEM: Previous scripts failed to detect/fix the bad URLs.
 * * SOLUTION: Ignores current URLs. Reads 'storagePath' (Source of Truth) 
 * and generates brand new, strictly encoded URLs for S/M/L.
 * * Usage: node force-relink-v11.cjs
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

// Helper: Strict URL Construction
const constructPublicUrl = (storagePath) => {
    if (!storagePath) return null;
    
    // 1. Clean leading slash
    const cleanPath = storagePath.startsWith('/') ? storagePath.slice(1) : storagePath;
    
    // 2. Encode EVERY segment. 
    // "1972/Eric File.jpg" -> "1972%2FEric%20File.jpg"
    // This is the critical step the previous scripts might have missed on existing data
    const encodedPath = cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('%2F');
    
    return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}?alt=media`;
};

async function runForceRelink() {
    console.log("🔗 Starting FORCE RELINK V11 (Overwrite Mode)...");
    
    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef.get();

    if (snapshot.empty) {
        console.log("No media found.");
        return;
    }

    console.log(`Targeting ${snapshot.size} artifacts...`);
    let fixedCount = 0;
    let skippedCount = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const [index, doc] of snapshot.docs.entries()) {
        const data = doc.data();
        let basePath = data.storagePath;

        // Fallback: If storagePath is missing, assume a default structure
        if (!basePath && data.originalName) {
            // If we don't have a path, we can't generate a link safely.
            // Log it and skip to avoid generating bad links.
            console.warn(`[${index + 1}] ⚠️ Skipping ${data.originalName}: No storagePath found.`);
            skippedCount++;
            continue;
        }

        // Parse path
        const dir = path.dirname(basePath);
        const ext = path.extname(basePath);
        const name = path.basename(basePath, ext);

        // Generate NEW, Clean URLs
        const newThumbs = {
            small: constructPublicUrl(path.join(dir, `${name}_small.jpg`).replace(/\\/g, '/')),
            medium: constructPublicUrl(path.join(dir, `${name}_medium.jpg`).replace(/\\/g, '/')),
            large: constructPublicUrl(path.join(dir, `${name}_large.jpg`).replace(/\\/g, '/'))
        };

        // Add to Batch
        batch.update(doc.ref, {
            thumbnailUrls: newThumbs,
            relinkVersion: 11,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        batchCount++;
        fixedCount++;

        // Verbose check for the first one to prove it works
        if (fixedCount === 1) {
            console.log(`[First Fix Log] ${data.originalName}`);
            console.log(`   Path: ${basePath}`);
            console.log(`   New URL: ${newThumbs.medium}`);
        }

        // Commit Batches
        if (batchCount >= 400) {
            await batch.commit();
            process.stdout.write('.');
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) await batch.commit();

    console.log(`\n\n✨ Force Relink Complete.`);
    console.log(`Overwritten: ${fixedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log("👉 REFRESH APP NOW.");
}

runForceRelink();