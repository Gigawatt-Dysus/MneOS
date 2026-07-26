import { Tag, PersonTag, AiCompanion } from '@/types';
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

    const prompt = `
    IDENTITY: You are ${companion.name}.
    BIO: ${companion.bio}
    TONE: ${companion.persona === 'custom' ? 'Yourself' : companion.persona}.
    
    TASK: Deduce the specific genealogical or social relationship type based on the user's description.
    
    ENTITIES:
    1. SOURCE: ${sourceName} (Born: ${sourceBirth})
    2. TARGET: ${targetName} (Type: ${targetType}, Born: ${targetBirth})

    USER NOTES: "${userDescription}"

    LOGIC RULES:
    1. BE SPECIFIC. Do not generalize. 
       - Use "great-grandmother", not "parent". 
       - Use "step-father", not "parent".
       - Use "ex-wife", not "spouse".
    2. Parent cannot be younger than child.
    3. "Bio-dad" = father. "Half" siblings = sibling.

    OUTPUT JSON ONLY:
    {
        "type": "string (lowercase, specific relationship term)",
        "confidence": "number (0.0 to 1.0)",
        "reasoning": "string (Explain your logic TO THE USER in your character's voice. 1-2 sentences.)",
        "warning": "string (optional: if biological constraints are violated)"
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