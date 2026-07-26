import { SecretsManager } from '../../utils/SecretsManager';
import { getSovereignModelId, getXAIKey } from './config';
import { callXAI } from './providers';
import type { PersonTag, Tag } from '../../types/tags';

const PLACEHOLDER_DESCRIPTIONS = new Set([
    "Created from Matrix",
    "Created from Matrix Studio",
    "Digital Shadow",
    "No description",
    "No description provided.",
    ""
]);

export const shouldGenerateDescription = (currentDescription?: string): boolean => {
    if (!currentDescription) return true;
    const clean = currentDescription.trim();
    return PLACEHOLDER_DESCRIPTIONS.has(clean);
};

/**
 * [VANTABLACK] Persona Description Generator
 * Powered by Grok 4.x - Strictly Non-Google
 */
export const generatePersonDescription = async (focalPerson: PersonTag, allTags: Tag[]): Promise<string | null> => {
    try {
        const apiKey = getXAIKey();
        if (!apiKey) {
            console.warn("[DescriptionGenerator] xAI API Key missing.");
            return null;
        }

        // 1. Context Assembly
        const birthYear = focalPerson.metadata.dates?.birth
            ? new Date(focalPerson.metadata.dates.birth).getFullYear()
            : 'Unknown';

        const deathDate = focalPerson.metadata.dates?.death;
        const isDeceased = !!deathDate || focalPerson.metadata.isDeceased;
        const deathYear = deathDate ? new Date(deathDate).getFullYear() : (isDeceased ? 'Deceased (Date Unknown)' : null);

        let location = "Unknown Location";
        if (focalPerson.metadata.address?.addressLocality && focalPerson.metadata.address?.addressRegion) {
            location = `${focalPerson.metadata.address.addressLocality}, ${focalPerson.metadata.address.addressRegion}`;
        }

        const rels = focalPerson.metadata.relationships || [];
        const surviving: string[] = [];
        const preDeceased: string[] = [];
        const otherRelations: string[] = [];

        rels.forEach(r => {
            const relative = allTags.find(t => t.id === r.relatedPersonId) as PersonTag;
            if (!relative) return;

            const relStr = `${relative.name} (${r.type})`;
            if (relative.metadata?.dates?.death || relative.metadata?.isDeceased) {
                preDeceased.push(relStr);
            } else {
                surviving.push(relStr);
            }
            otherRelations.push(relStr);
        });

        const interests = (focalPerson.tagIds || []).map(id => {
            const t = allTags.find(tag => tag.id === id);
            return t ? t.name : null;
        }).filter(Boolean);

        const context = `
        SUBJECT: ${focalPerson.name} (${isDeceased ? 'DECEASED' : 'LIVING'})
        USER PERSPECTIVE: Eric's Private Archive
        GENDER: ${focalPerson.metadata.gender || 'Unknown'}
        BORN: ${birthYear}
        DIED: ${deathYear || 'N/A'}
        LOCATION: ${location}
        
        FAMILY_LIVING (Survived By): ${surviving.join(', ') || "None known"}
        FAMILY_DECEASED: ${preDeceased.join(', ') || "None known"}
        ALL_RELATIONS: ${otherRelations.join(', ')}
        
        INTERESTS/TAGS: ${interests.join(', ') || "None recorded"}
        `;

        const prompt = `
        TASK: Write a rich, human "Profile Headline" for this person in MY (Eric's) personal journal.
        CONTEXT: ${context}
        
        RULES:
        1. **PERSPECTIVE**: Write as ME (Eric). Say "My mother", "My friend", "My cousin". NEVER refer to "Eric" in the third person.
        2. **TONE**:
           - IF DECEASED: Respectful, personal. "My mother, born in [Year], who died in [Year]. She is survived by [list 2-3 key living relatives]."
           - IF LIVING: Casual, bio-style. "My friend Jim, living in [Location]. He enjoys [Interest 1, Interest 2]."
        3. **LENGTH**: 1-2 sentences. Maximum 40 words.
        4. **VERACITY**: Do NOT hallucinate names. Only use provided lists.
        `;

        const modelId = getSovereignModelId();
        
        // Use the primary callXAI dispatcher
        const result = await callXAI(modelId, [{ role: 'user', parts: [{ text: prompt }] }], "You are Eric's expert digital archivist.");

        if (result.text) {
            console.log(`[DescriptionGenerator] Generated via Grok: "${result.text.trim()}"`);
            return result.text.trim();
        }
        return null;

    } catch (e) {
        console.error("[DescriptionGenerator] xAI Generation Failed:", e);
        return null;
    }
};
