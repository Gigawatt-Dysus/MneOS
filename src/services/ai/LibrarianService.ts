// services/ai/LibrarianService.ts
import { searchChatMemory, searchDaydreams, searchTimeline } from '../searchService';
import { googlePhotosService } from '../googlePhotosService';
import { callXAI } from './providers';
import { DEFAULT_RESERVE_ID } from './config';
import { CodexService } from '../CodexService';
import { typesenseService } from '../typesenseService';
import type { User, ChatMessage } from '../../types';

export interface MetaficialReport {
    resonanceScore: number;
    archivalAnchors: string[];
    contradictions: string[];
    synthesis: string;
    externalArtifactsFound: any[];
    codexInsights: string[];
}

/**
 * [SOVEREIGN LIBRARIAN] — The Subconscious Deep-Dive Engine
 * 
 * Performs forensic analysis across LifeOS archives to detect narrative drift,
 * surface relevant memories, and provide grounded context for Brita.
 */
export const LibrarianService = {

    async performDeepDive(
        userQuery: string,
        history: ChatMessage[],
        user: User,
        contextMode: 'grounded' | 'creative' | 'mixed' = 'mixed'
    ): Promise<MetaficialReport> {

        console.log(`%c[Librarian] 🕵️ Deep Dive Started (${contextMode}): "${userQuery.substring(0, 80)}..."`, 'color: #ff00ff; font-weight: bold;');

        // Parallel evidence gathering
        const [internalMemories, timelineEvents, externalPhotos, codexEntries, tagEntries] = await Promise.all([
            contextMode === 'creative' 
                ? searchDaydreams(userQuery, user.id) 
                : searchChatMemory(userQuery, user.id),
            
            searchTimeline(userQuery, user.id),
            
            googlePhotosService.searchPhotos(userQuery).catch(() => []),
            
            contextMode === 'creative' && user.id
                ? CodexService.searchCanon(user.id, userQuery)
                : Promise.resolve([]),

            typesenseService.searchTags(userQuery)
        ]);

        const rawEvidence = [
            ...internalMemories.map((m: any) => `[${contextMode === 'creative' ? 'DAYDREAM' : 'CHAT'}] ${m.content}`),
            ...timelineEvents.map((e: any) => `[EVENT] ${e.title}: ${e.description}`),
            ...codexEntries.map((c: any) => `[CODEX] ${c.subject}: ${c.rule}`),
            ...tagEntries.map((t: any) => `[ENTITY] ${t.name} (${t.type}): ${t.description || ''} ${t.facts || ''}`),
            ...externalPhotos.slice(0, 4).map((p: any) => `[PHOTO] ${p.creationTime || ''} - ${p.caption || 'No caption'}`)
        ].join('\n');

        if (rawEvidence.length < 20) {
            return this.emptyReport("Insufficient evidence found in archives.");
        }

        // Grok-powered synthesis
        const auditPrompt = `
You are the Sovereign Librarian for Brita (LifeOS AI Companion).
Mode: ${contextMode.toUpperCase()}

USER QUERY: "${userQuery}"

RAW EVIDENCE:
${rawEvidence}

TASK:
- Identify relevant memories and contradictions (Narrative Drift)
- Provide a warm, intuitive synthesis Brita can use
- Flag any canon/lore conflicts in creative mode

Return clean JSON:
{
  "resonanceScore": 0.0–1.0,
  "archivalAnchors": ["short memory labels"],
  "contradictions": ["any detected drift"],
  "synthesis": "Warm, concise, narrative summary for Brita",
  "externalArtifactsFound": [],
  "codexInsights": []
}
`;

        try {
            const res = await callXAI(DEFAULT_RESERVE_ID, [
                { role: 'user', parts: [{ text: auditPrompt }] }
            ], "", { temperature: 0.2, maxOutputTokens: 800, responseFormat: { type: "json_object" } });

            const cleanText = res.text || "{}";
            
            // [ZEN SAFE PARSE ENGINE] — Robust JSON Extraction & Sanitization
            const safeJsonParse = (text: string, fallback: any) => {
                try {
                    let cleaned = text.trim();
                    const firstBrace = cleaned.indexOf('{');
                    const lastBrace = cleaned.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
                    }
                    cleaned = cleaned.replace(/^\*\*|\*\*$/g, '').trim();
                    return JSON.parse(cleaned);
                } catch (err) {
                    console.warn("[Librarian] Strict parse failed, scrubbing and retrying...", err);
                    try {
                        let ultraClean = text.replace(/\*/g, '').trim();
                        const firstBrace = ultraClean.indexOf('{');
                        const lastBrace = ultraClean.lastIndexOf('}');
                        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                            ultraClean = ultraClean.substring(firstBrace, lastBrace + 1);
                        }
                        return JSON.parse(ultraClean);
                    } catch (e2) {
                        console.error("[Librarian] Critical JSON parsing crash avoided:", e2);
                        return fallback;
                    }
                }
            };

            const report = safeJsonParse(cleanText, {});

            return {
                resonanceScore: typeof report.resonanceScore === 'number' ? report.resonanceScore : 0.6,
                archivalAnchors: report.archivalAnchors || [],
                contradictions: report.contradictions || [],
                synthesis: report.synthesis || "Archive connection established.",
                externalArtifactsFound: report.externalArtifactsFound || [],
                codexInsights: report.codexInsights || []
            };

        } catch (e) {
            console.error("[Librarian] Audit failed:", e);
            return this.emptyReport("Neural fog detected. Proceeding on intuition.");
        }
    },

    emptyReport(message: string): MetaficialReport {
        return {
            resonanceScore: 0,
            archivalAnchors: [],
            contradictions: [],
            synthesis: message,
            externalArtifactsFound: [],
            codexInsights: []
        };
    }
};
