const admin = require('firebase-admin');
const yargs = require('yargs/yargs')(process.argv.slice(2)); // For CLI args—install with npm install yargs if you want, or hardcode.

// Parse CLI args (or hardcode for simplicity)
const argv = yargs
  .option('query', { type: 'string', demandOption: true, description: 'Search string (e.g., Ruth)' })
  .option('uid', { type: 'string', demandOption: true, description: 'Your user ID from the app' })
  .argv;

const searchQuery = argv.query.toLowerCase();
const userId = argv.uid;

// Init Firebase Admin
const serviceAccount = require('./serviceAccountKey.json'); // Your key file
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://gigi-time-machine.firebaseio.com' // Replace if your project URL differs
});

const db = admin.firestore();

// Search function: Query media collection for matches in key fields
async function searchMatrix() {
  console.log(`[Query Engine] Searching for "${searchQuery}" in user/${userId}/media...`);

  const mediaRef = db.collection(`users/${userId}/media`);
  
  // Firestore doesn't do full-text wildcards easily, so we'll fetch all (or paginate if huge) and filter client-side for simplicity.
  // For prod, use composite indexes or Algolia, but this is quick/dirty.
  try {
    const snapshot = await mediaRef.get();
    console.log(`[Query Engine] Fetched ${snapshot.size} total media items. Filtering...`);

    const matches = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const lowerName = (data.originalName || '').toLowerCase();
      const lowerCaption = (data.caption || '').toLowerCase();
      const lowerDesc = (data.description || '').toLowerCase();
      const tags = data.tags || []; // Ensure tags is always an array

      if (lowerName.includes(searchQuery) ||
          lowerCaption.includes(searchQuery) ||
          lowerDesc.includes(searchQuery) ||
          tags.some(tag => tag.toLowerCase().includes(searchQuery))) {
        matches.push({
          id: doc.id,
          originalName: data.originalName,
          caption: data.caption,
          description: data.description,
          tags: tags,
          matchField: lowerName.includes(searchQuery) ? 'originalName' :
                      lowerCaption.includes(searchQuery) ? 'caption' :
                      lowerDesc.includes(searchQuery) ? 'description' : 'tags'
        });
      }
    });

    if (matches.length === 0) {
      console.log('[Query Engine] No matches found. Try a different string or check your db.');
    } else {
      console.log(`[Query Engine] Found ${matches.length} matches:`);
      matches.forEach(m => {
        console.log(`- ID: ${m.id} | Name: ${m.originalName} | Match in: ${m.matchField}`);
        console.log(`  Caption: ${m.caption || 'N/A'}`);
        console.log(`  Desc: ${m.description || 'N/A'}`);
        console.log(`  Tags: ${m.tags.join(', ') || 'N/A'}`);
        console.log('---');
      });
    }
  } catch (err) {
    console.error('[Query Engine] Boom:', err);
  } finally {
    process.exit(0);
  }
}

searchMatrix();