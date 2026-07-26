/**
 * VERIFY FACES: The "Truth Serum"
 * * DIAGNOSIS: Prints the exact data structure of your Face IDs.
 * * USAGE: node dev-tools/verify-faces.cjs
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

async function runVerification() {
    console.log("🕵️  INSPECTING FACE BIOMETRICS...");
    
    const tagsRef = db.collection('users').doc(TARGET_UID).collection('tags');
    const snapshot = await tagsRef.where('type', '==', 'person').get();

    if (snapshot.empty) {
        console.log("❌ No Person tags found.");
        return;
    }

    let enrolledCount = 0;
    let corruptedCount = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        const meta = data.metadata || {};
        const descriptor = meta.faceDescriptor;

        if (descriptor) {
            const isArray = Array.isArray(descriptor);
            const isObject = typeof descriptor === 'object' && !isArray;
            const length = isArray ? descriptor.length : Object.keys(descriptor).length;

            console.log(`✅ [ENROLLED] ${data.name.padEnd(20)} | Type: ${isArray ? 'ARRAY' : 'OBJECT'} | Points: ${length}`);
            
            if (length < 128) {
                console.warn(`   ⚠️  WARNING: Descriptor looks too small (Valid is usually 128 points).`);
            }
            enrolledCount++;
        } else {
            console.log(`❌ [MISSING ] ${data.name.padEnd(20)} | No Face ID data found.`);
        }
    });

    console.log("---------------------------------------------------");
    console.log(`SUMMARY: ${enrolledCount} / ${snapshot.size} People Enrolled.`);
    
    if (enrolledCount > 0) {
        console.log("\n💡 DIAGNOSIS:");
        console.log("If the Type is 'OBJECT', the Scanner might be checking for .length (which Arrays have but Objects don't).");
        console.log("My latest Scanner update handles BOTH types.");
    }
}

runVerification();