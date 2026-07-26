import { callXAI } from '../providers';
import { PRIMARY_MODEL_ID } from '../config';
import type { Tag } from '../../../types';

export interface PersonMatchResult {
    discoveredName: string;
    action: 'merge' | 'provisional';
    matchedTagId?: string;
    confidence: number;
    reasoning?: string;
}

/**
 * [ZEN] Neural Person Matcher
 * Uses Grok 4.x to reconcile newly discovered archive names with the existing Matrix entities.
 */
export const matchDiscoveredPeople = async (
    discoveredNames: string[],
    existingTags: Tag[]
): Promise<PersonMatchResult[]> => {
    if (discoveredNames.length === 0) return [];

    // Filter to only Person tags for better focus
    const personTags = existingTags.filter(t => t.type === 'person' || t.id.startsWith('tag-person'));
    
    if (personTags.length === 0) {
        return discoveredNames.map(name => ({
            discoveredName: name,
            action: 'provisional',
            confidence: 1
        }));
    }

    const existingNamesList = personTags.map(t => `${t.name} (ID: ${t.id})`).join('\n');
    const discoveredNamesList = discoveredNames.join('\n');

    const systemPrompt = `You are the G.I.G.I. Neural Entity Linker.
Your task is to reconcile newly discovered names from a digital archive with an existing database of People.

MATCHING HEURISTICS:
1. EXACT MATCH: If a discovered name is an exact match (ignoring case/whitespace) to an existing name, you MUST suggest 'merge' with 1.0 confidence.
2. NICKNAMES: "James" <-> "Jim", "Robert" <-> "Bob", "William" <-> "Bill", "Margaret" <-> "Peggy", "Ann" <-> "Annie".
3. MIDDLE NAMES: "Ann Carter Cornett" and "Ann Cornett" are almost certainly the same person. If the first and last names match, and one has a middle name/initial, suggest 'merge' with 0.95+ confidence.
4. MAIDEN NAMES: If the first name and middle name match, but the last name is different, suggest 'provisional' and mention the potential match.

CRITICAL RULES:
- If you are 90%+ sure, use 'merge'.
- If it's a 50-89% possibility, use 'provisional' and provide the matchedTagId as a hint.
- Return ONLY a JSON array of objects with this structure:
[
  {
    "discoveredName": "string",
    "action": "merge" | "provisional",
    "matchedTagId": "string (optional)",
    "confidence": number (0-1),
    "reasoning": "brief explanation"
  }
]`;

    const userPrompt = `EXISTING PEOPLE:
${existingNamesList}

NEWLY DISCOVERED NAMES:
${discoveredNamesList}

Reconcile these lists. If a discovered name matches an existing person, provide the ID.`;

    try {
        const response = await callXAI(PRIMARY_MODEL_ID, [
            { role: 'user', content: userPrompt }
        ], systemPrompt, { temperature: 0.1 });

        const text = response.text || '';
        // Extract JSON from potential markdown blocks
        const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(text);
    } catch (error) {
        console.error("[PersonMatcher] AI Reconciliation failed:", error);
        // Fallback: Treat all as provisional
        return discoveredNames.map(name => ({
            discoveredName: name,
            action: 'provisional',
            confidence: 0
        }));
    }
};
