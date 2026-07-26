const admin = require('firebase-admin');
const { Client } = require('typesense');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function verifyIndex(uid) {
    console.log(`[Verify] Checking Typesense for user ${uid}...`);

    // 1. Fetch Config
    const configRef = await db.collection('users').doc(uid).collection('zen_config').doc('main').get();
    const config = configRef.data();

    if (!config || !config.typesenseHost || !config.typesenseKey) {
        console.error("Missing Typesense Config in Firestore");
        return;
    }

    const client = new Client({
        nodes: [{ host: config.typesenseHost, port: 443, protocol: 'https' }],
        apiKey: config.typesenseKey,
        connectionTimeoutSeconds: 5
    });

    try {
        // 2. Get Collection Stats
        const stats = await client.collections('chat_memory_v2_robust').retrieve();
        console.log(`\n=== TYPESENSE STATS ===`);
        console.log(`Total Documents: ${stats.num_documents}`);
        console.log(`Created At: ${new Date(stats.created_at * 1000).toISOString()}`);

        // 3. Search for Recent "Alexa" items
        const searchResults = await client.collections('chat_memory_v2_robust').documents().search({
            q: '*',
            filter_by: `user_id:=${uid} && source:=alexa`,
            sort_by: 'timestamp:desc',
            per_page: 10
        });

        console.log(`\n=== RECENT ALEXA RECORDS (${searchResults.found} found) ===`);
        if (searchResults.hits.length === 0) {
            console.log("No Alexa records found in Typesense!");
        } else {
            searchResults.hits.forEach(hit => {
                const doc = hit.document;
                console.log(`[${new Date(doc.timestamp).toISOString()}] ${doc.id} - ${doc.title || 'Untitled'}`);
                console.log(`   Is Fiction: ${doc.is_fiction} | Keywords: ${doc.keywords?.length || 0}`);
            });
        }

    } catch (e) {
        console.error("Verification Failed:", e);
    }
}

verifyIndex("9MPVGVTxE8dXvkCrl1XrWHQzCl23");
