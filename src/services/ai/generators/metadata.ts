
import { callFireworks } from '../providers';
import { SecretsManager } from '../../../utils/SecretsManager';

// [ZEN V14] Metadata Generator for Interop
export const generateEventMetadata = async (title: string, details: string) => {

    const systemPrompt = `
    You are an Archivist AI. analyze the following historical event.
    
    TASKS:
    1. SUMMARY: Generate a concise 1-sentence summary (max 20 words).
    2. KEYWORDS: Extract 5-10 specific keywords (Entities, Locations, Emotions, Themes).
    
    FORMAT:
    Return a STRICT JSON object:
    {
      "summary": "string",
      "keywords": ["string", "string"]
    }
    `;

    const userContent = `EVENT TITLE: ${title}\nDETAILS: ${details}`;

    const messages = [
        { role: 'user', parts: [{ text: userContent }] }
    ];

    const model = "accounts/fireworks/models/llama-v3p3-70b-instruct";
    const apiKey = SecretsManager.get('fireworks') || localStorage.getItem('fireworks_key_cache') || "";

    try {
        if (!apiKey) throw new Error("API Key Missing");

        const response = await callFireworks(model, messages, systemPrompt, apiKey, {
            temperature: 0.3,
            maxOutputTokens: 500
        } as any);

        // Simple Regex extraction if JSON fails, or assume strict JSON
        try {
            return JSON.parse(response.text || "{}");
        } catch (e) {
            console.warn("Metadata JSON Parse Failed, returning raw", response.text);
            return { summary: "", keywords: [] };
        }

    } catch (error) {
        console.error("Metadata Generation Failed", error);
        return { summary: "", keywords: [] };
    }
};
