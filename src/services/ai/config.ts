// services/ai/config.ts
import { SecretsManager } from '../../utils/SecretsManager';

// ============================================================================
// MODEL CONFIGURATION — GROK SUPREMACY
// ============================================================================

export const PRIMARY_MODEL_ID = 'grok-4.3';                    // Flagship
export const MULTI_AGENT_MODEL_ID = 'grok-4.20-multi-agent-0309';   // Elite long-context reserve
export const REASONING_MODEL_ID = 'grok-4.20-0309-reasoning';  // Heavy logic
export const FAST_MODEL_ID = 'grok-4.20-0309-non-reasoning';    // Creative / quick turns

export const DEFAULT_MODEL_ID = PRIMARY_MODEL_ID;
export const FALLBACK_MODEL_ID = FAST_MODEL_ID;
export const DEFAULT_RESERVE_ID = FAST_MODEL_ID;
export const GIGI_MODEL_ID = 'openai/gpt-4o-mini'; // [ZEN] The Crisis Steward

export const getReserveModelId = (): string => {
    return FAST_MODEL_ID;
};

export const getXAIModelId = (): string => {
    return PRIMARY_MODEL_ID;
};

export const getReasoningModelId = (): string => {
    return REASONING_MODEL_ID;
};

export const getFastModelId = (): string => {
    return FAST_MODEL_ID;
};

/**
 * [VANTABLACK] Sovereign Model Resolver
 * All requests are routed through the Grok Reasoning Engine.
 */
export const getSovereignModelId = (): string => {
    return REASONING_MODEL_ID;
};

// Legacy / Poisoned Model Detection
const isPoisonedModel = (id: string | null | undefined): boolean => {
    if (!id) return false;
    return /(gemini|google|vertex|claude)/gi.test(id);
};

export const getPrimaryModelId = (): string => {
    let id = SecretsManager.get('model_primary');
    if (!id || isPoisonedModel(id)) {
        if (id) console.warn(`[Exorcist] ☣️ Migrating poisoned primary: ${id} → ${PRIMARY_MODEL_ID}`);
        SecretsManager.set('model_primary', PRIMARY_MODEL_ID);
        return PRIMARY_MODEL_ID;
    }
    return id;
};

export const getProviderForModel = (modelId: string): 'xai' | 'fireworks' | 'ollama' => {
    if (!modelId) return 'ollama';
    if (modelId.startsWith('grok')) return 'xai';
    if (modelId.includes('fireworks') || modelId.includes('dobby') || modelId.includes('llama')) {
        return 'fireworks';
    }
    return 'ollama';
};

// ============================================================================
// MODEL ROSTER (Ordered by Preference)
// ============================================================================

export const getModelRoster = (modelOverride?: string): Array<{ name: string; id: string }> => {
    const primary = modelOverride || getPrimaryModelId();

    return [
        { name: '1. Primary (Grok 4.3 Flagship)', id: primary },
        { name: '2. Elite Reserve (Multi-Agent)', id: MULTI_AGENT_MODEL_ID },
        { name: '3. Reasoning Engine', id: REASONING_MODEL_ID },
        { name: '4. Fast Creative', id: FAST_MODEL_ID },
    ];
};

export const AVAILABLE_MODELS = [
    { name: 'Grok 4.3 (Flagship)', id: 'grok-4.3', provider: 'xai' },
    { name: 'Grok 4.20 Multi-Agent', id: 'grok-4.20-multi-agent-0309', provider: 'xai' },
    { name: 'Grok 4.20 Reasoning', id: 'grok-4.20-0309-reasoning', provider: 'xai' },
    { name: 'Grok 4.20 Fast (Non-Reasoning)', id: 'grok-4.20-0309-non-reasoning', provider: 'xai' },
    { name: 'GIGI (Crisis Steward)', id: 'openai/gpt-4o-mini', provider: 'openai' },
];

// ============================================================================
// API KEYS
// ============================================================================

export const getXAIKey = () => SecretsManager.get('xai');
export const getFireworksKey = () => SecretsManager.get('fireworks');
export const getVoyageKey = () => SecretsManager.get('voyage');
export const getOpenRouterKey = () => SecretsManager.get('openrouter');
export const getDeepSeekKey = () => SecretsManager.get('deepseek');

export const getAzureVisionKey = () => SecretsManager.get('azure_vision_key');
export const getAzureVisionEndpoint = () => SecretsManager.get('azure_vision_endpoint');
export const getAzureFaceKey = () => SecretsManager.get('azure_face_key');
export const getAzureFaceEndpoint = () => SecretsManager.get('azure_face_endpoint');

// ============================================================================
// IDENTITY MANAGEMENT
// ============================================================================

export interface AIIdentity {
    id: string;
    name: string;
    role: string;
    systemInstruction: string;
    model: string;
    avatarUrl: string;
    isPrimary: boolean;
    preferredModel: string;
    bubbleBackgroundColor: string;
    bubbleTextColor: string;
}

export const AI_IDENTITY_DEFAULT: AIIdentity = {
    id: 'brita-core',
    name: 'Brita',
    role: 'AI Companion',
    systemInstruction: '', // Populated from persona markdown files
    model: PRIMARY_MODEL_ID,
    avatarUrl: '/avatars/brita-default.png',
    isPrimary: true,
    preferredModel: PRIMARY_MODEL_ID,
    bubbleBackgroundColor: '#2f3136',
    bubbleTextColor: '#ffffff'
};

export const getAIIdentity = (): AIIdentity => {
    try {
        const stored = localStorage.getItem('gigi_identity_cache');
        if (stored) return { ...AI_IDENTITY_DEFAULT, ...JSON.parse(stored) };
    } catch (e) {
        console.warn("[Config] Failed to load identity cache.", e);
    }
    return AI_IDENTITY_DEFAULT;
};

export const saveAIIdentity = (updates: Partial<AIIdentity>): AIIdentity => {
    try {
        const current = getAIIdentity();
        const updated = { ...current, ...updates };
        localStorage.setItem('gigi_identity_cache', JSON.stringify(updated));
        window.dispatchEvent(new Event('gigi-identity-updated'));
        return updated;
    } catch (e) {
        console.error("[Config] Failed to save identity", e);
        return getAIIdentity();
    }
};