/**
 * REPAIR LINKS V10: The "Typos Fixer"
 * * PROBLEM: URLs have literal slashes '/' instead of '%2F'.
 * * SOLUTION: Rewrites the Firestore strings to strict URI encoding.
 * * Usage: node repair-links.cjs
 */

const admin = require('firebase-admin');
const fs = require('fs');

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

// The Fixer Function
const fixUrl = (brokenUrl) => {
    if (!brokenUrl) return null;
    if (!brokenUrl.includes(STORAGE_BUCKET)) return brokenUrl; // Skip external links

    try {
        // 1. Extract the "Path" part between /o/ and ?alt
        const prefix = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/`;
        const suffix = `?alt=media`;
        
        if (!brokenUrl.startsWith(prefix)) return brokenUrl;

        // Extract the messy middle part
        const rawMiddle = brokenUrl.substring(prefix.length).split('?')[0];
        
        // 2. Decode fully (turn %20 back to space, etc) to get raw file path
        const decodedPath = decodeURIComponent(rawMiddle);
        
        // 3. Re-Encode STRICTLY (turns space to %20 AND slash to %2F)
        const cleanMiddle = encodeURIComponent(decodedPath);

        return `${prefix}${cleanMiddle}${suffix}`;
    } catch (e) {
        return brokenUrl;
    }
};

async function runLinkRepair() {
    console.log("🔗 Starting LINK REPAIR (Fixing URL Encoding)...");
    
    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef.get();

    if (snapshot.empty) {
        console.log("No media found.");
        return;
    }

    console.log(`Scanning ${snapshot.size} artifacts...`);
    let fixedCount = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const thumbs = data.thumbnailUrls || {};
        let updates = {};
        let needsUpdate = false;

        // Check and Fix Small
        if (thumbs.small && thumbs.small.includes(STORAGE_BUCKET) && !thumbs.small.includes('%2F')) {
            thumbs.small = fixUrl(thumbs.small);
            needsUpdate = true;
        }
        // Check and Fix Medium
        if (thumbs.medium && thumbs.medium.includes(STORAGE_BUCKET) && !thumbs.medium.includes('%2F')) {
            thumbs.medium = fixUrl(thumbs.medium);
            needsUpdate = true;
        }
        // Check and Fix Large
        if (thumbs.large && thumbs.large.includes(STORAGE_BUCKET) && !thumbs.large.includes('%2F')) {
            thumbs.large = fixUrl(thumbs.large);
            needsUpdate = true;
        }

        if (needsUpdate) {
            updates.thumbnailUrls = thumbs;
            updates.repairVersion = 10; // Mark as "Link Fixed"
            
            batch.update(doc.ref, updates);
            batchCount++;
            fixedCount++;
        }

        // Commit batches of 400
        if (batchCount >= 400) {
            await batch.commit();
            process.stdout.write('.');
            batch = db.batch();
            batchCount = 0;
        }
    }

    // Commit leftovers
    if (batchCount > 0) await batch.commit();

    console.log(`\n\n✨ Link Repair Complete.`);
    console.log(`Records Fixed: ${fixedCount}`);
    console.log("👉 REFRESH APP NOW.");
}

runLinkRepair();