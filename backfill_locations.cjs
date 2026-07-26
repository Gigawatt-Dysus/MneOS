const admin = require('firebase-admin');
const Typesense = require('typesense');

// Initializing Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'gigi-time-machine'
    });
}
const db = admin.firestore();

// Initializing Typesense
const client = new Typesense.Client({
    'nodes': [{
        'host': '3iz6unxa8t1oyrchp-1.a1.typesense.net',
        'port': 443,
        'protocol': 'https'
    }],
    'apiKey': 'fYo8ggNRQSolrTHCUqG3QPNFi1NsKcPZ',
    'connectionTimeoutSeconds': 10
});

async function backfill() {
    console.log("[Forensic Scan] Initiating crawl of LifeOS archives...");
    const snapshot = await db.collection('media').get();
    console.log(`[Forensic Scan] Found ${snapshot.size} artifacts. Parsing for spatial metadata...`);

    const locations = new Map();
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.location && data.location.address) {
            const addr = data.location.address;
            const existing = locations.get(addr);
            // Keep the most recent lastUsed date
            let currentLastUsed = Date.now();
            if (data.dateAdded && data.dateAdded.toMillis) {
                currentLastUsed = data.dateAdded.toMillis();
            } else if (data.logicalDate) {
                currentLastUsed = new Date(data.logicalDate).getTime();
            }
            
            if (!existing || currentLastUsed > existing.lastUsed) {
                locations.set(addr, {
                    id: Buffer.from(addr).toString('base64').replace(/=/g, '').replace(/\//g, '_').replace(/\+/g, '-'),
                    address: addr,
                    lat: parseFloat(data.location.lat) || 0,
                    lng: parseFloat(data.location.lng) || 0,
                    lastUsed: currentLastUsed
                });
            }
        }
    });

    console.log(`[Forensic Scan] Extraction Complete. Identified ${locations.size} unique LifeOS locations.`);

    for (const loc of locations.values()) {
        try {
            await client.collections('locations_v1').documents().upsert(loc);
            console.log(`[Memory Sync] Synchronized: ${loc.address}`);
        } catch (e) {
            if (e.httpStatus === 404) {
                console.log("[Memory Sync] Initializing 'locations_v1' index...");
                await client.collections().create({
                    name: 'locations_v1',
                    fields: [
                        { name: 'address', type: 'string' },
                        { name: 'lat', type: 'float' },
                        { name: 'lng', type: 'float' },
                        { name: 'lastUsed', type: 'int64', sort: true }
                    ]
                });
                await client.collections('locations_v1').documents().upsert(loc);
            } else {
                console.error(`[Memory Sync] Failed for ${loc.address}:`, e.message);
            }
        }
    }
    console.log("[Forensic Scan] LifeOS Geo-Intelligence is now fully synchronized.");
}

backfill().catch(console.error);
