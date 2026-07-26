/**
 * BACKUP UTILITY
 * Usage: node backup.js
 */
const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ---------------- CONFIGURATION ----------------
const USER_UID = '9MPVGVTxE8dXvkCrl1XrWHQzCl23'; // <--- PASTE YOUR UID HERE
const COLLECTION_PATH = `users/${USER_UID}/media`;
const BACKUP_FILE_NAME = `backup_media_${Date.now()}.json`;
// -----------------------------------------------

async function backupCollection() {
  console.log(`🛡️  Starting backup for: ${COLLECTION_PATH}`);

  try {
    const snapshot = await db.collection('users').doc(USER_UID).collection('media').get();

    if (snapshot.empty) {
      console.log('⚠️  Collection is empty. Nothing to backup.');
      return;
    }

    const data = [];
    snapshot.forEach(doc => {
      // We save the ID so we can restore it exactly if needed
      data.push({
        _id: doc.id,
        ...doc.data()
      });
    });

    // Convert to JSON and write to disk
    fs.writeFileSync(BACKUP_FILE_NAME, JSON.stringify(data, null, 2));

    console.log(`\n✅ BACKUP COMPLETE.`);
    console.log(`   Saved ${data.length} records to: ${BACKUP_FILE_NAME}`);
    console.log(`   Size: ${(fs.statSync(BACKUP_FILE_NAME).size / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error("❌ Backup Failed:", error);
  }
}

backupCollection();