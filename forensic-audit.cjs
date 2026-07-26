// scripts/forensic-audit.cjs
/**
 * FORENSIC AUDIT: Retroactively applies date logic to existing assets.
 * Usage: node scripts/forensic-audit.cjs
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// --- CONFIGURATION ---
const serviceAccountPath = './serviceAccountKey.json'; // Ensure this exists
const TARGET_UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23'; // Eric Cornett
// ---------------------

if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ Service Account Key missing. Cannot run audit.");
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});
const db = admin.firestore();

// --- THE DETECTIVE LOGIC (Ported to Node) ---
const inferDateFromPath = (storagePath) => {
    if (!storagePath) return null;
    const segments = storagePath.split('/');
    
    // Regex for Year (19xx or 20xx)
    const yearRegex = /^(19|20)\d{2}$/;
    
    // 1. Look for explicit Year folder (e.g. "1967")
    for (const segment of segments) {
        if (yearRegex.test(segment)) {
            // Default to Jan 1st of that year if no month found
            return `${segment}-01-01T12:00:00.000Z`;
        }
    }
    return null;
};

async function runAudit() {
    console.log("🕵️‍♀️ Starting Forensic Audit on Legacy Data...");
    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef.get();

    if (snapshot.empty) {
        console.log("No media found.");
        return;
    }

    let updatedCount = 0;
    let batch = db.batch();
    let opCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Skip if already processed (has status)
        if (data.status) continue;

        // 1. Analyze the Storage Path (The "Jewel")
        // storagePath usually looks like: users/uid/uploads/1967/Image.jpg
        const inferredDate = inferDateFromPath(data.storagePath);
        
        // 2. Determine Fate
        const updates = {
            status: 'clean', // We trust the legacy folder structure
            forensics: {
                originalFilePath: data.storagePath || 'legacy_import',
                inferredDate: inferredDate,
                exifDate: null, // We skip expensive EXIF fetch for this pass
                flaggedReason: null
            },
            // If we found a date from the folder, update the sorting date
            logicalDate: inferredDate || data.dateAdded?.toDate().toISOString() || new Date().toISOString()
        };

        // 3. Queue Update
        batch.update(doc.ref, updates);
        opCount++;
        updatedCount++;

        // Commit batches of 500
        if (opCount >= 400) {
            await batch.commit();
            batch = db.batch();
            opCount = 0;
            process.stdout.write('.');
        }
    }

    if (opCount > 0) await batch.commit();

    console.log(`\n✅ Audit Complete. Updated ${updatedCount} legacy records.`);
}

runAudit();