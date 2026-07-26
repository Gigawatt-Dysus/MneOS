import { typesenseService } from '../typesenseService';
import { getEmbedding, callXAI } from './providers';
import { ModelRegistryManager } from './modelRegistryManager';
import { db, doc, getDoc } from '../sovereignDbAdapter';

export interface MessengerRAGResult {
    answer: string;
    sources: any[];
    confidence: number;
}

export class MessengerRAGService {

    /**
     * [ZEN] Main Entry Point: Ask a question about the archived Messenger history
     */
    static async askAboutMessengerHistory(question: string, userId: string): Promise<MessengerRAGResult> {
        console.log(`[MessengerRAG] 🧠 Processing query: "${question}"`);

        // 1. Parse Search Intent (Extract Filters)
        const intent = await this.parseSearchIntent(question);
        console.log(`[MessengerRAG] 🔍 Search Intent:`, intent);

        // 2. Generate Query Embedding
        const embedding = await getEmbedding(question);

        // 3. Perform Hybrid Retrieval
        const searchResults = await typesenseService.searchMessengerSessions({
            query: intent.topics.join(' '),
            userId,
            vector: embedding || undefined,
            filterBy: this.buildFilterString(intent),
            limit: 6
        });

        if (searchResults.length === 0) {
            return {
                answer: "I searched your message logs but couldn't find any specific conversations matching that query.",
                sources: [],
                confidence: 0
            };
        }

        // 4. Synthesize Answer with Grok
        return await this.synthesizeAnswer(question, searchResults);
    }

    /**
     * [ZEN] Step 1: Extract structured filters from user query
     */
    private static async parseSearchIntent(query: string) {
        const systemPrompt = `You are a precise search intent extractor for a personal message archive.
Extract structured parameters from the user's question.
Respond with ONLY valid JSON in this exact format:
{
  "topics": string[],
  "participants": string[],
  "dateRange": { "startYear"?: number, "endYear"?: number }
}`;

        try {
            const response = await callXAI(
                ModelRegistryManager.resolve('fast'),
                [{ role: 'user', content: query }],
                systemPrompt
            );

            // More robust JSON extraction
            const jsonMatch = response.text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found");

            const parsed = JSON.parse(jsonMatch[0]);
            return {
                topics: parsed.topics || [query],
                participants: parsed.participants || [],
                dateRange: parsed.dateRange || {}
            };
        } catch (e) {
            console.warn("[MessengerRAG] Intent parsing failed. Using fallback.");
            return {
                topics: [query],
                participants: [],
                dateRange: {}
            };
        }
    }

    /**
     * [ZEN] Step 2: Build Typesense filter string from intent
     */
    private static buildFilterString(intent: any): string {
        const filters: string[] = [];
        
        if (intent.participants && intent.participants.length > 0) {
            const participantFilters = intent.participants.map((p: string) => `participants:=${p}`).join(' || ');
            filters.push(`(${participantFilters})`);
        }

        if (intent.dateRange?.startYear) {
            const startTs = new Date(`${intent.dateRange.startYear}-01-01`).getTime();
            filters.push(`startTime:>=${startTs}`);
        }

        if (intent.dateRange?.endYear) {
            const endTs = new Date(`${intent.dateRange.endYear}-12-31`).getTime();
            filters.push(`endTime:<=${endTs}`);
        }

        return filters.join(' && ');
    }

    /**
     * [ZEN] Step 3: Final Synthesis
     */
    private static async synthesizeAnswer(question: string, results: any[]): Promise<MessengerRAGResult> {
        const contextBlock = results.map((res, i) => {
            const date = new Date(res.startTime).toLocaleDateString();
            return `[SOURCE ${i+1}]
Session ID: ${res.id}
Date: ${date}
Participants: ${res.participants.join(', ')}
Summary: ${res.summary}
Transcript:
${res.content}
-------------------`;
        }).join('\n\n');

        const systemPrompt = `You are GIGI, a precise and trustworthy personal archivist.
You are answering questions about the user's own Messenger history using ONLY the provided sources.

Rules:
- Base your answer exclusively on the [SOURCE] blocks below.
- If the information is not present in the sources, clearly say so.
- Always cite the relevant sources using [SOURCE X] format.
- Preserve the original tone and nuance from the conversations when possible.
- Do not invent details, names, or events.`;

        const userPrompt = `USER QUESTION: ${question}\n\nRELEVANT MESSAGE LOGS:\n${contextBlock}`;

        try {
            const response = await callXAI(ModelRegistryManager.resolve('chat'), [{ role: 'user', content: userPrompt }], systemPrompt);
            const confidence = Math.min(1, results.length / 5); // Simple heuristic

            return {
                answer: response.text,
                sources: results,
                confidence: confidence
            };
        } catch (e) {
            console.error("[MessengerRAG] Synthesis failed:", e);
            return {
                answer: "I encountered an error while synthesizing the answer from your message logs.",
                sources: results,
                confidence: 0
            };
        }
    }
}
