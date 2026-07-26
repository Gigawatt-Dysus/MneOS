/**
 * REPAIR EXIF DATES V2: The "Deep Time" Corrector
 * * SCOPE: Scans ALL media in the Matrix (Legacy + New).
 * * ACTION: Downloads image, reads EXIF, corrects Firestore Date.
 * * VISUALS: detailed progress bar.
 * * Usage: node dev-tools/repair-exif-dates.cjs
 */

const admin = require('firebase-admin');
const fs = require('fs');
const exifr = require('exifr'); // npm install exifr

// --- CONFIGURATION ---
const serviceAccountPath = './serviceAccountKey.json'; 
const TARGET_UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23'; // Your User ID
// ---------------------

if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ ERROR: serviceAccountKey.json not found in dev-tools folder.");
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});

const db = admin.firestore();

// Helper: Fetch image buffer
const fetchImageBuffer = async (url) => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        return Buffer.from(await response.arrayBuffer());
    } catch (e) {
        return null;
    }
};

async function runTimeCorrection() {
    console.log("🕰️  Initializing DEEP TIME SCAN...");
    console.log(`Target: ${TARGET_UID}`);
    
    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef.get();

    if (snapshot.empty) {
        console.log("No media found.");
        return;
    }

    const total = snapshot.size;
    console.log(`📂 Matrix Index Loaded: ${total} artifacts found.`);
    console.log("---------------------------------------------------");

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const [index, doc] of snapshot.docs.entries()) {
        const data = doc.data();
        const docId = doc.id;
        const currentNum = index + 1;
        const percent = ((currentNum / total) * 100).toFixed(1);
        const displayName = data.originalName || data.fileName || docId;

        // Visual Progress Bar (Overwrites current line)
        process.stdout.write(`\r🔍 [${currentNum}/${total}] (${percent}%) Scanning: ${displayName.substring(0, 30).padEnd(30)}`);

        if (!data.url) {
            skippedCount++;
            continue;
        }

        try {
            // 1. Download buffer
            const buffer = await fetchImageBuffer(data.url);
            
            if (!buffer) {
                errorCount++;
                continue;
            }

            // 2. Parse EXIF
            // We look for DateTimeOriginal (creation) or CreateDate
            const exif = await exifr.parse(buffer, { pick: ['DateTimeOriginal', 'CreateDate', 'GPSLatitude', 'GPSLongitude'] });

            if (exif && (exif.DateTimeOriginal || exif.CreateDate)) {
                const trueDate = exif.DateTimeOriginal || exif.CreateDate;
                
                // Compare dates (ignore small differences)
                // If the DB date is "Today" (or import time), it will be WAY off from the EXIF date (years off).
                // We fix anything with > 24 hours difference.
                const currentLogical = new Date(data.logicalDate || data.uploadDate || Date.now());
                const diffTime = Math.abs(currentLogical - trueDate);
                const diffHours = diffTime / (1000 * 60 * 60); 

                if (diffHours > 24) {
                    // Clear line for log
                    process.stdout.write(`\r`); 
                    console.log(`🔧 FIXING [${currentNum}/${total}]: ${displayName}`);
                    console.log(`      Was: ${currentLogical.toISOString()}`);
                    console.log(`      Now: ${trueDate.toISOString()} (Restored from EXIF)`);

                    const updates = {
                        logicalDate: trueDate.toISOString(),
                        year: trueDate.getFullYear(),
                        // metadataUpdated: admin.firestore.FieldValue.serverTimestamp(), // Optional
                        exifFixed: true
                    };

                    // Recover GPS if missing
                    if (exif.GPSLatitude && !data.gps) {
                        updates.gps = { lat: exif.GPSLatitude, lng: exif.GPSLongitude };
                        console.log("      + GPS Coordinates Recovered");
                    }

                    await doc.ref.update(updates);
                    fixedCount++;
                } else {
                    skippedCount++; 
                }
            } else {
                skippedCount++; // No EXIF date found
            }

        } catch (err) {
            errorCount++;
        }
    }

    console.log(`\n\n---------------------------------------------------`);
    console.log(`🏁 DEEP TIME SCAN COMPLETE.`);
    console.log(`   Timelines Repaired: ${fixedCount}`);
    console.log(`   Already Correct / No Data: ${skippedCount}`);
    console.log(`   Errors (Download/Access): ${errorCount}`);
    console.log("👉 The Matrix has been re-sorted.");
}

runTimeCorrection();