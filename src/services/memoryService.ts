import { searchChatMemory, indexMessage, searchDaydreams, searchTimeline, searchTakeoutMedia } from './searchService';
import type { ChatMessage, PeerChatSegment } from '../types';
import { callXAI, callGrokVisionStateless } from './ai/providers'; // [ZEN V32]
import { FALLBACK_MODEL_ID } from './ai/config'; // [ZEN V32]
import { updateDoc, doc, db } from './sovereignDbAdapter';

export const MemoryService = {

    // The "Recall" Step
    async recallContext(userQuery: string, userId: string, filterOptions?: { isFiction?: boolean }): Promise<string> {
        // [ZEN V14] Multi-Index Search
        const [memoriesRaw, daydreamsRaw, eventsRaw, mediaRaw] = await Promise.all([
            searchChatMemory(userQuery, userId, filterOptions),
            searchDaydreams(userQuery, userId),
            searchTimeline(userQuery, userId),
            searchTakeoutMedia(userQuery, userId)
        ]);

        const totalHitsRaw = memoriesRaw.length + daydreamsRaw.length + eventsRaw.length + mediaRaw.length;

        if (totalHitsRaw === 0) {
            console.log("%c[CORTEX] 0 Memories found. Returning empty context.", "color: gray");
            return "";
        }

        console.log(`[Cortex] 🧠 Relevancy Filter Engaged on ${totalHitsRaw} Candidates...`);

        // [ZEN JIT-RAG] Intercept top media hits and upgrade basic Moondream captions via Grok Vision
        const enhancedMediaRaw = await enhanceMoondreamCaptionsJIT(mediaRaw, userId);

        // [ZEN V32] CORTEX FILTER: AI Relevancy Check
        // Pass each bucket through the relevance gate
        const [memories, daydreams, events, media] = await Promise.all([
            bayesianCortexFilter(userQuery, memoriesRaw, "CHAT_MEMORIES"),
            bayesianCortexFilter(userQuery, daydreamsRaw, "DAYDREAMS"),
            bayesianCortexFilter(userQuery, eventsRaw, "LIFE_EVENTS"),
            bayesianCortexFilter(userQuery, enhancedMediaRaw, "ARCHIVE_MEDIA")
        ]);

        const totalRelevant = memories.length + daydreams.length + events.length + media.length;

        if (totalRelevant === 0) {
            console.log(`%c[CORTEX] 🧹 Filter Purged All Candidates. Context is clean.`, 'color: orange');
            return "";
        }

        // [ZEN LOG] Confirm Hand-off
        console.log(`%c[CORTEX] Injecting ${totalRelevant}/${totalHitsRaw} Items (Mem:${memories.length}, Day:${daydreams.length}, Evt:${events.length}, Media:${media.length})`, "color: #00ff00; font-weight: bold;");

        let context = `\n[RECALLED CONTEXT - RELEVANT TO CURRENT TOPIC]\n`;

        if (media.length > 0) {
            context += `--- RELATED TAKEOUT ARCHIVE MEDIA ---\n` + media.join('\n') + `\n---------------------------------------\n`;
        }

        if (events.length > 0) {
            context += `--- RELATED LIFE EVENTS (TIME VORTEX) ---\n` + events.join('\n') + `\n---------------------------------------\n`;
        }

        if (daydreams.length > 0) {
            context += `--- RELATED STORIES (DAYDREAM STUDIO) ---\n` + daydreams.join('\n') + `\n---------------------------------------\n`;
        }

        if (memories.length > 0) {
            context += `--- RELATED CHAT MEMORIES ---\n` + memories.join('\n');
        }

        return context + `\n[END CONTEXT]\n`;
    },

    /**
     * Context Bridge: Map a PeerChatSegment to a searchable ChatMessage 
     * and index it for the local user.
     */
    async indexPeerSegment(segment: PeerChatSegment, userId: string) {
        console.log(`[Cortex] Context Bridge: Indexing shared AI memory from ${segment.fromName}`);
        const chatMsg: ChatMessage = {
            role: segment.authorType === 'ai' ? 'model' : 'user',
            content: segment.content,
            timestamp: new Date(segment.timestamp)
        };
        // Add metadata to distinguish as shared
        (chatMsg as any).is_shared = true;
        (chatMsg as any).shared_from = segment.fromName;

        await indexMessage(chatMsg, `peer_${segment.id}`, userId);
    },

    async consolidate(history: ChatMessage[]) {
        console.log("[Cortex] Consolidation pending...");
    }
};

/**
 * [ZEN JIT-RAG] GROK VISION INTERCEPTOR
 * Scans dredged media. If it lacks Grok enhancement, pulls the image via local staging,
 * calls Grok Vision for a premium caption, updates the hit, and persists back to the database.
 */
async function enhanceMoondreamCaptionsJIT(mediaRaw: any[], userId: string): Promise<any[]> {
    if (mediaRaw.length === 0) return [];
    
    const enhancedMedia = [...mediaRaw];
    let enhancedCount = 0;

    for (let i = 0; i < enhancedMedia.length; i++) {
        const d = enhancedMedia[i];
        
        if (!d.grokEnhanced && enhancedCount < 2) { // Process max 2 to bound latency
            try {
                console.log(`[JIT RAG] 👁️ Escalating image to Grok Vision: ${d.filepath}`);
                
                // Fetch the image from local staging API
                const stagingUrl = `http://localhost:3001/api/preview?filepath=${encodeURIComponent(d.filepath)}`;
                const response = await fetch(stagingUrl);
                if (!response.ok) throw new Error("Staging API failed to serve image");
                
                const arrayBuffer = await response.arrayBuffer();
                let binary = '';
                const bytes = new Uint8Array(arrayBuffer);
                const len = bytes.byteLength;
                for (let j = 0; j < len; j++) {
                    binary += String.fromCharCode(bytes[j]);
                }
                const base64 = window.btoa(binary);
                const mimeType = response.headers.get('content-type') || 'image/jpeg';
                
                const imagePart = {
                    inlineData: { mimeType, data: base64 }
                };
                
                const grokCaption = await callGrokVisionStateless(
                    imagePart, 
                    "Analyze this image vividly. What is happening? Who or what is in it? Describe the mood, colors, and setting in detail. Be conversational but highly descriptive."
                );
                
                console.log(`[JIT RAG] ✅ Grok Vision Upgrade: ${grokCaption.substring(0, 50)}...`);
                
                // Update local representation for the AI Context
                d.caption = grokCaption;
                d.grokEnhanced = true;
                d.content = `[TAKEOUT ARCHIVE (GROK ENHANCED)] ${d.content.split('\n')[0].replace('[TAKEOUT ARCHIVE] ', '')}\nPath: ${d.filepath}\nCaption: ${grokCaption}\nGrok Enhanced: Yes`;
                
                // Persist the new caption to MongoDB asynchronously via sovereignDbAdapter
                updateDoc(doc(db, 'takeout_media', d.id), {
                    caption: grokCaption,
                    grokEnhanced: true,
                    updatedAt: Date.now()
                }).catch(err => console.error("[JIT RAG] Failed to save Grok enhanced caption to DB:", err));
                
                enhancedCount++;
            } catch(e) {
                console.error(`[JIT RAG] ❌ Grok Vision Escalation Failed for ${d.filepath}:`, e);
            }
        }
    }
    
    return enhancedMedia;
}

/**
 * [ZEN V32] BAYESIAN CORTEX FILTER
 * A multi-layer weighing engine for memory relevance.
 * 
 * Layers:
 * 1. TEMPORAL DECAY: Old memories fade unless reinforced. (-10% per year)
 * 2. RESONANCE: Semantic clustering boosts weight. (3 events about "School" = Signal)
 * 3. AI PROBABILITY: The "Vibe Check" from a fast LLM.
 * 
 * Formula: FinalScore = (HeuristicScore + AI_Probability) / 2
 * Threshold: > 0.4
 */
async function bayesianCortexFilter(query: string, candidates: any[], type: string): Promise<string[]> {
    if (candidates.length === 0) return [];

    // 1. CALCULATE HEURISTICS (Decay + Resonance)
    const currentYear = new Date().getFullYear();
    const tagMap = new Map<string, number>();

    // Pass 1: Build Tag Map for Resonance
    candidates.forEach(c => {
        if (c.tags && Array.isArray(c.tags)) {
            c.tags.forEach((t: string) => {
                const tag = t.toLowerCase();
                tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
            });
        }
    });

    const scoredCandidates = candidates.map((c, index) => {
        let hScore = 1.0;

        // A. Temporal Decay
        const eventYear = new Date(c.timestamp).getFullYear(); // Assumes timestamp is ms or parsable
        const age = Math.max(0, currentYear - eventYear);
        const decay = Math.min(0.9, age * 0.1); // Max 90% decay

        if (!c.isCore) {
            hScore -= decay;
        } else {
            hScore += 0.2; // Core memories get a buff
        }

        // B. Resonance Boost
        let resonance = 0;
        if (c.tags) {
            c.tags.forEach((t: string) => {
                const count = tagMap.get(t.toLowerCase()) || 0;
                if (count > 1) resonance += 0.1; // +0.1 for every shared tag
            });
        }
        hScore += Math.min(0.5, resonance); // Cap resonance at +0.5

        return { ...c, hScore, originalIndex: index };
    });

    // 2. FILTER LOW HEURISTICS BEFORE AI (Optimization)
    // If heuristic is < 0.1 (ancient, no resonance, not core), discard immediately
    const distinctCandidates = scoredCandidates.filter(c => c.hScore > 0.1);

    if (distinctCandidates.length === 0) return [];

    // 3. AI PROBABILITY CHECK (The "Vibe Check")
    const prompt = `
    [SYSTEM]: You are the BAYESIAN RELEVANCE JUDGE.
    Task: Assign a Probability Score (0.0 to 1.0) for each memory's relevance to the User Query.
    
    USER QUERY: "${query}"
    
    MEMORIES:
    ${distinctCandidates.map((c, i) => `[ID:${i}] <${new Date(c.timestamp).getFullYear()}> ${c.content.substring(0, 200).replace(/\n/g, ' ')}...`).join('\n')}
    
    INSTRUCTION:
    - If the memory directly answers or relates to the query: Score > 0.8
    - If it's thematically related (same topic/vibe): Score 0.4 - 0.7
    - If it's unrelated noise (random old event): Score < 0.2
    
    RETURN ONLY JSON: { "scores": [0.9, 0.1, 0.5] } corresponding to the IDs.
    `;

    try {
        const res = await callXAI('grok-4.3', [{ role: 'user', content: prompt }], "", { 
            temperature: 0.1
        });

        const txt = res.text || "{}";
        const cleanTxt = txt.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleanTxt);
        const aiScores = json.scores || [];

        // 4. FINAL VERDICT
        const finalResults: string[] = [];

        distinctCandidates.forEach((c, i) => {
            const aiProb = aiScores[i] !== undefined ? aiScores[i] : 0.0;
            const finalScore = (c.hScore + aiProb) / 2;

            // Threshold: 0.4 allows "Strong Heuristic OR Strong AI" to pass, but "Weak Both" fails.
            if (finalScore > 0.4) {
                finalResults.push(c.content);
            }
        });

        if (finalResults.length < distinctCandidates.length) {
            console.log(`[Cortex] ⚖️ Bayesian Filter: Kept ${finalResults.length}/${distinctCandidates.length} Items based on H+AI Scores.`);
        }

        return finalResults;

    } catch (e) {
        console.warn(`[Cortex] Bayesian check failed. Falling back to Heuristic > 0.6`, e);
        // Fallback: Just return strong heuristics
        return distinctCandidates.filter(c => c.hScore > 0.6).map(c => c.content);
    }
}