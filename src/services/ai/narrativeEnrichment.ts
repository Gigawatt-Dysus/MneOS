import { callXAI } from './providers';
import { ModelRegistryManager } from './modelRegistryManager';
import type { AddressData } from '../../types';

export interface EventPrediction {
    title: string;
    date: string; // ISO string
    location?: string;
    address?: AddressData;
    tags: string[]; // Tag names or IDs inferred
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
}

export class NarrativeEnrichmentService {
    // [ZEN] Model is now resolved dynamically via the Sovereign Model Gateway

    /**
     * Extracts structured event metadata from raw narrative text.
     */
    static async extractEventMetadata(text: string, userId: string, context?: { tags: any[] }): Promise<EventPrediction> {
        if (!text || text.trim().length < 5) {
            throw new Error("Text too short for enrichment");
        }

        const systemPrompt = `You are GIGI's Neural Extraction Engine. 
Your task is to analyze a raw "memory fragment" and extract structured metadata for a LifeOS Event.

[USER CONTEXT]:
- Known Tags: ${context?.tags?.map(t => t.name).join(', ') || 'None'}
- Current Date: ${new Date().toLocaleString()}

[EXTRACTION RULES]:
1. TITLE: Create a punchy, journalistic title (max 60 chars).
2. DATE: Inferred from context (e.g. "yesterday", "last Tuesday"). Output as ISO 8601 string.
3. LOCATION: Identify the specific place. If it's a known business, provide the name.
4. TAGS: Match entities to Known Tags or suggest new ones. Use names, not IDs.
5. SENTIMENT: Evaluate the emotional resonance.
6. CONFIDENCE: 0.0 to 1.0 based on how clear the data is.

[FORMAT]:
Output ONLY a JSON object:
{
  "title": "...",
  "date": "...",
  "location": "...",
  "tags": ["...", "..."],
  "sentiment": "positive|neutral|negative",
  "confidence": 0.85
}`;

        const messages = [{ role: 'user', content: text }];

        try {
            const modelId = ModelRegistryManager.resolve('enrichment');
            const response = await callXAI(modelId, messages, systemPrompt);
            const cleanText = response.text.replace(/```json|```/g, '').trim();
            const prediction = JSON.parse(cleanText);

            // Basic validation
            if (!prediction.title) prediction.title = text.split('\n')[0].substring(0, 50);
            if (!prediction.date) prediction.date = new Date().toISOString();
            
            return prediction;
        } catch (err) {
            console.error('[NarrativeEnrichment] Extraction failed:', err);
            return {
                title: text.split('\n')[0].substring(0, 50),
                date: new Date().toISOString(),
                tags: [],
                sentiment: 'neutral',
                confidence: 0.1
            };
        }
    }
}
