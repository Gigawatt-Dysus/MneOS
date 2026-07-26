/**
 * RETRO-THUMBNAILER: Backfills S/M/L thumbnails for existing media.
 * * WARNING: This script performs heavy network and CPU operations.
 * It may take several minutes to process 600+ images.
 * Keep your terminal open.
 */

const admin = require('firebase-admin');
const sharp = require('sharp');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

// --- CONFIGURATION ---
// Ensure this matches your actual service account file name
const serviceAccountPath = './serviceAccountKey.json'; 

// Replace with YOUR actual UID (grab it from Firestore if you don't know it)
const TARGET_UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23'; 

// Your Storage Bucket Name (found in firebaseConfig.ts)
const STORAGE_BUCKET = 'gigi-time-machine.firebasestorage.app';
// ---------------------

// --- SETUP CHECKS ---
if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ ERROR: Could not find ${serviceAccountPath}`);
    console.error("Please place your serviceAccountKey.json file in the project root.");
    process.exit(1);
}

if (TARGET_UID === 'YOUR_USER_ID_HERE') {
    console.error("❌ ERROR: Please update TARGET_UID in the script with your actual User ID.");
    process.exit(1);
}
// --------------------

// Initialize Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
  storageBucket: STORAGE_BUCKET
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const SIZES = {
    small: 150,  // max height
    medium: 350, // max height
    large: 800   // max height
};

// Helper to generate and upload a single thumbnail based on an original image buffer
async function generateAndUploadThumbnail(originalBuffer, originalPath, sizeKey, maxHeight) {
    // 1. Resize
    const resizedBuffer = await sharp(originalBuffer)
        .rotate() // [ZEN] CRITICAL FIX: Respect EXIF orientation before resizing
        .resize(null, maxHeight, { withoutEnlargement: true })
        .jpeg({ quality: 80 }) // Use JPEG for broad compatibility
        .toBuffer();

    // 2. Define path (e.g., .../myimage_medium.jpg)
    const extension = path.extname(originalPath);
    const basename = path.basename(originalPath, extension);
    // Construct new name in the same folder structure
    const newFilePath = path.join(path.dirname(originalPath), `${basename}_${sizeKey}.jpg`).replace(/\\/g, '/');
    
    // 3. Upload
    const file = bucket.file(newFilePath);
    await file.save(resizedBuffer, {
        metadata: { contentType: 'image/jpeg' },
        public: true, // Make publicly readable
    });

    // 4. Get Public URL
    // Need to URL encode the path parts to handle spaces/symbols
    const encodedPath = newFilePath.split('/').map(encodeURIComponent).join('/');
    return `https://storage.googleapis.com/${STORAGE_BUCKET}/${encodedPath}`;
}

async function runBackfill() {
    console.log("🚀 Starting Thumbnail Backfill Protocol...");
    console.log(`Target User: ${TARGET_UID}`);
    console.log("Gathering documents...");

    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef.get();

    if (snapshot.empty) {
        console.log("No media documents found.");
        return;
    }

    console.log(`Found ${snapshot.size} documents. Beginning processing...`);
    console.log("------------------------------------------------");

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Process sequentially to avoid overwhelming network/memory
    for (const [index, doc] of snapshot.docs.entries()) {
        const data = doc.data();
        const docId = doc.id;
        const progress = `[${index + 1}/${snapshot.size}]`;

        // Idempotency check: skip if already done
        if (data.thumbnailUrls && data.thumbnailUrls.medium) {
            console.log(`${progress} ⏭️ Skipping (Already processed): ${data.originalName}`);
            skipCount++;
            continue;
        }

        console.log(`${progress} 🔄 Processing: ${data.originalName || docId}...`);

        try {
            // A. Download Original Image
            if (!data.url) throw new Error("Missing original URL in document");
            const response = await fetch(data.url);
            if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
            const originalBuffer = await response.buffer();

            // Determine a fallback path if storagePath is missing (legacy data)
            // We'll put them in a 'legacy_thumbs' folder if we don't know where they belong.
            const safeStoragePath = data.storagePath || `users/${TARGET_UID}/legacy_thumbs/${data.originalName}`;

            // B. Generate All 3 Sizes
            const urls = {};
            urls.small = await generateAndUploadThumbnail(originalBuffer, safeStoragePath, 'small', SIZES.small);
            urls.medium = await generateAndUploadThumbnail(originalBuffer, safeStoragePath, 'medium', SIZES.medium);
            urls.large = await generateAndUploadThumbnail(originalBuffer, safeStoragePath, 'large', SIZES.large);

            // C. Update Firestore
            await doc.ref.update({
                thumbnailUrls: urls,
                backfillVersion: 1,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`   ✅ Success. Thumbnails generated and linked.`);
            successCount++;

        } catch (err) {
            console.error(`   ❌ FAILED: ${err.message}`);
            errorCount++;
        }
    }

    console.log("------------------------------------------------");
    console.log("🎉 Backfill Complete.");
    console.log(`Successfully Updated: ${successCount}`);
    console.log(`Skipped (Already Done): ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
}

runBackfill();