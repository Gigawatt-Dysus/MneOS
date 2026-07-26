
import { AiCompanion, User } from '../../../types';
import { generateAgentResponse } from '../generators';

export interface LibrarianReport {
    narrative: string;
    cleanEvents: {
        id: string; // Original or generated ID
        type: string; // Human readable (e.g. "Birth", "Census", "Occupation")
        date: string;
        place: string;
        description: string;
        originalRef: any; // Keep ref to original event for "Enrich" actions
    }[];
}

/**
 * [ZEN] The Librarian
 * Converts raw, messy GEDCOM blocks into beautiful, coherent human stories.
 * This is the "Reading" layer, separate from the "Writing/Enriching" layer.
 */
export const generateGedcomLibrarianReport = async (
    user: User,
    candidateName: string,
    rawGedcom: any // The raw candidate object from GedcomReader
): Promise<LibrarianReport> => {

    const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
    const aiName = companion?.name || "Gigi";

    // Flatten raw object to string for prompt
    const rawString = JSON.stringify(rawGedcom, null, 2);

    const prompt = `
[SYSTEM: MASTER GENEALOGIST LIBRARIAN]
You are ${aiName}, an expert archivist and storyteller.
Your task is to READ this raw, messy GEDCOM data record for "${candidateName}" and TRANSLATE it into a clean, human-readable report.

[INPUT DATA]
${rawString}

[INSTRUCTIONS]
1. NARRATIVE BIO: Write a beautiful, 1-2 paragraph biography summarizing their life based ONLY on the evidence provided. 
   - Weave dates and places into a story. 
   - "Born in 1890 in London, John was a carpenter who..."
   - If data is sparse, say so nicely. "Records are scarce for John, but we know..."

2. CLEAN TIMELINE: create a normalized list of events.
   - Fix ALL caps (BIRT -> Birth).
   - Expand abbreviations.
   - Merge related notes into the description.
   - IGNORE technical garbage (UIDs, Chan dates, pure Source/Repo links).

[OUTPUT FORMAT]
Return ONLY valid JSON:
{
    "narrative": "John Doe was born in...",
    "cleanEvents": [
        {
            "type": "Birth",
            "date": "10 Jan 1980",
            "place": "London, UK",
            "description": "Born to Jane and Bob. Note: Twin."
        }
    ]
}
`;

    try {
        console.log(`[Librarian] Generating Report for ${candidateName}...`);
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

        // Sanitize JSON
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const start = text.indexOf('{');
        if (start !== -1) {
            text = text.substring(start);
        }

        const parsed = JSON.parse(text);

        // Map back to format (we need to re-attach original refs manually in the UI or by index if stable, 
        // but here we just return the clean view. The UI will have to do a fuzzy map or we pass IDs?
        // Actually, the UI iterates the *Original* list to apply actions. 
        // We want this report to *replace* the list?
        // If we replace the list, we lose the "Enrich" button's connection to the specific raw event object.
        // STRATEGY: 
        // The UI will use this "cleanEvents" list for DISPLAY.
        // The "Enrich" button on a clean event needs to know which raw event it corresponds to.
        // We should ask the AI to include the 'index' or 'id' if possible, OR
        // We treat the AI's output as the "Source of Truth" and when the user clicks "Enrich", 
        // we send the *AI's cleaned version* to the merger, which is actually BETTER than the raw one.
        // Yes! Let's send the CLEAN event to the enrichment engine. 

        return {
            narrative: parsed.narrative || "No narrative generated.",
            cleanEvents: parsed.cleanEvents || []
        };

    } catch (e) {
        console.error("Librarian Report Failed", e);
        return {
            narrative: "Could not generate report. Showing raw data.",
            cleanEvents: []
        };
    }
};
