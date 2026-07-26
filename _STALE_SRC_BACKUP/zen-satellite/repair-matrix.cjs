/**
 * FINALIZE MATRIX (VERBOSE): Trust But Verify
 * * 1. Reads & Logs Dimensions (Visual confirmation).
 * 2. Stamps 'firebaseStorageDownloadTokens' (Fixes Console Spinner).
 * 3. Sets 'public' access (Fixes App 403 Forbidden).
 * * Usage: node finalize-matrix-verbose.cjs
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
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
const bucket = admin.storage().bucket();

// Helper: Generate Token
const generateToken = () => {
    return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
};

// Helper: Extract Path
const getPathFromUrl = (url) => {
    try {
        const regex = /\/o\/(.*?)\?alt=media/;
        const match = url.match(regex);
        if (match && match[1]) return decodeURIComponent(match[1]);
        return null;
    } catch (e) { return null; }
};

async function runVerboseFinalize() {
    console.log("📠 Starting VERBOSE FINALIZATION (Telemetry Mode)...");
    
    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef.get();

    if (snapshot.empty) {
        console.log("No media found.");
        return;
    }

    console.log(`Auditing ${snapshot.size} artifacts...`);
    let updatedCount = 0;
    let errorCount = 0;

    // Process sequentially so the logs don't get jumbled
    for (const [index, doc] of snapshot.docs.entries()) {
        const data = doc.data();
        const thumbs = data.thumbnailUrls || {};
        
        // --- THE VISUAL VERIFICATION ---
        const dims = (data.width && data.height) ? `${data.width}x${data.height}` : "UNKNOWN";
        const name = data.originalName || doc.id;
        
        // Collect all URLs associated with this record
        const urlsToFix = [
            data.url, 
            thumbs.small, 
            thumbs.medium, 
            thumbs.large
        ].filter(u => u);

        if (urlsToFix.length === 0) {
            console.log(`[${index + 1}] ⚠️  ${name} | No Files Linked`);
            continue;
        }

        // Print the line YOU want to see
        console.log(`[${index + 1}] ${name.padEnd(30)} | Dims: ${dims.padEnd(10)} | Polishing ${urlsToFix.length} files...`);

        for (const url of urlsToFix) {
            const filePath = getPathFromUrl(url);
            if (filePath) {
                try {
                    const file = bucket.file(filePath);
                    
                    // 1. Stamp Token (Fixes Spinner)
                    await file.setMetadata({
                        metadata: { firebaseStorageDownloadTokens: generateToken() }
                    });

                    // 2. Make Public (Fixes App)
                    await file.makePublic();
                    
                } catch (e) {
                    // Ignore 404s if a specific size is missing, but log others
                    if (e.code !== 404) {
                        console.error(`      ❌ Failed on file: ${filePath} (${e.message})`);
                        errorCount++;
                    }
                }
            }
        }
        updatedCount++;
    }

    console.log(`\n\n✨ Audit & Polish Complete.`);
    console.log(`Records Processed: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
}

runVerboseFinalize();