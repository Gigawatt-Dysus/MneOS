/**
 * RETRO-FITTER: The Storage Crawler
 * * usage: node retro-fitter.js
 */

const admin = require('firebase-admin');
const { imageSize: sizeOf } = require('image-size'); // Lightweight library to get dimensions
const serviceAccount = require('./serviceAccountKey.json'); // DOWNLOAD THIS FROM FIREBASE CONSOLE

// 1. Initialize the "God Mode" Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'gigi-time-machine.firebasestorage.app' // Your specific bucket
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function indexTheMatrix() {
  console.log("🚀 Starting Retro-Fitter Sequence...");
  
  try {
    // 2. Get all files from the bucket
    const [files] = await bucket.getFiles();
    console.log(`📂 Found ${files.length} files in Storage. Processing...`);

    let processedCount = 0;
    let errorCount = 0;

    for (const file of files) {
        // Filter: Only process images
        if (!file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            continue; 
        }

        // 3. Extract Metadata from File Path
        // Expected Structure: "1999/my_photo.jpg" or "2024/Events/pic.jpg"
        const pathParts = file.name.split('/');
        
        // Heuristic: Assuming the top-level folder is the Year
        const yearFolder = pathParts[0]; 
        
        // simple check if folder is a year (4 digits)
        const isYear = /^\d{4}$/.test(yearFolder);
        const derivedYear = isYear ? parseInt(yearFolder) : new Date().getFullYear();

        console.log(`\n🔍 Analyzing: ${file.name} (Year: ${derivedYear})`);

        try {
            // 4. Download file to memory to read dimensions
            // (We download to a buffer, not to disk, to keep it fast)
            const [buffer] = await file.download();
            const dimensions = sizeOf(buffer); // Extracts { width, height }

            if (!dimensions || !dimensions.width || !dimensions.height) {
                console.warn(`   ⚠️ Could not extract dimensions for ${file.name}`);
                continue;
            }

            // 5. Construct the Firestore "Index Card"
            // This matches the shape our Matrix 2.0 expects
            const docRef = db.collection('users').doc('YOUR_USER_ID_HERE').collection('media').doc(); // Generate new ID
            
            // Construct public URL (or signed URL if private)
            // For public buckets, standard format:
            const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;

            const mediaDoc = {
                originalName: pathParts.pop(), // filename
                storagePath: file.name,        // Full path in bucket
                url: publicUrl,
                width: dimensions.width,
                height: dimensions.height,
                aspectRatio: dimensions.width / dimensions.height,
                year: derivedYear,             // THE SORTING KEY
                dateAdded: admin.firestore.FieldValue.serverTimestamp(),
                mimeType: 'image/' + dimensions.type,
                source: 'retro-fitter-v1'      // Tagging how it got here
            };

            // 6. Write to Firestore
            // HARDCODING USER ID FOR DEV - Replace 'YOUR_USER_ID_HERE' with your actual UID string
            // You can find your UID in the Firebase Authentication tab.
            await db.collection('users').doc('9MPVGVTxE8dXvkCrl1XrWHQzCl23').collection('media').add(mediaDoc);

            console.log(`   ✅ Indexed: ${dimensions.width}x${dimensions.height} | Year: ${derivedYear}`);
            processedCount++;

        } catch (err) {
            console.error(`   ❌ Error processing file: ${err.message}`);
            errorCount++;
        }
    }

    console.log(`\n🏁 MISSION COMPLETE.`);
    console.log(`   Indexed: ${processedCount}`);
    console.log(`   Errors:  ${errorCount}`);

  } catch (error) {
    console.error("Critical System Failure:", error);
  }
}

indexTheMatrix();