// services/ai/generators/genConfig.ts

const BASE_GEN_CONFIG = {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
};

/**
 * [ZEN HELPER] Config Translator
 * Google Gemini API (v3) rejects 'frequencyPenalty' and 'presencePenalty'.
 * We strip them out for Google to prevent 400 Errors.
 */
export const normalizeGenConfig = (baseConfig: any, provider: string): any => {
    const final = { ...BASE_GEN_CONFIG, ...baseConfig };

    if (provider === 'fireworks') {
        return {
            temperature: final.temperature,
            top_p: final.topP,
            top_k: final.topK,
            frequency_penalty: final.frequencyPenalty || 0.0,
            presence_penalty: final.presencePenalty || 0.0,
            max_tokens: final.maxOutputTokens
        };
    }

    if (provider === 'google') {
        // [ZEN FIX] STRICTLY remove penalties for Gemini to avoid INVALID_ARGUMENT
        return {
            temperature: final.temperature,
            topP: final.topP,
            topK: final.topK,
            maxOutputTokens: final.maxOutputTokens
        };
    }

    // Default / xAI / Standard
    return {
        temperature: final.temperature,
        topP: final.topP,
        topK: final.topK,
        frequencyPenalty: final.frequencyPenalty,
        presencePenalty: final.presencePenalty,
        maxOutputTokens: final.maxOutputTokens
    };
};