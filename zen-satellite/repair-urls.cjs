/**
 * REPAIR URLS: The "Typo Fixer"
 * * PROBLEM: URLs contain literal slashes '/' which Google rejects.
 * * SOLUTION: Scans existing links and converts '/' to '%2F'.
 * * Usage: node repair-urls.cjs
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

// The Fixer Logic
const fixUrl = (brokenUrl) => {
    if (!brokenUrl || typeof brokenUrl !== 'string') return brokenUrl;
    
    // We only care about our bucket URLs
    const prefix = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/`;
    
    if (!brokenUrl.startsWith(prefix)) return brokenUrl;

    // Extract the part BETWEEN '/o/' and '?alt=media'
    // Example Broken: 1972/Eric.jpg
    // Example Fixed:  1972%2FEric.jpg
    const parts = brokenUrl.split(prefix);
    const suffixParts = parts[1].split('?');
    
    const objectPath = suffixParts[0];
    const queryParams = suffixParts[1] ? `?${suffixParts[1]}` : '';

    // If the object path contains a literal slash, it's broken
    if (objectPath.includes('/')) {
        // decodeURI first to be safe (handling %20 spaces), then encodeURIComponent strictly
        const safePath = encodeURIComponent(decodeURIComponent(objectPath));
        return `${prefix}${safePath}${queryParams}`;
    }

    return brokenUrl; // Was already correct
};

async function runUrlRepair() {
    console.log("🔗 Starting URL REPAIR (Encoding Fixer)...");
    
    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef.get();

    if (snapshot.empty) {
        console.log("No media found.");
        return;
    }

    console.log(`Scanning ${snapshot.size} artifacts for bad slashes...`);
    let fixedCount = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const [index, doc] of snapshot.docs.entries()) {
        const data = doc.data();
        const thumbs = data.thumbnailUrls || {};
        let updates = {};
        let needsUpdate = false;

        const oldSmall = thumbs.small;
        const newSmall = fixUrl(oldSmall);
        
        const oldMedium = thumbs.medium;
        const newMedium = fixUrl(oldMedium);
        
        const oldLarge = thumbs.large;
        const newLarge = fixUrl(oldLarge);

        if (oldSmall !== newSmall) { thumbs.small = newSmall; needsUpdate = true; }
        if (oldMedium !== newMedium) { thumbs.medium = newMedium; needsUpdate = true; }
        if (oldLarge !== newLarge) { thumbs.large = newLarge; needsUpdate = true; }

        if (needsUpdate) {
            updates.thumbnailUrls = thumbs;
            updates.urlFixVersion = 1;
            
            batch.update(doc.ref, updates);
            batchCount++;
            fixedCount++;
            
            // Visual confirmation for the first few
            if (fixedCount <= 5) {
                console.log(`[${index}] Fixed Typo: ${data.originalName}`);
                console.log(`      WAS: ${oldMedium}`);
                console.log(`      NOW: ${newMedium}`);
            }
        }

        // Batch Commit (500 limit)
        if (batchCount >= 400) {
            await batch.commit();
            process.stdout.write('.');
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0) await batch.commit();

    console.log(`\n\n✨ URL Repair Complete.`);
    console.log(`Records Fixed: ${fixedCount}`);
    console.log("👉 Go Refresh The Matrix!");
}

runUrlRepair();