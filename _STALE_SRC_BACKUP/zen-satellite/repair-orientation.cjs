/**
 * REPAIR ORIENTATION: The "Gyroscope"
 * * PROBLEM: 'sharp' reads raw dimensions (Landscape), but Browser renders rotated (Portrait).
 * * RESULT: Aspect Ratio Mismatch -> Layout Explosion.
 * * SOLUTION: Detect EXIF Orientation. If rotated (5-8), SWAP Width/Height in DB.
 * * Usage: node repair-orientation.cjs
 */

const admin = require('firebase-admin');
const sharp = require('sharp');
const fs = require('fs');

// --- ROBUST FETCH LOADER ---
const fetch = global.fetch || require('node-fetch');

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

async function runOrientationRepair() {
    console.log("📐 Starting ORIENTATION REPAIR (The 'Selfie' Fix)...");
    
    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef.get();

    if (snapshot.empty) { console.log("No media found."); return; }

    console.log(`Checking ${snapshot.size} artifacts for EXIF Rotation...`);
    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const [index, doc] of snapshot.docs.entries()) {
        const data = doc.data();
        
        // Filter: Images only
        const isImage = (data.fileType && data.fileType.startsWith('image/')) || 
                        (data.originalName && /\.(jpg|jpeg|png|webp|gif)$/i.test(data.originalName));

        if (!isImage || !data.url) { skippedCount++; continue; }

        try {
            const response = await fetch(data.url);
            if (!response.ok) throw new Error("Fetch failed");
            
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const metadata = await sharp(buffer).metadata();
            
            // --- THE LOGIC ---
            // Orientation 5, 6, 7, 8 imply 90 or 270 degree rotation.
            // We must SWAP width/height to match what the browser renders.
            const isRotated = metadata.orientation && metadata.orientation >= 5;
            
            let trueWidth = metadata.width;
            let trueHeight = metadata.height;

            if (isRotated) {
                // SWAP!
                trueWidth = metadata.height;
                trueHeight = metadata.width;
            }

            // Check if DB disagrees with Visual Reality
            if (data.width !== trueWidth || data.height !== trueHeight) {
                console.log(`\n[${index + 1}] 🔄 Fixing Rotation: ${data.originalName}`);
                console.log(`      DB Says: ${data.width} x ${data.height}`);
                console.log(`      Real Visual: ${trueWidth} x ${trueHeight} (Orientation: ${metadata.orientation || 'Normal'})`);
                
                await doc.ref.update({
                    width: trueWidth,
                    height: trueHeight,
                    orientationFixed: true,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                fixedCount++;
            } else {
                process.stdout.write('.');
            }

        } catch (err) {
            // console.error(`Err: ${err.message}`);
            errorCount++;
        }
    }

    console.log(`\n\n✨ Orientation Fix Complete.`);
    console.log(`Fixed/Swapped: ${fixedCount}`);
    console.log(`Skipped/Correct: ${skippedCount}`);
}

runOrientationRepair();