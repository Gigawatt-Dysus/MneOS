import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { Client } from "typesense";

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// [ZEN SYNC] The Missing Link: Firestore -> Typesense
export const syncToTypesense = onDocumentWritten({
    document: "users/{uid}/chat_segments/{docId}",
    memory: "1GiB",
    timeoutSeconds: 300
}, async (event) => {
    const snap = event.data?.after;
    if (!snap) {
        // DELETE EVENT
        // We might want to delete from Typesense too, but for safety (archive) we'll skip for now.
        // Or strictly: if (!event.data.after && event.data.before) { delete... }
        return;
    }

    const data = snap.data();
    if (!data) return;

    // 1. [GATEKEEPER] Only Sync Enriched Data
    // We do NOT want to sync naked validation errors.
    const isReady = data.search_metadata &&
        Array.isArray(data.search_metadata.keywords) &&
        data.search_metadata.keywords.length > 0;

    if (!isReady) {
        console.log(`[Sync] Skipping ${event.params.docId}: Not enriched yet.`);
        return;
    }

    const uid = event.params.uid;

    // 2. Fetch Config (Securely)
    // We need the admin keys. We'll try to get them from the user config same as RAG.
    // NOTE: In a perfect world we use ENV vars, but here we reuse the user's secure config 
    // to keep the architecture consistent with the "User Owns Keys" philosophy.
    const configRef = await db.collection('users').doc(uid).collection('zen_config').doc('main').get();
    const config = configRef.data();

    if (!config || !config.typesenseHost || !config.typesenseKey) {
        console.error(`[Sync] Aborted ${uid}: Missing Typesense Config.`);
        return;
    }

    // 3. Init Typesense
    const client = new Client({
        nodes: [{ host: config.typesenseHost, port: 443, protocol: 'https' }],
        apiKey: config.typesenseKey,
        connectionTimeoutSeconds: 5
    });

    const docId = event.params.docId;

    // 4. Transform for Typesense (Flatten)
    // Typesense prefers flat schemas or simple arrays.
    const searchRecord = {
        id: docId,
        user_id: uid, // Critical for multi-tenant filtering
        role: data.role || 'unknown',
        content: data.content || '',
        timestamp: data.timestamp ? (data.timestamp.toMillis ? data.timestamp.toMillis() : Date.now()) : Date.now(),
        // Metadata
        title: data.search_metadata.title,
        summary: data.search_metadata.summary,
        keywords: data.search_metadata.keywords, // string[]
        sentiment: data.search_metadata.sentiment,
        is_fiction: data.search_metadata.is_fiction || false,
        source: data.source || 'unknown'
    };

    try {
        // 5. Upsert (Create or Replace)
        await client.collections('chat_memory_v2_robust').documents().upsert(searchRecord);
        console.log(`[Sync] 🚀 Indexed ${docId} to Typesense!`);

        // 6. [SOVEREIGN BAFFLE] Accumulate Narrative Pressure
        // Every indexed message builds "Narrative Pressure" towards a Reflection Point.
        const userRef = db.collection('users').doc(uid);
        await db.runTransaction(async (transaction) => {
            const uDoc = await transaction.get(userRef);
            if (!uDoc.exists) return;

            const memex = uDoc.data()?.sovereignMemex || { 
                narrativePressure: 0, 
                tippingPoint: 50, 
                reflectionCount: 0,
                lastReflectionAt: null 
            };

            // Increment pressure
            memex.narrativePressure += 1.0;

            // NASA BAFFLE: If turbulence is detected (e.g. many rapid messages), 
            // we slow the accumulation to let the "fuel slosh" settle.
            const now = Date.now();
            const lastUpdate = memex.lastUpdateAt?.toMillis() || 0;
            if (now - lastUpdate < 5000) { // < 5 seconds since last sync
                memex.narrativePressure -= 0.5; // Dampen the signal
            }
            memex.lastUpdateAt = admin.firestore.FieldValue.serverTimestamp();

            // Check for Tipping Point
            if (memex.narrativePressure >= memex.tippingPoint) {
                console.log(`[Baffle] 🌊 Tipping Point Reached (${memex.narrativePressure}/${memex.tippingPoint}). Triggering Reflection...`);
                // Queue the reflection (we'll use a hidden segment to trigger her background logic)
                memex.reflectionQueued = true;
                memex.narrativePressure = 0; // Reset
                // THE SLUICE: Increment the next tipping point slightly to prevent frequency instability
                memex.tippingPoint = Math.min(100, memex.tippingPoint + 5); 
            }

            transaction.update(userRef, { sovereignMemex: memex });
        });
    } catch (error: any) {
        console.error(`[Sync] Failed to Index ${docId}:`, error);
    }
});
