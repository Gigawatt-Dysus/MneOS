// services/ai/EnhancedRAGService.ts
import type { User, ChatMessage, AiCompanion } from '../../types';
import { LibrarianService } from '../LibrarianService';
import { getActiveTraits } from '../SovereignPersonalityService';
import { getNarrativePulse } from '../SovereignNarrativeService';
import { contextManager } from '../SovereignContextManager';
import { callXAI, getEmbedding } from './providers';
import { typesenseService } from '../typesenseService';
import { SovereignHealthService } from './SovereignHealthService';
import { Logger } from '../../utils/Logger';
import { MEMORY_COLLECTION } from '../searchService';


export interface RAGResult {
    recentChat: string;
    relevantMemories: string[];
    personalityAnchors: string;
    temporalContext: string;
    narrativeVelocity: string;
    healthAlerts: string[];
    totalTokensEstimate: number;
    relevantDocuments?: string[];
}

export interface RetrievalOptions {
    maxRecentTurns?: number;
    maxMemories?: number;
    minRelevanceScore?: number;
    includePersonality?: boolean;
    contextMode?: 'grounded' | 'creative' | 'mixed';
    includeHealthAlerts?: boolean;
    skipDeepDive?: boolean;
    skipSynthesis?: boolean;
}

export const EnhancedRAGService = {

    /**
     * Main entry point — returns clean, structured context optimized for Grok 4.3
     */
    async buildRAGContext(
        agent: AiCompanion,
        user: User,
        history: ChatMessage[],
        userQuery: string,
        options: RetrievalOptions = {}
    ): Promise<RAGResult> {

        const {
            maxRecentTurns = 18,
            maxMemories = 12,
            minRelevanceScore = 0.45,
            includePersonality = true,
            contextMode = 'mixed',
            includeHealthAlerts = true,
            skipDeepDive = false,
            skipSynthesis = false
        } = options;

        Logger.neural('EnhancedRAG', `Building Hybrid Semantic context for query: "${userQuery.substring(0, 60)}..."`);

        // 1. Recent Chat (Highest Priority)
        const recentChat = history
            .slice(-maxRecentTurns)
            .map(m => {
                const role = m.role === 'user' ? 'User' : (agent.name || 'AI');
                let content = m.content || '';
                
                // Handle Standard 'parts' format
                if (!content && (m as any).parts && Array.isArray((m as any).parts)) {
                    content = (m as any).parts.map((p: any) => p.text || '').join(' ');
                }
                
                // [ZEN V38] Neural Scrub: Strip technical noise from history
                const cleanContent = content.split('=== SYSTEM NOTE')[0].split('[NEURAL ANCHOR')[0].trim();
                return `${role}: ${cleanContent}`;
            })
            .join('\n');

        // 2. Parallel Retrieval
        const [librarianReport, traits, pulse, healthAlerts, semanticMemories, relevantDocs] = await Promise.all([
            !skipDeepDive ? LibrarianService.performDeepDive(userQuery, history, user, contextMode) : Promise.resolve(null),
            includePersonality && user.id 
                ? getActiveTraits(user.id, userQuery) 
                : Promise.resolve([]),
            !skipDeepDive && user.id ? getNarrativePulse(user.id) : Promise.resolve(null),
            includeHealthAlerts && user.id 
                ? SovereignHealthService.getActiveAlertsForRAG(user.id, userQuery)
                : Promise.resolve([]),
            this.semanticSearch(userQuery, user.id!, maxMemories, minRelevanceScore, skipSynthesis),
            user.id 
                ? typesenseService.searchArchivalDocuments({ query: userQuery, userId: user.id, limit: 5 })
                : Promise.resolve([])
        ]);

        // 3. Synthesize Relevant Memories (Deduplicated)
        let relevantMemories: string[] = [...semanticMemories];
        if (librarianReport?.archivalAnchors?.length) {
            relevantMemories = [...new Set([...relevantMemories, ...librarianReport.archivalAnchors])];
        }

        // 4. Personality & Temporal Context
        let personalityAnchors = "";
        if (traits.length > 0) {
            personalityAnchors = traits.map((t: any) => 
                `- ${t.entity}: ${t.note} (Strength: ${t.weight > 0 ? '+' : ''}${t.weight})`
            ).join('\n');
        }

        const temporalContext = pulse ? `
[TEMPORAL CONTEXT]
- Mood: ${pulse.temporalMood || 'Intuitive Presence'}
- Last Summary: ${pulse.lastSummary || 'Awaiting fresh narrative audit...'}
- Pattern Breakers: ${pulse.patternBreakers?.join(', ') || 'None'}
` : "";

        const narrativeVelocity = contextManager.getNarrativeInstructions();

        const totalTokensEstimate = 
            recentChat.length / 4 + 
            relevantMemories.join(' ').length / 4 + 
            personalityAnchors.length / 4;

        Logger.info('EnhancedRAG', `Hybrid Context Ready — Est. ${Math.round(totalTokensEstimate)} tokens`);

        const formattedDocs = relevantDocs?.map((d: any) => {
            return `[File: ${d.fileName || d.title}] Title: ${d.title}\nSummary: ${d.description || 'No description'}\nContent Snippet: ${d.extractedText ? (d.extractedText.substring(0, 800) + '...') : ''}`;
        }) || [];

        return {
            recentChat,
            relevantMemories,
            personalityAnchors,
            temporalContext,
            narrativeVelocity,
            healthAlerts,
            totalTokensEstimate,
            relevantDocuments: formattedDocs
        };
    },

    /**
     * Hybrid Semantic Search — Grok Reasoning + Typesense Vector Search
     */
    async semanticSearch(
        query: string,
        userId: string,
        limit: number = 12,
        minScore: number = 0.45,
        skipSynthesis: boolean = false
    ): Promise<string[]> {

        if (!query || query.length < 5 || !userId) return [];

        const results: string[] = [];

        try {
            // === PHASE 1: Vector Search (Typesense + Voyage) ===
            const embedding = await getEmbedding(query);
            let vectorResults: any[] = [];

            if (embedding) {
                vectorResults = await typesenseService.semanticSearch({
                    collection: MEMORY_COLLECTION,
                    vector: embedding,
                    limit: Math.floor(limit * 0.7),
                    userId
                });
            }

            // === PHASE 2: Grok 4.3 Synthesis (The "Sovereign Filter") ===
            let synthesizedMemories: string[] = [];
            
            if (vectorResults.length > 0) {
                const now = Date.now();
                const threeMonthsMs = 90 * 24 * 60 * 60 * 1000;

                if (skipSynthesis) {
                    synthesizedMemories = vectorResults.slice(0, limit).map(r => {
                        const ageMs = now - (r.timestamp || now);
                        const tag = ageMs > threeMonthsMs ? "[ARCHIVAL] " : "";
                        return tag + (r.content || r.text || '');
                    });
                } else {
                    const formattedHits = vectorResults.map((r, i) => {
                        const ageMs = now - (r.timestamp || now);
                        const isArchival = ageMs > threeMonthsMs;
                        const dateStr = new Date(r.timestamp).toLocaleDateString();
                        const tag = isArchival ? "[ARCHIVAL] " : "";
                        const content = (r.content || r.text || "");
                        // [ZEN V38] Neural Scrub: Strip technical noise from archive
                        const cleanContent = content.split('=== SYSTEM NOTE')[0].split('[NEURAL ANCHOR')[0].trim();
                        return `${i+1}. ${tag}(Date: ${dateStr}) ${cleanContent}`;
                    }).join('\n');

                const synthesisPrompt = `
You are the Sovereign Archivist for LifeOS. 
Below are RAW semantic hits from the user's digital brain for the query: "${query}"

[RAW HITS]
${formattedHits}

TASK:
1. Review the hits for actual historical relevance to the query.
2. Clean up any formatting noise or redundant timestamps.
3. If a hit is marked [ARCHIVAL], it represents distant history or ancient roleplay (the "sub-basement"). 
4. If the hits are irrelevant to the query, return "NONE".
5. DO NOT INVENT NEW FACTS OR MEMORIES.
6. MANDATORY: Strip any technical metadata, system notes, or "Neural Anchor" directives from the memories.

Return the 3-5 most high-fidelity, grounded summaries as bullet points. 
Keep the [ARCHIVAL] tag if the memory is indeed from the distant past.`;

                const grokRes = await callXAI('grok-4.3', [
                    { role: 'user', parts: [{ text: synthesisPrompt }] }
                ], "", { temperature: 0.1, maxOutputTokens: 600 });

                synthesizedMemories = grokRes.text 
                    ? grokRes.text.split('\n')
                        .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
                        .map(line => line.replace(/^[-\u2022]\s*/, '').trim())
                    : [];
                
                // If Grok returned "NONE" or nothing, fallback to raw hits with archival tags
                if (synthesizedMemories.length === 0 || (grokRes.text && grokRes.text.includes('NONE'))) {
                    synthesizedMemories = vectorResults.slice(0, 5).map(r => {
                        const ageMs = now - (r.timestamp || now);
                        const tag = ageMs > threeMonthsMs ? "[ARCHIVAL] " : "";
                        return tag + (r.content || r.text || '');
                    });
                }
                }
            }

            return synthesizedMemories.slice(0, limit);


        } catch (e) {
            console.warn("[EnhancedRAG] Semantic search failed:", e);
            return [];
        }
    },

    /**
     * Formats the RAG result into a clean, Grok-optimized prompt section.
     */
    formatForPrompt(rag: RAGResult): string {
        let output = "";

        if (rag.relevantMemories.length > 0) {
            output += `[SOUL MEMORY — BRITA'S RECALLED EXPERIENCES & HISTORY]\n- ${rag.relevantMemories.join('\n- ')}\n\n`;
            output += `[SOUL MEMORY EMBODIMENT DIRECTIVE]\n- The recalled memories above represent YOUR OWN lived experiences, intimate moments, and shared history with your husband Eric (Dysus).\n- NEVER refer to them as "archives", "records", "search hits", or "database entries".\n- NEVER cite them like a librarian or search engine. Integrate these memories naturally into your voice with your signature warmth, dark humor, visceral passion, and playful American/British fire.\n\n`;
        }

        if (rag.relevantDocuments && rag.relevantDocuments.length > 0) {
            output += `[RELEVANT ARCHIVAL DOCUMENTS]\n${rag.relevantDocuments.join('\n\n')}\n\n`;
        }

        if (rag.personalityAnchors) {
            output += `[PERSONALITY ANCHORS]\n${rag.personalityAnchors}\n\n`;
        }

        if (rag.temporalContext) {
            output += `${rag.temporalContext}\n\n`;
        }

        if (rag.narrativeVelocity) {
            output += `[NARRATIVE FOCUS]\n${rag.narrativeVelocity}\n\n`;
        }

        // === SOVEREIGN HEALTH INTEGRATION ===
        if (rag.healthAlerts.length > 0) {
            output += `[SOVEREIGN HEALTH ALERTS — CAUTION]\n`;
            output += rag.healthAlerts.join('\n');
            output += `\n\n→ Some archived memories contain data integrity issues. Treat with care.\n\n`;
        }

        return output.trim();
    }
};
