import { getFirestore, doc, setDoc, serverTimestamp } from './sovereignDbAdapter';
import { EnrichmentService } from './enrichmentService';
import { indexMessage } from './searchService';
// [ZEN FIX] Import getters from config instead of a potentially missing firebase file
import { getPrimaryModelId } from './ai/config';

export const MemoryManager = {
    /**
     * This is the "Cold Path". It runs in the background.
     * It performs full AI analysis and updates both Firestore and Typesense.
     */
    async archiveMessageInBackground(userId: string, messageId: string, content: string, role: string) {
        try {
            console.log(`[MemoryManager] 🟦 Starting background archive for ${messageId}...`);

            // [ZEN V41] BUDGET AUSTERITY: Use the Reserve (Fast) tier for background archival
            const { getReserveModelId } = await import('./ai/config');
            const modelId = getReserveModelId();

            // [ZEN FIX] Pass BOTH arguments to dispatchAnalysis
            const metadata = await EnrichmentService.dispatchAnalysis(modelId, content);

            if (metadata) {
                const db = getFirestore(); // Get the instance directly

                // 1. Retrieve existing Firestore message state to preserve hot-path properties (like internal_monologue)
                const docRef = doc(db, 'users', userId, 'chat_segments', messageId);
                const { getDoc } = await import('./sovereignDbAdapter');
                const docSnap = await getDoc(docRef);
                const existingData = docSnap.exists() ? docSnap.data() : {};

                const isDiary = messageId.startsWith('diary-');
                const updatedPayload = {
                    ...existingData,
                    content,
                    role,
                    search_metadata: metadata,
                    fiction: metadata.is_fiction || existingData.fiction || false,
                    comms_processed: false,
                    isDiary
                };

                await setDoc(docRef, updatedPayload, { merge: true });

                // 2. Update the Typesense Index immediately with the unified payload
                await indexMessage({
                    ...updatedPayload,
                    timestamp: existingData.timestamp || Date.now()
                } as any, messageId, userId);

                console.log(`[MemoryManager] ✅ Background Archive Complete: "${metadata.title}"`);
            }
        } catch (e) {
            console.error("[MemoryManager] Background Archive Failed:", e);
        }
    }
};