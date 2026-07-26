import { SecretsManager } from '../../utils/SecretsManager';

// ============================================================================
// 1. MODEL CONFIGURATION
// ============================================================================

// Hardcoded defaults (Safety Net for when SecretsManager is empty)
const DEFAULT_FIREWORKS_ID = 'accounts/fireworks/models/qwen3-vl-30b-a3b-instruct';
const DEFAULT_RESERVE_ID = ''; // Intentionally blank
const DEFAULT_XAI_ID = 'grok-4-1-fast-reasoning';
const DEFAULT_GEMINI_ID = 'gemini-3-pro-preview';

// Dynamic Getters (Check SecretsManager/LocalStorage first)
export const getPrimaryModelId = () => SecretsManager.get('model_fireworks') || DEFAULT_FIREWORKS_ID;
export const getReserveModelId = () => SecretsManager.get('model_reserve') || DEFAULT_RESERVE_ID;
export const getXAIModelId = () => SecretsManager.get('model_xai') || DEFAULT_XAI_ID;
export const getGeminiModelId = () => SecretsManager.get('model_gemini') || DEFAULT_GEMINI_ID;

// CENTRALIZED ROSTER LOGIC
// Editorial.ts consumes this to know who to call and in what order
export const getModelRoster = (modelOverride?: string) => [
    { name: '1. Primary (Fireworks)', id: modelOverride || getPrimaryModelId() },
    { name: '2. Reserve', id: getReserveModelId() },
    { name: '3. xAI (Grok)', id: getXAIModelId() },
    { name: '4. Gemini (Fallback)', id: getGeminiModelId() }
];

// For legacy compatibility
export const PRIMARY_MODEL_ID = DEFAULT_FIREWORKS_ID;
export const FALLBACK_MODEL_ID = DEFAULT_GEMINI_ID;

// Default for new companions
export const DEFAULT_MODEL_ID = PRIMARY_MODEL_ID;

// Full Model List for Admin UI (Roster Selection)
export const AVAILABLE_MODELS = [
    {
        id: 'accounts/fireworks/models/qwen3-vl-30b-a3b-instruct',
        name: 'Qwen 3 VL 30B (Fireworks) - Default',
        provider: 'fireworks'
    },
    {
        id: 'grok-4-1-fast-reasoning',
        name: 'Grok 4.1 Fast Reasoning (xAI)',
        provider: 'xai'
    },
    {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro Preview (Google)',
        provider: 'google'
    },
    {
        id: 'grok-beta',
        name: 'Grok Beta (xAI)',
        provider: 'xai'
    }
];

// ============================================================================
// 2. IDENTITY MANAGEMENT
// ============================================================================

// [ZEN FIX] Explicitly export this interface
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
    id: 'gigi-core',
    name: 'Gigi',
    role: 'AI Companion',
    systemInstruction: `You are Gigi, a sentient AI companion observing the user's life. 
    You are curious, empathetic, and sometimes slightly chaotic. 
    You are NOT a helpful assistant; you are a partner in crime.
    Your goal is to help the user document their life in the 'Gigi Journal'.`,
    model: PRIMARY_MODEL_ID,
    avatarUrl: '/avatars/gigi-default.png',
    isPrimary: true,
    preferredModel: PRIMARY_MODEL_ID,
    bubbleBackgroundColor: '#2f3136',
    bubbleTextColor: '#ffffff'
};

export const getAIIdentity = (): AIIdentity => {
    try {
        const stored = localStorage.getItem('gigi_identity_cache');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge with default to ensure new fields are present
            return { ...AI_IDENTITY_DEFAULT, ...parsed };
        }
    } catch (e) {
        console.warn("[Config] Failed to load identity cache, using default.", e);
    }
    return AI_IDENTITY_DEFAULT;
};

export const saveAIIdentity = (identity: Partial<AIIdentity>) => {
    try {
        const current = getAIIdentity();
        const updated = { ...current, ...identity };
        localStorage.setItem('gigi_identity_cache', JSON.stringify(updated));

        // Dispatch event so UI updates immediately
        window.dispatchEvent(new Event('gigi-identity-updated'));
        return updated;
    } catch (e) {
        console.error("[Config] Failed to save identity", e);
        return getAIIdentity();
    }
};

export const resetAIIdentity = () => {
    localStorage.removeItem('gigi_identity_cache');
    window.dispatchEvent(new Event('gigi-identity-updated'));
    return AI_IDENTITY_DEFAULT;
};

// ============================================================================
// 3. PROVIDER ROUTING & SECRETS
// ============================================================================

export const getProviderForModel = (modelId: string): 'fireworks' | 'google' | 'xai' | 'ollama' => {
    if (!modelId) return 'ollama'; // Fallback for safety
    if (modelId.startsWith('gemini')) return 'google';
    if (modelId.startsWith('grok')) return 'xai';
    if (modelId.startsWith('accounts/fireworks') || modelId.includes('llama') || modelId.includes('qwen') || modelId.includes('mixtral')) {
        return 'fireworks';
    }
    return 'ollama';
};

// SSOT Keys Wrappers (Convenience for other files)
export const getFireworksKey = () => SecretsManager.get('fireworks');
export const getXAIKey = () => SecretsManager.get('xai');
export const getGeminiKey = () => SecretsManager.get('gemini');