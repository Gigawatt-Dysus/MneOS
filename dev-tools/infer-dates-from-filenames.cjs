/**
 * INFER DATES FROM FILENAMES
 * * PURPOSE: Rescues files stripped of EXIF data by parsing their filenames.
 * * SUPPORTS: 
 * - Android/Pixel: 20230928_123000.jpg
 * - IMG Prefix:    IMG_20180608_194815.jpg
 * - PXL Prefix:    PXL_20230928_...
 * - Screenshot:    Screenshot_20221219...
 * - Dashed:        2021-05-31.jpg
 * * USAGE: node dev-tools/infer-dates-from-filenames.cjs
 */

const admin = require('firebase-admin');
const fs = require('fs');

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

// --- PARSING LOGIC ---
const parseFilenameDate = (filename) => {
    if (!filename) return null;
    const cleanName = filename.toUpperCase();

    // 1. Standard YYYYMMDD_HHMMSS (e.g., 20250304_161922.jpg, IMG_20180608_...)
    // Looks for 8 digits, maybe underscore, then 6 digits
    const standardRegex = /(\d{4})(\d{2})(\d{2})[-_](\d{2})(\d{2})(\d{2})/;
    const standardMatch = cleanName.match(standardRegex);

    if (standardMatch) {
        const [_, year, month, day, hour, min, sec] = standardMatch;
        return new Date(Date.UTC(year, month - 1, day, hour, min, sec));
    }

    // 2. Simple YYYYMMDD (e.g., Screenshot_20221219...)
    // We only match if it starts with a known prefix or is at the start to avoid random numbers
    const simpleRegex = /(?:IMG_|PXL_|SCREENSHOT_|VID_|^)(\d{4})(\d{2})(\d{2})/;
    const simpleMatch = cleanName.match(simpleRegex);

    if (simpleMatch) {
        const [_, year, month, day] = simpleMatch;
        // Default to noon if no time provided
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }
    
    // 3. Dashed YYYY-MM-DD (e.g., 2021-05-31.jpg)
    const dashedRegex = /(\d{4})-(\d{2})-(\d{2})/;
    const dashedMatch = cleanName.match(dashedRegex);
    
    if (dashedMatch) {
        const [_, year, month, day] = dashedMatch;
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }

    return null;
};

async function runInference() {
    console.log("🕵️‍♀️ Starting FILENAME INFERENCE PROTOCOL...");
    
    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef.get();

    if (snapshot.empty) {
        console.log("No media found.");
        return;
    }

    console.log(`Scanning ${snapshot.size} artifacts for date patterns...`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    let batch = db.batch();
    let batchOpCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const name = data.originalName || data.fileName || doc.id;
        
        // Skip if we already fixed it via EXIF (Highest Trust)
        if (data.exifFixed) {
            skippedCount++;
            continue;
        }

        const inferredDate = parseFilenameDate(name);
        
        if (inferredDate) {
            const currentLogical = new Date(data.logicalDate || data.uploadDate || Date.now());
            const diffTime = Math.abs(currentLogical - inferredDate);
            const diffHours = diffTime / (1000 * 60 * 60);

            // Only update if the date is significantly different (> 24 hours)
            // This prevents us from overwriting manual edits with less precise filename dates
            if (diffHours > 24) {
                console.log(`💡 MATCH: ${name}`);
                console.log(`      Current: ${currentLogical.toISOString()}`);
                console.log(`      Inferred: ${inferredDate.toISOString()}`);

                batch.update(doc.ref, {
                    logicalDate: inferredDate.toISOString(),
                    year: inferredDate.getFullYear(),
                    metadataUpdated: admin.firestore.FieldValue.serverTimestamp(),
                    inferenceSource: 'filename_regex'
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
                skippedCount++;
            }
        } else {
            skippedCount++;
        }
    }

    if (batchOpCount > 0) await batch.commit();

    console.log("---------------------------------------------------");
    console.log(`🎉 INFERENCE COMPLETE.`);
    console.log(`   Rescued via Filename: ${fixedCount}`);
    console.log(`   Skipped (No Match/Already Good): ${skippedCount}`);
    console.log("👉 The remaining stubborn files might need manual dating.");
}

runInference();