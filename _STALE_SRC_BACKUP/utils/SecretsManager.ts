import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';

// [ZEN FIX] Complete Type Definition for all managed secrets
export type SecretKey =
    | 'xai'
    | 'gemini'
    | 'firebase'
    | 'fireworks'
    | 'typesense_host'
    | 'typesense_key'
    | 'fireworks_api_key'
    | 'model_fireworks'
    | 'model_reserve'
    | 'model_xai'
    | 'model_gemini';

// [ZEN FIX] Global Window Interface for Console Debugging
declare global {
    interface Window {
        setGigiSecrets: (keys: {
            xai?: string;
            gemini?: string;
            firebase?: any;
            fireworks?: string;
            typesenseHost?: string;
            typesenseKey?: string;
        }) => void;
    }
}

export const SecretsManager = {
    // [ZEN FIX] Nuclear Retrieval Strategy
    // Checks: Local Storage -> Legacy Keys -> Environment Variables
    get: (key: SecretKey): string | undefined => {
        // 1. Standard "GIGI_SEC_" Lookup (The Modern Standard)
        const stdKey = `GIGI_SEC_${key.toUpperCase()}`;
        let val = localStorage.getItem(stdKey);

        // Explicit check for string "undefined" or "null" which sometimes gets saved by buggy set calls
        if (val && val !== 'undefined' && val !== 'null') {
            return val;
        }

        // 2. FIREWORKS: Check all known aliases from previous versions
        if (key === 'fireworks' || key === 'fireworks_api_key') {
            return localStorage.getItem('fireworks_key_cache') ||
                localStorage.getItem('GIGI_SEC_FIREWORKS') ||
                localStorage.getItem('GIGI_SEC_FIREWORKS_API_KEY') ||
                localStorage.getItem('fireworks_api_key') ||
                (import.meta.env.VITE_FIREWORKS_API_KEY as string) ||
                undefined;
        }

        // 3. GEMINI: Nuclear Search for legacy keys
        if (key === 'gemini') {
            const found =
                localStorage.getItem('GIGI_SEC_GEMINI') ||
                localStorage.getItem('GIGI_SEC_GOOGLE') ||
                localStorage.getItem('google_api_key') ||
                localStorage.getItem('gemini_api_key') ||
                localStorage.getItem('GIGI_SEC_GEMINI_KEY') ||
                localStorage.getItem('GIGI_SEC_GOOGLE_API_KEY') ||
                (import.meta.env.VITE_GOOGLE_API_KEY as string) ||
                (import.meta.env.VITE_GEMINI_API_KEY as string);

            if (found && found !== 'undefined') return found;
        }

        // 4. FIREBASE: Legacy Fallback
        if (key === 'firebase') {
            return localStorage.getItem('gigi_firebase_config') || undefined;
        }

        // 5. TYPESENSE: Fallbacks to Environment Variables
        if (key === 'typesense_host') {
            return localStorage.getItem('GIGI_SEC_TYPESENSE_HOST') || (import.meta.env.VITE_TYPESENSE_HOST as string);
        }
        if (key === 'typesense_key') {
            return localStorage.getItem('GIGI_SEC_TYPESENSE_KEY') || (import.meta.env.VITE_TYPESENSE_API_KEY as string);
        }

        // 6. xAI: Explicit check
        if (key === 'xai') {
            return localStorage.getItem('GIGI_SEC_XAI') || undefined;
        }

        // 7. Roster Models (No fallback, return undefined if not set)
        if (key === 'model_fireworks' || key === 'model_reserve' || key === 'model_xai' || key === 'model_gemini') {
            return undefined;
        }

        return undefined;
    },

    // [ZEN FIX] Setter that ensures legacy keys are kept in sync
    set: (key: string, value: string) => {
        const storageKey = `GIGI_SEC_${key.toUpperCase()}`;
        localStorage.setItem(storageKey, value);

        // Sync Legacy Keys to keep older components happy
        if (key === 'gemini') {
            localStorage.setItem('GIGI_SEC_GOOGLE', value);
            localStorage.setItem('google_api_key', value);
        }
        if (key === 'fireworks' || key === 'fireworks_api_key') {
            localStorage.setItem('GIGI_SEC_FIREWORKS', value);
            localStorage.setItem('fireworks_key_cache', value);
        }
    },

    // [ZEN FIX] Cloud Persistence for all keys and model configurations
    saveToCloud: async (userId: string, keys: {
        typesenseHost?: string;
        typesenseKey?: string;
        fireworksKey?: string;
        geminiKey?: string;
        grokKey?: string;
        // Dynamic Roster Support
        modelFireworks?: string;
        modelReserve?: string;
        modelXAI?: string;
        modelGemini?: string;
    }) => {
        if (!userId) return;

        // [DEADLOCK FIX] Get DB instance dynamically to avoid module-level circular deps
        const db = getFirestore();
        if (!db) { console.warn("[SecretsManager] DB not ready, skipping Cloud Save"); return; }

        try {
            const ref = doc(db, 'users', userId, 'zen_config', 'main');

            // Merge with existing config to avoid overwriting unrelated fields
            await setDoc(ref, keys, { merge: true });

            // Update local cache immediately to reflect changes without reload
            if (keys.typesenseHost) localStorage.setItem("GIGI_SEC_TYPESENSE_HOST", keys.typesenseHost);
            if (keys.typesenseKey) localStorage.setItem("GIGI_SEC_TYPESENSE_KEY", keys.typesenseKey);

            if (keys.fireworksKey) {
                localStorage.setItem("GIGI_SEC_FIREWORKS", keys.fireworksKey);
                localStorage.setItem("fireworks_key_cache", keys.fireworksKey);
            }
            if (keys.geminiKey) {
                localStorage.setItem("GIGI_SEC_GEMINI", keys.geminiKey);
                localStorage.setItem("GIGI_SEC_GOOGLE", keys.geminiKey);
            }
            if (keys.grokKey) {
                localStorage.setItem("GIGI_SEC_XAI", keys.grokKey);
            }

            // Roster Updates
            if (keys.modelFireworks !== undefined) localStorage.setItem("GIGI_SEC_MODEL_FIREWORKS", keys.modelFireworks);
            if (keys.modelReserve !== undefined) localStorage.setItem("GIGI_SEC_MODEL_RESERVE", keys.modelReserve);
            if (keys.modelXAI !== undefined) localStorage.setItem("GIGI_SEC_MODEL_XAI", keys.modelXAI);
            if (keys.modelGemini !== undefined) localStorage.setItem("GIGI_SEC_MODEL_GEMINI", keys.modelGemini);

            console.log("[SecretsManager] Keys & Roster saved to Cloud & Local.");
        } catch (e) {
            console.error("[SecretsManager] Cloud Save Failed:", e);
            throw e;
        }
    },

    // [ZEN FIX] App Boot Sync - Restores ALL keys from Firestore
    sync: async (userId: string) => {
        if (!userId) return;

        // [DEADLOCK FIX] Get DB instance dynamically
        const db = getFirestore();
        if (!db) { console.warn("[SecretsManager] DB not ready, skipping Sync"); return; }

        try {
            console.log("[SecretsManager] Syncing from Cloud...");
            const ref = doc(db, 'users', userId, 'zen_config', 'main');
            const snap = await getDoc(ref);

            if (snap.exists()) {
                const data = snap.data();

                // Keys
                if (data.geminiKey) {
                    localStorage.setItem("GIGI_SEC_GEMINI", data.geminiKey);
                    localStorage.setItem("GIGI_SEC_GOOGLE", data.geminiKey);
                    console.log("[SecretsManager] Gemini Key Updated");
                }

                if (data.grokKey) {
                    localStorage.setItem("GIGI_SEC_XAI", data.grokKey);
                    console.log("[SecretsManager] Grok Key Updated");
                }

                if (data.fireworksKey) {
                    localStorage.setItem("GIGI_SEC_FIREWORKS", data.fireworksKey);
                    localStorage.setItem("fireworks_key_cache", data.fireworksKey);
                    console.log("[SecretsManager] Fireworks Key Updated");
                }

                if (data.typesenseHost) localStorage.setItem("GIGI_SEC_TYPESENSE_HOST", data.typesenseHost);
                if (data.typesenseKey) localStorage.setItem("GIGI_SEC_TYPESENSE_KEY", data.typesenseKey);

                // Roster
                if (data.modelFireworks) localStorage.setItem("GIGI_SEC_MODEL_FIREWORKS", data.modelFireworks);
                if (data.modelReserve) localStorage.setItem("GIGI_SEC_MODEL_RESERVE", data.modelReserve);
                if (data.modelXAI) localStorage.setItem("GIGI_SEC_MODEL_XAI", data.modelXAI);
                if (data.modelGemini) localStorage.setItem("GIGI_SEC_MODEL_GEMINI", data.modelGemini);

                console.log("[SecretsManager] Sync Complete.");
            } else {
                console.log("[SecretsManager] No cloud config found.");
            }
        } catch (error) {
            console.error("[SecretsManager] Sync Failed:", error);
        }
    }
};

// [ZEN FIX] Global Override for Console Debugging
// Usage: window.setGigiSecrets({ xai: "...", gemini: "..." })
const setGigiSecrets = (keys: { xai?: string; gemini?: string; firebase?: any; fireworks?: string }) => {
    if (keys.xai) localStorage.setItem("GIGI_SEC_XAI", keys.xai);
    if (keys.gemini) {
        localStorage.setItem("GIGI_SEC_GEMINI", keys.gemini);
        localStorage.setItem("GIGI_SEC_GOOGLE", keys.gemini);
    }
    if (keys.fireworks) {
        localStorage.setItem("GIGI_SEC_FIREWORKS", keys.fireworks);
        localStorage.setItem("fireworks_key_cache", keys.fireworks);
    }

    // Helper: If they pass a full firebase object
    if (keys.firebase) {
        const json = JSON.stringify(keys.firebase);
        localStorage.setItem("GIGI_SEC_FIREBASE", json);
        localStorage.setItem("gigi_firebase_config", json); // Compatibility
    }

    console.log("✅ Secrets Injected. Reloading...");
    window.location.reload();
};

// Explicit assignment for window access
try {
    Object.defineProperty(window, 'setGigiSecrets', {
        value: setGigiSecrets,
        writable: true,
        configurable: true,
        enumerable: true
    });
    // Double tap assignment for safety
    (window as any).setGigiSecrets = setGigiSecrets;
} catch (e) {
    console.warn("Failed to define property on window, using assignment fallback", e);
    (window as any).setGigiSecrets = setGigiSecrets;
}

console.log(
    "%c[SecretsManager] Active. Type 'window.setGigiSecrets({ gemini: \"...\", xai: \"...\", fireworks: \"...\" })' to auto-login.",
    "color: #00ff80; background: #002010; padding: 4px;"
);