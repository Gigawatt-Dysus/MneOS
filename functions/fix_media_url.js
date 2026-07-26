const admin = require('firebase-admin');

// Initialize with the project ID
admin.initializeApp({
  projectId: 'gigi-time-machine'
});

const db = admin.firestore();

async function fixUrls() {
  console.log("Searching for broken media URLs...");
  const snapshot = await db.collectionGroup('media').get();
  
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.url && data.url.includes('media.gigiwatt.com') && !data.url.includes('/file/LifeOS-Media/')) {
      const newUrl = data.url.replace('media.gigiwatt.com/', 'media.gigiwatt.com/file/LifeOS-Media/');
      console.log(`Fixing doc ${doc.id}: ${data.url} -> ${newUrl}`);
      await doc.ref.update({ url: newUrl });
      count++;
    }
  }
  
  console.log(`✅ Fixed ${count} URLs.`);
  process.exit(0);
}

fixUrls().catch(err => {
  console.error(err);
  process.exit(1);
});
