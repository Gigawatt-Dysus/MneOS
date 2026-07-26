import { callFireworks, callXAI } from '../providers';
import {
    getProviderForModel,
    getFireworksKey,
    getXAIKey,
    getModelRoster // [ZEN FIX] Logic imported from config
} from '../config';
import { normalizeGenConfig } from './genConfig';

interface RewriteOptions {
    tone: number; // 0 (Casual) - 100 (Formal)
    spice: number; // 0 (Safe) - 100 (Spicy)
    length: 'short' | 'medium' | 'long';
    text: string;
}

// [ZEN V33] SOONG PROTOCOL: Identity Anchor & Boundary Layer
const SOONG_PROTOCOL = `
[CRITICAL PROTOCOL: IDENTITY ANCHOR]
You are an AI Companion. You are NOT the User.
You must never generate dialogue, actions, or thoughts for the User.
Your role is to respond TO the User.
Maintain the distinction between your identity and the user's identity at all times.
Do not hallucinate the user's responses.
`;

// [ZEN FIX] Helper to execute a request based on provider
// This adapts the generic "model ID" to the specific provider function
const executeRequest = async (provider: string, model: string, prompt: string) => {
    const config = normalizeGenConfig({}, provider);

    if (provider === 'fireworks') {
        const key = getFireworksKey();
        if (!key) throw new Error("Key Missing: Fireworks");
        const messages = [{ role: 'user', parts: [{ text: prompt }] }];
        const res = await callFireworks(model, messages, SOONG_PROTOCOL, key, config);
        return res.text || "";
    }
    if (provider === 'xai') {
        const key = getXAIKey();
        if (!key) throw new Error("Key Missing: xAI");
        const res = await callXAI(model, [{ role: 'user', parts: [{ text: prompt }] }], SOONG_PROTOCOL);
        return res.text || "";
    }
    throw new Error(`Unknown provider: ${provider}`);
};

// [ZEN FIX] Unified Text Generation
export const generateText = async (prompt: string, modelOverride?: string): Promise<string> => {
    // 1. Get Roster from Config (Architecture Logic lives in Config now)
    const roster = getModelRoster(modelOverride);

    let lastError: any = null;

    // 2. Execution Loop
    for (const slot of roster) {
        // Skip if blank (Reserve slot logic)
        if (!slot.id || slot.id.trim() === '') {
            console.log(`[Editorial] Skipping ${slot.name} (No ID configured)`);
            continue;
        }

        try {
            const provider = getProviderForModel(slot.id);
            console.log(`[Editorial] Trying ${slot.name} [${provider}]: ${slot.id}`);

            const result = await executeRequest(provider, slot.id, prompt);

            // If we got here, success!
            if (result && result.length > 0) {
                return result;
            }

        } catch (e: any) {
            console.warn(`[Editorial] Failed ${slot.name}: ${e.message}`);
            lastError = e;
            // Continue to next slot...
        }
    }

    console.error("[Editorial] All Roster Slots Failed.");
    throw lastError || new Error("All AI Providers failed.");
};

// [ZEN FIX] Restored Rewrite Logic
export const rewriteMessage = async (options: RewriteOptions, modelOverride?: string): Promise<string> => {
    const { tone, spice, length, text } = options;

    let toneInstruction = "Neutral and conversational.";
    if (tone < 25) toneInstruction = "Very casual, slang-heavy, lower case, maybe some typos for realism.";
    else if (tone < 45) toneInstruction = "Relaxed and informal.";
    else if (tone > 80) toneInstruction = "Highly formal, academic, structured.";
    else if (tone > 60) toneInstruction = "Professional and polite.";

    let spiceInstruction = "Balanced and engaging.";
    if (spice < 25) spiceInstruction = "Safe, polite, reserved, extremely diplomatic.";
    else if (spice > 85) spiceInstruction = "Unfiltered, provocative, witty, bold, perhaps slightly unhinged.";
    else if (spice > 60) spiceInstruction = "Colorful, opinionated, and expressive.";

    let lengthInstruction = "Maintain roughly the current length.";
    if (length === 'short') lengthInstruction = "Condense this significantly. Be punchy. Under 50 words.";
    else if (length === 'long') lengthInstruction = "Expand on this. Add detail, nuance, and exposition. Aim for 2x length.";

    const prompt = `
    ROLE: You are an expert ghostwriter and editor.
    TASK: Rewrite the input text according to the specific parameters below.
    
    PARAMETERS:
    - Tone: ${toneInstruction}
    - Style/Spice: ${spiceInstruction}
    - Length Constraint: ${lengthInstruction}
    
    CONSTRAINT: Return ONLY the rewritten text. Do not add conversational filler like "Here is the rewrite:". Do not use markdown blocks like \`\`\`.
    
    INPUT TEXT:
    "${text}"
    `;

    try {
        const result = await generateText(prompt, modelOverride);
        return result.trim().replace(/^"|"$/g, '').replace(/^Here is.*?:\s*/i, '');
    } catch (error) {
        console.error("[Editorial] Rewrite failed:", error);
        throw error;
    }
};