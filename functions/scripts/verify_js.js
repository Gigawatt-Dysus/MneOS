const admin = require('firebase-admin');
const { Client } = require('typesense');

// Initialize Admin SDK
// Point to service account key if available, otherwise assume local emulators or default creds
// Ideally user is logged in via `firebase login`
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}
const db = admin.firestore();

async function run() {
    const uid = "9MPVGVTxE8dXvkCrl1XrWHQzCl23";
    console.log(`[Verify] Fetching keys for ${uid}...`);

    try {
        const configDoc = await db.collection('users').doc(uid).collection('zen_config').doc('main').get();
        if (!configDoc.exists) {
            console.error("Config not found!");
            return;
        }
        const config = configDoc.data();
        if (!config.typesenseKey) {
            console.error("Typesense Key missing in config!");
            return;
        }

        const client = new Client({
            nodes: [{ host: config.typesenseHost, port: 443, protocol: 'https' }],
            apiKey: config.typesenseKey,
            connectionTimeoutSeconds: 5
        });

        const collectionName = 'chat_memory_v2_robust';

        console.log(`[Verify] Connecting to ${collectionName}...`);
        const stats = await client.collections(collectionName).retrieve();
        console.log(`\n=== STATS ===`);
        console.log(`Num Docs: ${stats.num_documents}`);

        // Hunt Ghost
        const ghostId = "msg-1766514997963";
        console.log(`\n=== GHOST HUNT ===`);
        try {
            const ghost = await client.collections(collectionName).documents(ghostId).retrieve();
            console.log(`[FOUND] ${ghost.id} | Title: ${ghost.title} | Keywords: ${ghost.keywords}`);
        } catch (e) {
            console.log(`[MISSING] Ghost ${ghostId} not found (${e.httpStatus || e.message})`);
        }

        // Search Recent
        const search = await client.collections(collectionName).documents().search({
            q: '*',
            filter_by: `user_id:=${uid}`,
            sort_by: 'timestamp:desc',
            per_page: 5
        });
        console.log(`\n=== RECENT DOCUMENTS ===`);
        search.hits.forEach(h => {
            console.log(`[${new Date(h.document.timestamp).toISOString()}] ${h.document.id} (${h.document.source || 'NoSource'})`);
        });

    } catch (e) {
        console.error("CRASH:", e);
    }
}

run();
