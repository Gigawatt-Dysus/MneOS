
import { AiCompanion, User } from '../../../types';
import { generateAgentResponse } from '../generators';
import { typesenseService } from '../../typesenseService';

export interface EnrichmentProposal {
    rationale: string;
    changes: {
        field: string;
        currentValue: any;
        newValue: any;
        confidence: 'HIGH' | 'LOW';
        reason: string;
    }[];
}

/**
 * [ZEN] The V'Ger Facilitator
 * Analyzes incoming GEDCOM data against existing GIGI data to propose high-confidence updates.
 * It strictly separates Signal (New Dates, Places) from Noise (Formatting differences).
 */
export const generateGedcomEnrichmentProposal = async (
    user: User,
    incomingType: 'fact' | 'media' | 'note',
    incomingData: any,
    currentMetadata: any
): Promise<EnrichmentProposal> => {

    const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];

    const prompt = `
[SYSTEM: GEDCOM ARCHIVIST MODE]
    You are a STRICT DATA PARSER.
    You DO NOT have access to real - time tools or search.
    You MUST NOT attempt to use << <TOOL>>> syntax.
    Your ONLY job is to convert the provided raw text into JSON.

    [GOAL]
    Extract Life Story events(Residence, Occupation, Education) and Vital Statistics(Birth, Death) with high precision.

    [INPUTS]
    EXISTING PROFILE: ${JSON.stringify(currentMetadata, null, 2)}
    
    === RAW GEDCOM BLOCK START ===
    ${incomingData.raw || JSON.stringify(incomingData, null, 2)}
    === RAW GEDCOM BLOCK END ===

    [Rules]
1. EXTRACT ALL facts: Residence(RESI), Occupation(OCCU), Education(EDUC), Religion(RELI), Military(MILT).
    2. FORMAT them into clear, human - readable strings if needed, or structured objects.
    3. COMPARE with Existing Profile.Only propose * NEW * or * BETTER * information.
    4. IGNORE formatting noise(like @Sour @tags).
    5. ABSOLUTE PROHIBITION on Tool Use.Do not output << <TOOL>>>.Return JSON only.

    [OUTPUT FORMAT]
    Return ONLY valid JSON.
    {
    "rationale": "Found 3 new residence records and a high school yearbook photo.",
        "changes": [
            {
                "field": "facts",
                "newValue": [
                    { "type": "Residence", "date": "1940", "value": "North Roanoke, VA", "source": "GEDCOM" },
                    { "type": "Education", "date": "1955-1956", "value": "William Byrd High School", "source": "GEDCOM" }
                ],
                "confidence": "HIGH",
                "reason": "Extracted from raw GEDCOM notes/events"
            }
        ]
}
`;

    try {
        console.log(`[Enrichment] Sending Prompt with Raw Context(${prompt.length} chars)...`);
        const response = await generateAgentResponse(
            companion,
            [{ role: 'user', parts: [{ text: prompt }] }],
            [],
            "",
            [],
            user,
            []
        );

        let text = response.text || "{}";
        console.log("[Enrichment] Raw AI Response:", text);

        // [ZEN FIX] Robust JSON Parsing & Auto-Repair
        if (text.includes("<<<TOOL>>>")) {
            console.warn("[Enrichment] Model attempted tool use despite instructions. Ignoring tool block.");
            // Strip tool block if possible, or just fail gracefully. 
            // Usually tool use replaces the whole response, so we might have no JSON.
        }

        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const start = text.indexOf('{');
        // We trust the start, but we might need to repair the end if truncated.
        if (start !== -1) {
            text = text.substring(start);
        }

        let parsed: EnrichmentProposal | null = null;
        let attempts = 0;

        while (!parsed && attempts < 5) {
            try {
                parsed = JSON.parse(text) as EnrichmentProposal;
            } catch (e) {
                // If it fails, strictly try appending closing braces.
                // This handles the common "}]" vs "}]}" truncation.
                text += "}";
                attempts++;
            }
        }

        if (!parsed) {
            throw new Error("Failed to parse JSON even after auto-repair.");
        }

        console.log("[Enrichment] Parsed Proposal:", parsed);

        // [ZEN V15] Programmatic RAG Cross-Check
        // We verify the "New" facts against the Global Knowledge Base (Typesense)
        // to prevent duplication that the LLM might have missed (due to context window or hallucination).
        if (parsed.changes) {
            for (const change of parsed.changes) {
                // We only cross-check 'facts' for now, as that's where duplication hurts most
                if (change.field === 'facts' && Array.isArray(change.newValue)) {
                    const enrichedValues = [];
                    for (const fact of change.newValue) {
                        // Check 1: Typesense Search (Global)
                        const hits = await typesenseService.searchTags(fact.value);

                        // Check 2: Exact Local Match (Safety Net)
                        // (Already done in Inspector, but good to have double coverage)

                        // Attach warnings if found
                        // We extend the fact object with a transient '_warning' property for the UI
                        if (hits.length > 0) {
                            // Filter out the current person themselves
                            const otherPeople = hits.filter((h: any) => h.id !== (currentMetadata as any).id);
                            if (otherPeople.length > 0) {
                                (fact as any)._warning = `Similar to info in: ${otherPeople.map((p: any) => p.name).join(', ')}`;
                            }
                        }
                        enrichedValues.push(fact);
                    }
                    change.newValue = enrichedValues;
                }
            }
        }

        return parsed;

    } catch (e) {
        console.error("Enrichment Parse Failed", e);
        return {
            rationale: "AI Analysis Failed. Please review manually.",
            changes: []
        };
    }
};
