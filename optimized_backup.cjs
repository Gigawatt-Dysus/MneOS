const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

const BACKUP_DIR = '_backups';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_FILE = path.join(BACKUP_DIR, `firestore_optimized_${TIMESTAMP}.json`);

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

const USER_SUBCOLLECTIONS = [
    'events',
    'tags',
    'media',
    'chat_segments',
    'gigiJournal',
    'communication_archives',
    'transmissions',
    'verts',
    'pending_accessions',
    'notifications',
    'airlock',
    'leads',
    'settings'
];

async function runOptimizedBackup() {
    console.log("🚀 Starting Optimized Firestore Backup...");
    const data = {};

    try {
        const rootCollections = await db.listCollections();

        for (const colRef of rootCollections) {
            const colId = colRef.id;
            console.log(`📥 Backing up root collection: ${colId}...`);
            
            const docs = [];
            const snapshot = await colRef.get();
            console.log(`   Fetched ${snapshot.size} documents in ${colId}.`);

            for (const doc of snapshot.docs) {
                const docData = {
                    _id: doc.id,
                    _data: doc.data(),
                    _subcollections: {}
                };

                // If this is the users collection, pull all user subcollections directly
                if (colId === 'users') {
                    for (const subId of USER_SUBCOLLECTIONS) {
                        const subColRef = doc.ref.collection(subId);
                        const subSnapshot = await subColRef.get();
                        if (!subSnapshot.empty) {
                            console.log(`   ├── [User: ${doc.id}] Pulling subcollection: ${subId} (${subSnapshot.size} docs)...`);
                            const subDocs = subSnapshot.docs.map(subDoc => ({
                                _id: subDoc.id,
                                _data: subDoc.data()
                            }));
                            docData._subcollections[subId] = subDocs;
                        }
                    }
                }
                docs.push(docData);
            }
            data[colId] = docs;
        }

        console.log(`💾 Writing optimized backup to ${BACKUP_FILE}...`);
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2));

        const size = (fs.statSync(BACKUP_FILE).size / 1024 / 1024).toFixed(2);
        console.log(`✅ Optimized Backup Complete! Size: ${size} MB`);
        process.exit(0);

    } catch (error) {
        console.error('❌ Optimized Backup Failed:', error);
        process.exit(1);
    }
}

runOptimizedBackup();
