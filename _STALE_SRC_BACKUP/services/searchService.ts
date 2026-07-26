import { Client } from 'typesense';
import type { ChatMessage } from '@/types';
import { getEmbedding } from './ai/providers';
import { SecretsManager } from '../utils/SecretsManager';
// [ZEN FIX] Added Firestore imports for re-indexing logic
import { collection, getDocs, getFirestore } from 'firebase/firestore';

// [ZEN FIX] Dynamic Configuration
const getTypesenseConfig = () => {
    const host = SecretsManager.get('typesense_host');
    const key = SecretsManager.get('typesense_key');

    if (!host || !key || host.includes('paste')) return null;

    return {
        apiKey: key,
        nodes: [{
            host: host,
            port: 443,
            protocol: 'https'
        }],
        connectionTimeoutSeconds: 5,
        numRetries: 3,
        retryIntervalSeconds: 1
    };
};

let clientInstance: Client | null = null;

const getClient = (): Client | null => {
    if (!clientInstance) {
        const config = getTypesenseConfig();
        if (config) {
            clientInstance = new Client(config);
        }
    }
    return clientInstance;
};

const MEMORY_COLLECTION = 'chat_memory';

export const initMemoryStore = async () => {
    const client = getClient();
    if (!client) {
        console.warn("[MemoryStore] Typesense not configured in Settings.");
        return;
    }

    try {
        await client.collections(MEMORY_COLLECTION).retrieve();
        console.log(`[MemoryStore] Collection '${MEMORY_COLLECTION}' found.`);
    } catch (e: any) {
        if (e.status === 404) {
            console.log(`[MemoryStore] Creating '${MEMORY_COLLECTION}'...`);
            await client.collections().create({
                name: MEMORY_COLLECTION,
                fields: [
                    { name: 'id', type: 'string' },
                    { name: 'content', type: 'string' },
                    { name: 'role', type: 'string', facet: true },
                    { name: 'timestamp', type: 'int64' },
                    { name: 'embedding', type: 'float[]', num_dim: 768 }
                ],
                default_sorting_field: 'timestamp'
            });
        }
    }
};

export const indexMessage = async (msg: ChatMessage, msgId: string) => {
    const client = getClient();
    if (!client || !msg.content || msg.role === 'system') return;

    try {
        const vector = await getEmbedding(msg.content);
        if (!vector) return;

        await client.collections(MEMORY_COLLECTION).documents().upsert({
            id: msgId,
            content: msg.content,
            role: msg.role,
            timestamp: new Date(msg.timestamp).getTime(),
            embedding: vector
        });
        console.log(`[MemoryStore] Indexed: "${msg.content.substring(0, 20)}..."`);
    } catch (e) {
        console.error(`[MemoryStore] Index Failed for ${msgId}:`, e);
    }
};

export const searchChatMemory = async (query: string): Promise<string[]> => {
    const client = getClient();
    if (!client) return [];

    try {
        const queryVector = await getEmbedding(query);
        if (!queryVector) return [];

        const searchParams = {
            q: '*',
            vector_query: `embedding:([${queryVector.join(',')}], k:5)`,
            collection: MEMORY_COLLECTION,
            per_page: 5,
        };

        const result = await client.multiSearch.perform({ searches: [searchParams] });
        const firstResult = result.results[0] as any;
        const hits = firstResult?.hits || [];

        return hits.map((h: any) => {
            const date = new Date(h.document.timestamp).toLocaleDateString();
            return `[${date} - ${h.document.role}]: "${h.document.content}"`;
        });
    } catch (e) {
        return [];
    }
};

export const hydrateMemory = async (messages: ChatMessage[]) => {
    const client = getClient();
    if (!client) {
        alert("Please configure Typesense Host/Key in Settings -> Utils first!");
        return;
    }

    console.log(`[MemoryStore] Starting Hydration for ${messages.length} messages...`);
    await initMemoryStore();

    try {
        const health = await client.health.retrieve();
        if (!health.ok) throw new Error("Typesense health check failed");
        console.log("[MemoryStore] Cloud Connection: OK");
    } catch (e) {
        console.error("[MemoryStore] Connection Error:", e);
        throw new Error("Typesense Unreachable. Check Settings.");
    }

    let processed = 0;
    const chunkSize = 5;

    for (let i = 0; i < messages.length; i += chunkSize) {
        const chunk = messages.slice(i, i + chunkSize);
        try {
            await Promise.all(chunk.map(async (msg) => {
                const ts = new Date(msg.timestamp).getTime();
                const safeId = `msg_${ts}_${msg.role}`;
                await indexMessage(msg, safeId);
            }));
            processed += chunk.length;
            console.log(`[MemoryStore] Progress: ${processed}/${messages.length}`);
        } catch (e) {
            console.error("[MemoryStore] Batch failed. Stopping.", e);
            throw new Error(`Hydration aborted at ${processed} items.`);
        }
    }
    console.log("[MemoryStore] Hydration Complete.");
};

// [ZEN FIX] New Hydrator: Reads from Firestore 'chat_segments' directly
export const reindexChatSegments = async (userId: string): Promise<{ success: boolean, count: number, error?: string }> => {
    console.log("[Hydrator] Starting Re-index of Chat Segments...");
    const client = getClient();

    if (!client) {
        console.error("[Hydrator] Typesense keys missing.");
        return { success: false, count: 0, error: "Missing API Keys" };
    }

    // Lazy load firestore to avoid circular dependencies if possible, or assume initialized
    const db = getFirestore();

    try {
        // 1. Read from the NEW collection
        const segmentsRef = collection(db, 'users', userId, 'chat_segments');
        const snapshot = await getDocs(segmentsRef);

        if (snapshot.empty) {
            console.log("[Hydrator] No messages found to index.");
            return { success: true, count: 0 };
        }

        const documents = snapshot.docs.map(doc => {
            const data = doc.data();

            // Resolve timestamp
            let ts = 0;
            if (data.timestamp?.toMillis) ts = data.timestamp.toMillis();
            else if (data.timestamp instanceof Date) ts = data.timestamp.getTime();
            else ts = new Date(data.timestamp || 0).getTime();

            // 2. Convert to Typesense Schema
            // [CRITICAL] Use the Firestore ID as the Typesense ID to prevent index dupes
            return {
                id: doc.id,
                role: data.role || 'unknown',
                content: data.content || '',
                timestamp: ts
            };
        });

        // 3. Import to Typesense (Upsert = Update if exists, Insert if new)
        console.log(`[Hydrator] Upserting ${documents.length} records to Typesense...`);

        // Chunk import to avoid payload limits
        const chunkSize = 50;
        for (let i = 0; i < documents.length; i += chunkSize) {
            const chunk = documents.slice(i, i + chunkSize);
            await client.collections(MEMORY_COLLECTION).documents().import(chunk, {
                action: 'upsert'
            });
        }

        console.log("[Hydrator] ✅ Indexing Complete.");
        return { success: true, count: documents.length };

    } catch (e: any) {
        console.error("[Hydrator] Indexing Failed:", e);
        return { success: false, count: 0, error: e.message };
    }
};

export const clearUserChatMemory = async (ids: string[]) => {
    const client = getClient();
    if (!client || ids.length === 0) return;

    console.log(`[MemoryStore] Clearing ${ids.length} records from Typesense...`);
    try {
        // Chunk deletions to avoiding payload or timeout issues
        const chunkSize = 100;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const filterStr = `id: [${chunk.join(', ')}]`;

            await client.collections(MEMORY_COLLECTION).documents().delete({
                filter_by: filterStr
            });
        }
        console.log("[MemoryStore] Typesense cleanup complete.");
    } catch (e) {
        console.error("[MemoryStore] Failed to clear user chat memory:", e);
        throw e;
    }
};