/**
 * BARN DOOR PROTOCOL V3: The "Ghostbuster"
 * * DIAGNOSIS: Fixes "Terminal Ghosting" where log filenames have suffix artifacts 
 * (e.g., "image.jpgage.jpg") caused by uncleared progress bars.
 * * LOGIC: Uses a "StartsWith" strategy to match clean DB names against dirty Log names.
 * * Usage: node dev-tools/revert-1899-dates.cjs
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const serviceAccountPath = './serviceAccountKey.json'; 
const TARGET_UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23'; 
const LOG_FILE_PATH = path.join(__dirname, 'undo_log.txt');
// ---------------------

if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ ERROR: serviceAccountKey.json not found.");
    process.exit(1);
}

if (!fs.existsSync(LOG_FILE_PATH)) {
    console.error("❌ ERROR: undo_log.txt not found.");
    process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});

const db = admin.firestore();

// Regex to parse the log format
const ENTRY_REGEX = /🔧 FIXING \[\d+\/\d+\]: (.*?)\s+Was: (.*?)\s+Now: (.*?)(?=\n|🔧|$)/gs;

const normalize = (str) => String(str).trim().toLowerCase();

async function runReversal() {
    console.log("🚨 INITIATING BARN DOOR PROTOCOL V3 (Ghostbuster)...");
    
    const logContent = fs.readFileSync(LOG_FILE_PATH, 'utf8');
    const restoreMap = new Map(); 

    let match;
    let count = 0;
    
    // 1. Build the Map (Including the "Dirty" Keys)
    while ((match = ENTRY_REGEX.exec(logContent)) !== null) {
        const dirtyFilename = match[1].trim(); // Likely has artifacts like ".jpgjpg"
        const originalDate = match[2].trim();
        const badDate = match[3].trim();

        if (badDate.startsWith('1899') || badDate.startsWith('1900')) {
            restoreMap.set(normalize(dirtyFilename), originalDate);
            count++;
        }
    }

    console.log(`   📝 Parsed ${count} keys from log file.`);
    
    // 2. Fetch Broken Records
    console.log("   🔍 Scanning Firestore for '1899' anomalies...");
    const mediaRef = db.collection('users').doc(TARGET_UID).collection('media');
    const snapshot = await mediaRef
        .where('logicalDate', '>=', '1899-01-01')
        .where('logicalDate', '<', '1901-01-01')
        .get();

    if (snapshot.empty) {
        console.log("   ✅ No 1899 records found. System clean.");
        return;
    }

    console.log(`   ⚠️ Found ${snapshot.size} items stuck in time.`);

    let restoredCount = 0;
    let fallbackCount = 0;
    let batch = db.batch();
    let batchOpCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const name = data.originalName || data.fileName || doc.id;
        const cleanName = normalize(name);
        
        let targetDate = null;
        let method = '';

        // STRATEGY A: Direct Match
        if (restoreMap.has(cleanName)) {
            targetDate = new Date(restoreMap.get(cleanName));
            method = 'LOG_DIRECT';
        } 
        // STRATEGY B: Ghostbuster Match (Does the Dirty Key start with the Clean Name?)
        else {
            // Iterate keys to find the artifact version
            // Example: Map has "image.jpgage.jpg", DB has "image.jpg"
            for (const [dirtyKey, date] of restoreMap.entries()) {
                if (dirtyKey.startsWith(cleanName)) {
                    console.log(`      👻 Ghost Match: "${cleanName}" matched log entry "${dirtyKey}"`);
                    targetDate = new Date(date);
                    method = 'LOG_FUZZY';
                    break;
                }
            }
        }

        // STRATEGY C: Fallback to Upload Date
        if (!targetDate) {
            targetDate = data.uploadDate ? new Date(data.uploadDate) : 
                         data.dateAdded ? new Date(data.dateAdded) : new Date();
            method = 'FALLBACK_UPLOAD';
            console.log(`      🔸 Orphan: "${name}" -> Resetting to Upload Date`);
        }

        if (targetDate) {
            batch.update(doc.ref, {
                logicalDate: targetDate.toISOString(),
                year: targetDate.getFullYear(),
                revertMethod: method,
                metadataUpdated: admin.firestore.FieldValue.serverTimestamp()
            });

            if (method.startsWith('LOG')) restoredCount++;
            else fallbackCount++;
            
            batchOpCount++;

            if (batchOpCount >= 400) {
                process.stdout.write('💾 Committing batch...');
                await batch.commit();
                batch = db.batch();
                batchOpCount = 0;
                console.log(' Done.');
            }
        }
    }

    if (batchOpCount > 0) await batch.commit();

    console.log("---------------------------------------------------");
    console.log(`🎉 PROTOCOL COMPLETE.`);
    console.log(`   Restored from Log: ${restoredCount}`);
    console.log(`   Reset to Upload Date: ${fallbackCount}`);
}

runReversal();