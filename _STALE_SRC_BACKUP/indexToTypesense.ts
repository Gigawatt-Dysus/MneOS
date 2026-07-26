import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Typesense from 'typesense';
import { createRequire } from "module";

// 1. SETUP
const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccountKey.json');

// Check if app is already initialized
if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

// [ZEN] Typesense Cloud Config
const client = new Typesense.Client({
    nodes: [{
        host: 'u3sc4eka1lib0qnhp-1.a1.typesense.net',
        port: 443,
        protocol: 'https'
    }],
    apiKey: 'ygfJJTAGaGfvWOoCIGxEk16CVxYr8h6D', // ADMIN KEY
    connectionTimeoutSeconds: 5
});

const SCHEMA_NAME = 'media_v1';

async function run() {
    console.log("🚀 Connecting to Typesense Cloud...");

    // 2. DEFINE SCHEMA
    const schema = {
        name: SCHEMA_NAME,
        fields: [
            { name: 'id', type: 'string' },
            { name: 'title', type: 'string', optional: true },
            { name: 'description', type: 'string', optional: true },
            { name: 'originalName', type: 'string', optional: true },
            { name: 'tags', type: 'string[]', facet: true, optional: true },
            { name: 'year', type: 'string', facet: true, optional: true }, 
            { name: 'type', type: 'string', facet: true },
            { name: 'timestamp', type: 'int64', sort: true }
        ],
        default_sorting_field: 'timestamp'
    };

    try {
        await client.collections().create(schema as any);
        console.log("✨ Schema created.");
    } catch (e: any) {
        if (e.message?.includes('already exists')) console.log("ℹ️ Collection exists, appending data...");
        else console.error("Schema Error:", e);
    }

    // 3. FETCH FIREBASE DATA
    console.log("📥 Fetching from Firestore...");
    const usersSnap = await db.collection('users').get();
    let total = 0;

    for (const userDoc of usersSnap.docs) {
        const mediaSnap = await db.collection(`users/${userDoc.id}/media`).get();
        console.log(`   User ${userDoc.id}: Found ${mediaSnap.size} items.`);
        
        const documents = mediaSnap.docs.map(doc => {
            const data = doc.data();
            
            // Normalize Timestamp
            let ts = 0;
            if (data.logicalDate) ts = new Date(data.logicalDate).getTime();
            else if (data.dateAdded?.toMillis) ts = data.dateAdded.toMillis();
            
            return {
                id: doc.id,
                title: data.title || '',
                description: data.description || '',
                originalName: data.originalName || '',
                tags: data.tagIds || [],
                year: data.year ? String(data.year) : '',
                type: data.fileType?.startsWith('video') ? 'video' : 'image',
                timestamp: ts || 0
            };
        });

        if (documents.length > 0) {
            // Batch Import
            await client.collections(SCHEMA_NAME).documents().import(documents, { action: 'upsert' });
            total += documents.length;
        }
    }

    console.log(`✅ SUCCESS: Indexed ${total} items to Cloud.`);
}

run();