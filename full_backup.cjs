/**
 * FULL FIRESTORE BACKUP UTILITY
 * Usage: node full_backup.js
 * 
 * Recursively backs up all root collections and their subcollections.
 * Output: _backups/firestore_full_{timestamp}.json
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

const BACKUP_DIR = '_backups';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_FILE = path.join(BACKUP_DIR, `firestore_full_${TIMESTAMP}.json`);

// Ensure directory
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

async function backup() {
    console.log(`🚀 Starting Full Firestore Backup...`);
    const data = {};

    try {
        const rootCollections = await db.listCollections();

        for (const collectionRef of rootCollections) {
            console.log(`📦 collection: ${collectionRef.id}`);
            data[collectionRef.id] = await backupCollection(collectionRef);
        }

        console.log(`💾 Writing to ${BACKUP_FILE}...`);
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2));

        const size = (fs.statSync(BACKUP_FILE).size / 1024 / 1024).toFixed(2);
        console.log(`✅ Backup Complete! Size: ${size} MB`);

    } catch (error) {
        console.error('❌ Backup Failed:', error);
    }
}

async function backupCollection(collectionRef) {
    const docs = [];
    const snapshot = await collectionRef.get();

    for (const doc of snapshot.docs) {
        const docData = {
            _id: doc.id,
            _data: doc.data(),
            _subcollections: {}
        };

        const subcollections = await doc.ref.listCollections();
        for (const subColRef of subcollections) {
            // console.log(`   └── sub: ${subColRef.id} (in ${doc.id})`);
            docData._subcollections[subColRef.id] = await backupCollection(subColRef);
        }

        docs.push(docData);
    }
    return docs;
}

backup();
