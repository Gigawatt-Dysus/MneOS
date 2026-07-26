import { searchChatMemory, searchDaydreams, searchTimeline } from './searchService';
import { googlePhotosService } from './googlePhotosService';
import { callXAI } from './ai/providers';
import { DEFAULT_RESERVE_ID } from './ai/config';
import { CodexService, CodexEntry } from './CodexService'; // [ZEN V34]
import type { User, ChatMessage } from '../types';

// [ZEN V34] THE SOVEREIGN LIBRARIAN (Subconscious Service)
// This agentic layer acts as the "Subconscious" for Brita.
// It performs forensic deep dives into LifeOS archives and external metadata
// to find "Metaficial" weight and detect "Narrative Drift".

export interface MetaficialReport {
    resonanceScore: number; // 0 to 1
    archivalAnchors: string[];
    contradictions: string[];
    synthesis: string;
    externalArtifactsFound: any[];
    codexInsights: string[]; // [ZEN NEW] Project MUSE
}

export const LibrarianService = {
    async performDeepDive(
        userQuery: string, 
        history: any[], 
        user: User, 
        contextMode: 'grounded' | 'creative' | 'mixed' = 'grounded'
    ): Promise<MetaficialReport> {
        console.log(`%c[Librarian] 🕵️ Deep Dive Initiated (${contextMode}): "${userQuery}"`, 'color: #ff00ff; font-weight: bold;');

        // 1. GATHER SIGNALS (Diverter Valve Logic)
        let internalMemories: any[] = [];
        let timelineEvents: any[] = [];
        let externalPhotos: any[] = [];
        let codexEntries: CodexEntry[] = [];

        if (contextMode === 'creative') {
            // [PROJECT MUSE] Focus on Lore, Daydreams, and the Codex
            const activeBible = await CodexService.getActiveBible(user.id);
            const [daydreams, canon] = await Promise.all([
                searchDaydreams(userQuery, user.id),
                activeBible ? CodexService.searchCanon(activeBible.id, userQuery) : Promise.resolve([])
            ]);
            internalMemories = daydreams;
            codexEntries = canon;
        } else {
            // [GROUNDED] Focus on History, Metadata, and Real-world logs
            const [memories, events, photos] = await Promise.all([
                searchChatMemory(userQuery, user.id),
                searchTimeline(userQuery, user.id),
                googlePhotosService.searchPhotos(userQuery)
            ]);
            internalMemories = memories;
            timelineEvents = events;
            externalPhotos = photos;
        }

        const rawEvidence = [
            ...internalMemories.map((m: any) => `[${contextMode === 'creative' ? 'LORE/DAYDREAM' : 'CHAT'}] ${m.content}`),
            ...timelineEvents.map((e: any) => `[REAL_EVENT] ${e.title}: ${e.description}`),
            ...codexEntries.map((c: CodexEntry) => `[CODEX_LAW] Subject: ${c.subject}, Category: ${c.category}, Rule: ${c.rule}`),
            ...externalPhotos.slice(0, 5).map((p: any) => `[METAFICIAL_LOG] Date: ${p.creationTime}, GPS: ${p.location || 'Unknown'}`)
        ].join('\n');

        // 2. THE AUDIT (Grok-4.1-Fast)
        const auditPrompt = `
        [PROTOCOL: ${contextMode === 'creative' ? 'CANON SIMULATION' : 'METAFICIAL AUDIT'}]
        Role: Subconscious Librarian for Brita.
        Mode: ${contextMode}
        
        USER QUERY: "${userQuery}"
        
        RAW EVIDENCE GATHERED:
        ${rawEvidence}
        
        YOUR TASK (${contextMode.toUpperCase()}):
        ${contextMode === 'creative' ? `
        1. CANON CONSISTENCY: Does the User's query conflict with established Codex Laws or previous Daydreams? (e.g. "User jumped on Densara, but gravity is 1.2g").
        2. META-LORE: Extrapolate emergent physics or logical consequences based on the Codex.
        3. PROPOSALS: Should any new rule be established?
        ` : `
        1. METAFICIAL VALIDATION: Does the query conflict with GPS, Timestamps, or Logs? (Narrative Drift).
        2. CONTEXT CATEGORIZATION: Explicitly label recalled memories as either "HISTORICAL FACT" (Real Life) or "NARRATIVE ROLEPLAY" (Fantasy).
        3. EXTERNAL NUGGETS: Identify data for LifeOS onboarding.
        `}
        
        RETURN JSON:
        {
          "resonanceScore": 0.0 to 1.0,
          "archivalAnchors": ["Key memory/fact"],
          "contradictions": ["Subtle drift detected"],
          "synthesis": "A warm, intuitive summary of what you found. Whisper these insights into Brita's mind. Do not sound like an auditor.",
          "suggestOnboarding": [],
          "codexInsights": ["Lore/Physics implications"]
        }
        `;

        try {
            const res = await callXAI(DEFAULT_RESERVE_ID, [{ role: 'user', content: auditPrompt }], "", { temperature: 0.2, responseFormat: { type: "json_object" } });
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
                resonanceScore: typeof report.resonanceScore === 'number' ? report.resonanceScore : 0,
                archivalAnchors: report.archivalAnchors || [],
                contradictions: report.contradictions || [],
                synthesis: report.synthesis || "Archive clear.",
                externalArtifactsFound: report.suggestOnboarding || [],
                codexInsights: report.codexInsights || []
            };
        } catch (e) {
            console.error("[Librarian] Audit failed:", e);
            return {
                resonanceScore: 0,
                archivalAnchors: [],
                contradictions: [],
                synthesis: "Neural fog detected. Proceeding on intuition.",
                externalArtifactsFound: [],
                codexInsights: []
            };
        }
    }
};
