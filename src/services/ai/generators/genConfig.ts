// services/ai/generators/genConfig.ts

const BASE_GEN_CONFIG = {
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 2048,
};

/**
 * [ZEN HELPER] Config Translator
 * Normalizes parameters for different AI providers (xAI, Fireworks).
 */
export const normalizeGenConfig = (baseConfig: any, provider: string): any => {
    const final = { ...BASE_GEN_CONFIG, ...baseConfig };

    if (provider === 'fireworks') {
        const fwDefaults = {
            temperature: 0.9,   // [ZEN TUNING] High Entropy
            repetition: 1.18,   // Golden Ratio (Unchanged)
            frequency: 0.7,     // [ZEN TUNING] Strict Anti-Loop
            presence: 0.6,      // [ZEN TUNING] Forced Novelty
            minP: 0.05          // Noise Trimmer (Unchanged)
        };

        // Check for User overrides (in baseConfig), otherwise use Dobby Defaults
        // We generally ignore BASE_GEN_CONFIG for these specifics to ensure the Tuning takes effect
        return {
            temperature: baseConfig.temperature ?? fwDefaults.temperature,
            topP: baseConfig.topP ?? 1.0, // Disable TopP in favor of MinP (usually)
            topK: final.topK,
            frequencyPenalty: baseConfig.frequencyPenalty ?? fwDefaults.frequency,
            presencePenalty: baseConfig.presencePenalty ?? fwDefaults.presence,
            repetitionPenalty: baseConfig.repetitionPenalty ?? fwDefaults.repetition,
            minP: baseConfig.minP ?? fwDefaults.minP,
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