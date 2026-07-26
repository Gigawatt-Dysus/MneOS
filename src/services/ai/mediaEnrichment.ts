/**
 * Media Enrichment Service
 * The "Librarian" - Orchestrates Azure Vision + Grok Narrative pipeline
 * 
 * [ZEN EWO 003] Central brain for AI-powered media enrichment
 */

import { AzureVisionService, type FaceDetection, type FaceAttributes } from './azureVision';
import { GrokVisionService, type AzureVibe, type NarrativeResult } from './grokVision';
import { doc, updateDoc, getFirestore, getDoc } from '../sovereignDbAdapter';

// ============================================================================
// TYPES
// ============================================================================

export interface EnrichmentResult {
    success: boolean;
    narrative?: string;
    facesDetected: number;
    azureVibe?: AzureVibe;
    error?: string;
    pipeline: {
        azureSuccess: boolean;
        azureTime?: number;
        grokSuccess: boolean;
        grokTime?: number;
    };
}

export interface EnrichmentOptions {
    /** Skip Azure face detection (use existing data or skip entirely) */
    skipAzure?: boolean;
    /** Pre-provided Azure vibe data */
    existingVibe?: AzureVibe;
    /** Save narrative to Firestore immediately */
    saveToFirestore?: boolean;
    /** User ID for Firestore path */
    userId?: string;
    /** Media document ID for Firestore path */
    mediaId?: string;
}

// ============================================================================
// MEDIA ENRICHMENT SERVICE
// ============================================================================

export const MediaEnrichmentService = {

    /**
     * Full enrichment pipeline: Azure Face Detection → Grok Narrative
     * 
     * Pipeline Flow:
     * 1. Azure detects faces and extracts "Vibe" (emotion, smile, age, hair)
     * 2. Grok receives full image + Azure Vibe as context
     * 3. Grok synthesizes rich narrative description
     * 4. Optionally save to Firestore
     */
    enrichMedia: async (
        imageUrl: string,
        options?: EnrichmentOptions
    ): Promise<EnrichmentResult> => {
        console.log('[Enrichment] 🧠 Starting Neural Enrichment Pipeline...');

        const pipeline = {
            azureSuccess: false,
            azureTime: 0,
            grokSuccess: false,
            grokTime: 0
        };

        let azureVibe: AzureVibe = options?.existingVibe || { faceCount: 0 };

        // ─────────────────────────────────────────────────────────────────
        // STAGE 1: Azure Face Detection (Extract "Vibe")
        // ─────────────────────────────────────────────────────────────────
        if (!options?.skipAzure && !options?.existingVibe) {
            const azureStart = Date.now();
            console.log('[Enrichment] 📷 Stage 1: Azure Face Detection...');

            try {
                const azureResult = await AzureVisionService.detectFaces(imageUrl, {
                    returnFaceId: false,
                    // [ZEN EWO 010] Clean Request - No attributes (Age/Emotion/Hair causes 403)
                    // We only want face rectangles for Grok to count faces.
                });

                pipeline.azureTime = Date.now() - azureStart;

                if (azureResult.success) {
                    pipeline.azureSuccess = true;

                    // Convert raw detections to Vibe summary
                    const facesWithAttrs = azureResult.faces.map(f => ({ attributes: f.faceAttributes }));
                    azureVibe = GrokVisionService.buildVibeFromAttributes(facesWithAttrs);

                    console.log(`[Enrichment] ✅ Azure: ${azureVibe.faceCount} face(s), Emotion: ${azureVibe.dominantEmotion || 'neutral'}`);
                } else {
                    console.warn('[Enrichment] ⚠️ Azure detection failed:', azureResult.error);
                    // Continue anyway - Grok can still analyze without vibe data
                }
            } catch (e: any) {
                console.error('[Enrichment] Azure error:', e);
                pipeline.azureTime = Date.now() - azureStart;
            }
        } else if (options?.existingVibe) {
            pipeline.azureSuccess = true;
            console.log('[Enrichment] ♻️ Using existing Azure vibe data');
        }

        // ─────────────────────────────────────────────────────────────────
        // STAGE 2: Grok Vision Narrative Generation
        // ─────────────────────────────────────────────────────────────────
        const grokStart = Date.now();
        console.log('[Enrichment] 🔮 Stage 2: Grok Neural Narrative...');

        let narrativeResult: NarrativeResult;

        // [ZEN EWO 009] Identity Lookup
        // If we have a mediaId, we check for grounded identities (face_tags)
        let identityContext = '';
        if (options?.mediaId && options.userId) {
            try {
                const db = getFirestore();
                const docRef = doc(db, 'users', options.userId, 'media', options.mediaId);
                const snap = await getDoc(docRef);

                if (snap.exists()) {
                    const data = snap.data();
                    if (data.face_tags && Array.isArray(data.face_tags) && data.face_tags.length > 0) {
                        const names = data.face_tags.map((t: any) => t.personName).filter(Boolean);
                        if (names.length > 0) {
                            identityContext = names.join(', ');
                            console.log(`[Enrichment] 🆔 Identity Context: ${identityContext}`);
                        }
                    }
                }
            } catch (e) {
                // Silent fail for context lookup to avoid blocking pipeline
            }
        }

        try {
            narrativeResult = await GrokVisionService.generateNarrative(
                imageUrl,
                azureVibe.faceCount > 0 ? azureVibe : undefined,
                identityContext
            );

            pipeline.grokTime = Date.now() - grokStart;
            pipeline.grokSuccess = narrativeResult.success;

            if (narrativeResult.success) {
                console.log(`[Enrichment] ✅ Grok: "${narrativeResult.narrative.substring(0, 80)}..."`);
            } else {
                console.warn('[Enrichment] ⚠️ Grok narrative failed:', narrativeResult.error);
            }
        } catch (e: any) {
            console.error('[Enrichment] Grok error:', e);
            pipeline.grokTime = Date.now() - grokStart;
            narrativeResult = { success: false, narrative: '', error: e.message };
        }

        // ─────────────────────────────────────────────────────────────────
        // STAGE 3: Optional Firestore Persistence
        // ─────────────────────────────────────────────────────────────────
        if (options?.saveToFirestore && options.userId && options.mediaId && narrativeResult.success) {
            try {
                const db = getFirestore();
                const mediaRef = doc(db, 'users', options.userId, 'media', options.mediaId);

                await updateDoc(mediaRef, {
                    narrative: narrativeResult.narrative,
                    ai_description: narrativeResult.narrative, // [ZEN] SSOT Pre-sync
                    'search_metadata.summary': narrativeResult.narrative,
                    narrativeGeneratedAt: new Date().toISOString(),
                    azureVibe: azureVibe.faceCount > 0 ? azureVibe : null,
                    aiEnriched: true
                });

                console.log('[Enrichment] 💾 Narrative saved to Firestore');
            } catch (e: any) {
                console.error('[Enrichment] Firestore save failed:', e);
            }
        }

        // ─────────────────────────────────────────────────────────────────
        // RESULT
        // ─────────────────────────────────────────────────────────────────
        const totalTime = (pipeline.azureTime || 0) + (pipeline.grokTime || 0);
        console.log(`[Enrichment] 🏁 Pipeline complete in ${totalTime}ms`);

        return {
            success: narrativeResult.success,
            narrative: narrativeResult.narrative,
            facesDetected: azureVibe.faceCount,
            azureVibe: azureVibe.faceCount > 0 ? azureVibe : undefined,
            error: narrativeResult.error,
            pipeline
        };
    },

    /**
     * Batch enrich multiple media items
     * Includes rate limiting to avoid API throttling
     */
    enrichBatch: async (
        items: Array<{ id: string; imageUrl: string }>,
        userId: string,
        options?: {
            delayBetweenItems?: number;
            onProgress?: (processed: number, total: number, current: string) => void;
        }
    ): Promise<{
        processed: number;
        successful: number;
        failed: number;
        results: Array<{ id: string; success: boolean; narrative?: string; error?: string }>
    }> => {
        const delay = options?.delayBetweenItems || 500; // Default 500ms between items
        const results: Array<{ id: string; success: boolean; narrative?: string; error?: string }> = [];
        let successful = 0;
        let failed = 0;

        console.log(`[Enrichment] 📚 Starting batch enrichment of ${items.length} items...`);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            options?.onProgress?.(i + 1, items.length, item.id);

            try {
                const result = await MediaEnrichmentService.enrichMedia(item.imageUrl, {
                    saveToFirestore: true,
                    userId,
                    mediaId: item.id
                });

                if (result.success) {
                    successful++;
                    results.push({ id: item.id, success: true, narrative: result.narrative });
                } else {
                    failed++;
                    results.push({ id: item.id, success: false, error: result.error });
                }
            } catch (e: any) {
                failed++;
                results.push({ id: item.id, success: false, error: e.message });
            }

            // Rate limiting delay
            if (i < items.length - 1) {
                await new Promise(r => setTimeout(r, delay));
            }
        }

        console.log(`[Enrichment] ✅ Batch complete: ${successful} succeeded, ${failed} failed`);

        return {
            processed: items.length,
            successful,
            failed,
            results
        };
    },

    /**
     * [ZEN] Neural Fusion: Ground a generic AI narrative in human sovereign truth.
     * This is the "Full Self-Driving" loop where GIGI learns from human grounding.
     */
    fuseGroundedNarrative: async (userId: string, description: string, currentNarrative: string, userName: string = "User"): Promise<string> => {
        if (!description || !currentNarrative) return currentNarrative;
        
        console.log(`[Enrichment] 🧠 Commencing Neural Fusion for ${userName}...`);
        try {
            const systemPrompt = `
                ACT AS: The Project GIGI Neural Bridge (Sovereign Archival Integrity).
                TASK: Fuse a short Human "Artifact Label" with a long AI "Neural Observation".
                
                HUMAN CONTEXT: The user's name is ${userName}. 
                HUMAN LABEL: "${description}"
                AI OBSERVATION: "${currentNarrative}"
                
                GOAL: Create a single, grounded, "spooky intuitive" personal narrative.
                
                MANDATORY RULES:
                1. IDENTITY SUBSTITUTION: Replace generic subjects with specific identities from the Human Label ("Lizzie", "Carl").
                2. BIOLOGICAL TRUTH: Respect the visual age of the subject. If the AI Observation describes a "child" or "young girl," do NOT refer to them as "Mom" or a parent, even if they share a name with one. This is non-negotiable.
                3. CHRONOLOGICAL SANITY: Use the timestamp (if provided) and visual evidence to disambiguate identities. A child in 2020 cannot be the mother of a grown adult.
                4. SPOOKY INTUITION: If the Human Label says "Mom", it refers to ${userName}'s mother. If the Human Label says a name like "Lizzie", use that name unless you are 100% certain of the relationship.
                5. PRESERVE VIBE: Keep the evocative visual details of the AI Observation (lighting, textures).
                6. REMINISCE: Write as a sentient companion helping ${userName} remember their history. No "This photo shows."
                
                RESULT:
            `;

            // Use the xAI provider directly for the grounding pass
            const response = await (window as any).mediaEnrichment.callXAI('grok-4.3', [], systemPrompt);
            return response.text.trim();
        } catch (error) {
            console.warn('[Enrichment] Neural Fusion failed, falling back to original:', error);
            return currentNarrative;
        }
    },

    // Re-expose provider calls for internal use
    callXAI: async (modelId: string, messages: any[], systemInstruction: string) => {
        const { callXAI } = await import('./providers');
        return callXAI(modelId, messages, systemInstruction);
    }
};

// ============================================================================
// CONSOLE ACCESS
// ============================================================================

if (typeof window !== 'undefined') {
    (window as any).mediaEnrichment = MediaEnrichmentService;
    // console.log('[Enrichment] Service loaded. Access via window.mediaEnrichment');
}

export default MediaEnrichmentService;
