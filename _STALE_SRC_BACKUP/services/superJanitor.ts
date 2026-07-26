import { collection, getDocs, writeBatch, getFirestore } from 'firebase/firestore';
import { Client as TypesenseClient } from 'typesense';
import { SecretsManager } from '../utils/SecretsManager';

interface JanitorStats {
    scanned: number;
    duplicates: number;
    deletedFirestore: number;
    deletedTypesense: number;
    errors: string[];
}

// [ZEN HELPER] Dynamic Client Generation
const getTypesenseClient = (): TypesenseClient | null => {
    const host = SecretsManager.get('typesense_host');
    const key = SecretsManager.get('typesense_key');
    
    if (!host || !key) return null;

    return new TypesenseClient({
        nodes: [{ host, port: 443, protocol: 'https' }],
        apiKey: key,
        connectionTimeoutSeconds: 5
    });
};

/**
 * SUPER JANITOR
 * Scans a specific user's chat collection for duplicates based on content & timestamp.
 * Performs idempotent cleanup on both Firestore and Typesense.
 */
export const runSuperJanitor = async (
    userId: string, 
    collectionName: string = "chat_segments", 
    commitChanges: boolean = true 
): Promise<JanitorStats> => {
    
    const db = getFirestore();
    // Target the specific collection where duplicates are hiding
    const targetPath = `users/${userId}/${collectionName}`;
    
    console.log(`[SUPER JANITOR] 🧹 ACTIVATED. Target: ${targetPath}`);
    if (!commitChanges) console.log(`[SUPER JANITOR] 🛡️ DRY RUN MODE: No data will be deleted.`);

    const stats: JanitorStats = { scanned: 0, duplicates: 0, deletedFirestore: 0, deletedTypesense: 0, errors: [] };
    
    try {
        const collectionRef = collection(db, 'users', userId, collectionName); 
        const snapshot = await getDocs(collectionRef);
        
        if (snapshot.empty) {
            console.log(`[SUPER JANITOR] ✅ No documents found in ${targetPath}.`);
            return stats;
        }

        stats.scanned = snapshot.size;
        console.log(`[SUPER JANITOR] Scanning ${stats.scanned} documents...`);

        const uniqueSignatures = new Set<string>();
        const batch = writeBatch(db);
        const idsToDelete: string[] = [];

        // 1. Sort by timestamp (Keep the OLDEST, delete the NEWER duplicates)
        // We want to preserve the original record that likely has correct metadata
        const sortedDocs = snapshot.docs.sort((a, b) => {
            const dataA = a.data();
            const dataB = b.data();
            const tsA = (dataA.timestamp || dataA.createdAt)?.toMillis?.() || 0;
            const tsB = (dataB.timestamp || dataB.createdAt)?.toMillis?.() || 0;
            return tsA - tsB; 
        });

        // 2. Identify Clones
        sortedDocs.forEach((docSnap) => {
            const data = docSnap.data();
            
            // Robust Timestamp Normalization
            let ts = 0;
            const rawTs = data.timestamp || data.createdAt;
            if (rawTs && typeof rawTs.toMillis === 'function') ts = rawTs.toMillis();
            else if (rawTs instanceof Date) ts = rawTs.getTime();
            else ts = new Date(rawTs || 0).getTime();

            // DNA Signature: Role + Exact Time + Content Snippet
            // This signature is what defines "Identity" for a message
            const contentSnippet = (data.content || "").substring(0, 50).trim();
            const signature = `${data.role}_${ts}_${contentSnippet}`;

            if (uniqueSignatures.has(signature)) {
                // DUPLICATE FOUND
                if (commitChanges) {
                    batch.delete(docSnap.ref);
                    idsToDelete.push(docSnap.id);
                }
                stats.duplicates++;
            } else {
                // ORIGINAL - Keep it
                uniqueSignatures.add(signature);
            }
        });

        // 3. EXECUTE: Firestore Cleanup
        if (stats.duplicates > 0 && commitChanges) {
            await batch.commit();
            stats.deletedFirestore = stats.duplicates;
            console.log(`[SUPER JANITOR] 🔥 Incinerated ${stats.deletedFirestore} duplicates from Firestore.`);
        } else if (stats.duplicates > 0) {
            console.log(`[SUPER JANITOR] 🛡️ Found ${stats.duplicates} duplicates (Dry Run).`);
        }

        // 4. EXECUTE: Typesense Cleanup
        if (idsToDelete.length > 0 && commitChanges) {
            const client = getTypesenseClient();
            if (!client) {
                // Not an error per se, maybe they just haven't set it up
                console.warn("[SUPER JANITOR] Typesense keys missing. Skipping vector cleanup.");
            } else {
                console.log(`[SUPER JANITOR] 🧠 Syncing deletions to Typesense...`);
                
                const chunkSize = 100;
                for (let i = 0; i < idsToDelete.length; i += chunkSize) {
                    const chunk = idsToDelete.slice(i, i + chunkSize);
                    const filterStr = `id: [${chunk.join(', ')}]`; 
                    
                    // [ZEN FIX] Try deleting from 'chat_memory' AND 'messages' (legacy)
                    // Robustly handle 404s if collection doesn't exist
                    const collectionsToCheck = ['chat_memory', 'messages'];
                    
                    for (const col of collectionsToCheck) {
                        try {
                            await client.collections(col).documents().delete({
                                filter_by: filterStr
                            });
                            stats.deletedTypesense += chunk.length;
                            console.log(`[SUPER JANITOR] Cleaned IDs from collection: ${col}`);
                        } catch (e: any) {
                            // Ignore 404 (Collection not found) - that's a "success" for cleanup
                            if (e.httpStatus === 404 || (e.message && e.message.includes('Not Found'))) {
                                // console.log(`[SUPER JANITOR] Collection '${col}' not found (clean).`);
                            } else {
                                console.error(`[SUPER JANITOR] Typesense Error (${col}):`, e);
                                stats.errors.push(`Typesense ${col}: ${e.message}`);
                            }
                        }
                    }
                }
                if (stats.deletedTypesense > 0) {
                    console.log(`[SUPER JANITOR] ✅ Removed ${stats.deletedTypesense} ghosts from Typesense.`);
                }
            }
        }

    } catch (error: any) {
        console.error("[SUPER JANITOR] Fatal Error:", error);
        stats.errors.push(error.message);
    }

    return stats;
};