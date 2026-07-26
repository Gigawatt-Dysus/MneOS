const admin = require('firebase-admin');
const fs = require('fs');
const args = process.argv.slice(2);
const projectId = args.find(arg => arg.startsWith('--projectId='))?.split('=')[1];

if (!projectId) {
  console.error('Usage: node firestore-schema-infer.js --projectId=gigi-time-machine');
  process.exit(1);
}

const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${projectId}.firebaseio.com`,
});

const db = admin.firestore();
const SAMPLE_LIMIT = 50; // Adjust to sample more/fewer docs per collection
const USER_UID = 'your-user-uid-here'; // Replace with a test user ID for subcollections

async function inferSchema(collectionRef) {
  const schema = {};
  const querySnapshot = await collectionRef.limit(SAMPLE_LIMIT).get();
  
  querySnapshot.forEach(doc => {
    const data = doc.data();
    Object.entries(data).forEach(([field, value]) => {
      if (!schema[field]) {
        schema[field] = new Set();
      }
      const type = Array.isArray(value) ? 'array' :
                   value instanceof admin.firestore.Timestamp ? 'timestamp' :
                   value && typeof value === 'object' ? 'map' : typeof value;
      schema[field].add(type);
    });
  });
  
  // Convert sets to arrays for output
  return Object.fromEntries(
    Object.entries(schema).map(([field, types]) => [field, Array.from(types)])
  );
}

async function listSchemas() {
  const schemas = {};
  
  // Get top-level collections
  const collections = await db.listCollections();
  for (const collection of collections) {
    const collId = collection.id;
    schemas[collId] = await inferSchema(collection);
    
    // For user-specific subcollections (e.g., under /users/{uid})
    if (collId === 'users' && USER_UID) {
      const userDoc = db.collection('users').doc(USER_UID);
      const subCollections = await userDoc.listCollections();
      for (const subColl of subCollections) {
        const subId = `${collId}/${USER_UID}/${subColl.id}`;
        schemas[subId] = await inferSchema(subColl);
      }
    }
  }
  
  // Output to console and file
  console.log(JSON.stringify(schemas, null, 2));
  fs.writeFileSync('firestore-schemas.json', JSON.stringify(schemas, null, 2));
  console.log('Schemas saved to firestore-schemas.json');
}

listSchemas()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });