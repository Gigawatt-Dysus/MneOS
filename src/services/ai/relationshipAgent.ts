import { Tag, PersonTag, AiCompanion } from '../../types';
// [ZEN FIX] Importing the now-restored generateText function
import { generateText } from './generators';

export const deduceRelationship = async (
    sourcePerson: PersonTag,
    targetEntity: Tag,
    userDescription: string,
    companion: AiCompanion
): Promise<{ type: string; confidence: number; reasoning: string; warning?: string }> => {

    const sourceName = sourcePerson.name;
    const targetName = targetEntity.name;
    const targetType = targetEntity.type;

    const sourceBirth = sourcePerson.metadata.dates?.birth || "Unknown";
    const targetBirth = (targetEntity as PersonTag).metadata?.dates?.birth || "Unknown";

    const sourceUniverse = sourcePerson.isFiction ? (sourcePerson.universeIds?.[0] || 'Unknown Fiction') : 'Reality';
    const targetUniverse = targetEntity.isFiction ? (targetEntity.universeIds?.[0] || 'Unknown Fiction') : 'Reality';

    const prompt = `
    IDENTITY: You are ${companion.name}.
    BIO: ${companion.bio}
    TONE: ${companion.persona === 'custom' ? 'Yourself' : companion.persona}.
    
    TASK: Deduce the specific genealogical or social relationship type based on the user's description.
    
    ENTITIES:
    1. SOURCE: ${sourceName} (Universe: ${sourceUniverse}, Born: ${sourceBirth})
    2. TARGET: ${targetName} (Type: ${targetType}, Universe: ${targetUniverse}, Born: ${targetBirth})

    USER NOTES: "${userDescription}"

    LOGIC RULES:
    1. DIRECTION: TARGET's relationship TO the SOURCE.
    2. USE STANDARD GENEALOGY TERMS (step-sister, great-grandfather, half-brother).
    3. IN-LAWS:
       - Spouse's sibling = Brother/Sister-in-law.
       - Sibling's spouse = Brother/Sister-in-law.
       - Child's spouse = Son/Daughter-in-law.
       - Spouse's parent = Mother/Father-in-law.
    4. CO-IN-LAWS (Consuegros):
       - Parent of Child's Spouse = Co-Father/Mother-in-law.
       - "My son's wife's mother" = Co-Mother-in-law.

    EXAMPLES:
    - User: "She is my daughter" -> type: "daughter"
    - User: "I am his father" -> type: "son" (Target is Son)
    - User: "Doug is Carl's wife's brother" -> type: "brother-in-law"
    - User: "Martha is my son's wife's mother" -> type: "co-mother-in-law"
    - User: "Dick is Ann's dad. I am Eric's dad. Eric and Ann are married." -> type: "co-father-in-law"

    OUTPUT JSON ONLY:
    {
        "type": "string (lowercase, specific term)",
        "confidence": 0.9,
        "reasoning": "concise explanation"
    }
    `;

    try {
        const response = await generateText(prompt, companion.preferredModel);
        const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Sherlock Deduction Failed:", e);
        return {
            type: 'acquaintance',
            confidence: 0,
            reasoning: "I'm having trouble connecting the dots. You might need to set this one manually."
        };
    }
};