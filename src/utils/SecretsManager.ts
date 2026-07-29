import { doc, getDoc, setDoc, getFirestore } from '../services/sovereignDbAdapter';

/**
 * [ZEN FIX] Complete Type Definition for all managed secrets.
 * This is the master list of allowed keys for the get/set/sync methods.
 */
export type SecretKey =
    | 'xai'
    | 'firebase'
    | 'fireworks'
    | 'elevenlabs'
    | 'typesense_host'
    | 'typesense_key'
    | 'fireworks_api_key'
    | 'model_fireworks'
    | 'model_reserve'
    | 'model_xai'
    | 'model_elevenlabs_brita'
    | 'model_primary'
    | 'google_client_id'
    | 'voyage'            // [ZEN EWO #21]
    | 'azure_face_key'
    | 'azure_face_endpoint' // [ZEN EWO 002]
    | 'azure_vision_key'
    | 'azure_vision_endpoint'
    | 'google_maps'      // [ZEN] Sovereign Maps Key
    | 'openrouter'       // [ZEN] Crisis Lifeboat
    | 'replicate'        // Image-to-3D API
    | 'deepseek';        // [ZEN] DeepSeek Apex Alternative

// Global Window Interface for Console Debugging
declare global {
    interface Window {
        setGigiSecrets: (keys: {
            xai?: string;
            elevenlabs?: string;
            firebase?: any;
            fireworks?: string;
            typesenseHost?: string;
            typesenseKey?: string;
            voyage?: string;
            openrouter?: string;
            replicate?: string;
            deepseek?: string;
        }) => void;
    }
}

// [ZEN FIX] Prevent infinite "Not Found" spam by tracking sync attempts
const syncAttemptedForUser = new Set<string>();

export const SecretsManager = {
    // ... (previous methods preserved above) ...
    get: (key: SecretKey): string | undefined => {
        // [ZEN V32] xAI: Bulletproof Environment & Local Storage Lookup
        if (key === 'xai') {
            const rawEnv = (import.meta.env.VITE_XAI_API_KEY as string) || (import.meta.env.XAI_API_KEY as string);
            const envVal = rawEnv ? rawEnv.replace(/^["']|["']$/g, '').trim() : '';
            if (envVal) return envVal;

            const candidates = [
                localStorage.getItem('GIGI_SEC_XAI'),
                localStorage.getItem('GIGI_SEC_MODEL_XAI'),
                localStorage.getItem('xai_api_key'),
                localStorage.getItem('xai'),
                localStorage.getItem('XAI_API_KEY')
            ];

            for (const c of candidates) {
                if (c && c !== 'undefined' && c !== 'null' && c.trim().length > 0) {
                    return c.replace(/^["']|["']$/g, '').trim();
                }
            }

            return undefined;
        }

        // 1. Standard "GIGI_SEC_" Lookup (The Modern Standard)
        const stdKey = `GIGI_SEC_${key.toUpperCase()}`;
        let val = localStorage.getItem(stdKey);

        // Explicit check for string "undefined" or "null" which can be saved by previous buggy calls
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

        if (key === 'elevenlabs') {
            const found = (import.meta.env.VITE_ELEVENLABS_API_KEY as string) || 
                         localStorage.getItem('GIGI_SEC_ELEVENLABS') || 
                         '';
            if (found && found !== 'undefined' && found !== 'null') {
                 // console.log(`%c[SecretsManager] 🔑 ElevenLabs Key Fingerprint: ${found.substring(0, 7)}...`, "color: #00ff00; font-weight: bold;");
                 return found;
            }
        }

        // 4. FIREBASE: Legacy Fallback
        if (key === 'firebase') {
            return localStorage.getItem('gigi_firebase_config') || undefined;
        }

        // 5. TYPESENSE: Fallbacks to Environment Variables
        if (key === 'typesense_host') {
            return localStorage.getItem('GIGI_SEC_TYPESENSE_HOST') ||
                (import.meta.env.VITE_TYPESENSE_HOST as string) ||
                "gigi-typesense.zen-cloud.net"; // [ZEN PROVISION] Fallback to new stable cluster
        }
        if (key === 'typesense_key') {
            return localStorage.getItem('GIGI_SEC_TYPESENSE_KEY') || (import.meta.env.VITE_TYPESENSE_API_KEY as string);
        }

        // 7. GOOGLE CLIENT ID
        if (key === 'google_client_id') {
            return localStorage.getItem('GIGI_SEC_GOOGLE_CLIENT_ID') || undefined;
        }

        // 8. VOYAGE AI (Neural Embeddings)
        if (key === 'voyage') {
            return localStorage.getItem('GIGI_SEC_VOYAGE') || (import.meta.env.VITE_VOYAGE_API_KEY as string) || undefined;
        }

        // 9. AZURE FACE API [ZEN EWO 002]
        if (key === 'azure_face_key') {
            return localStorage.getItem('GIGI_SEC_AZURE_FACE_KEY') || 
                   localStorage.getItem('GIGI_SEC_AZURE_FACE') || 
                   (import.meta.env.VITE_AZURE_FACE_API_KEY as string) || undefined;
        }
        if (key === 'azure_face_endpoint') {
            return localStorage.getItem('GIGI_SEC_AZURE_FACE_ENDPOINT') ||
                "https://gigi-neural-vision-core.cognitiveservices.azure.com";
        }
        if (key === 'azure_vision_key') {
            return localStorage.getItem('GIGI_SEC_AZURE_VISION_KEY') || (import.meta.env.VITE_AZURE_VISION_API_KEY as string) || undefined;
        }
        if (key === 'azure_vision_endpoint') {
            return localStorage.getItem('GIGI_SEC_AZURE_VISION_ENDPOINT') ||
                "https://gigi-neural-vision-core.cognitiveservices.azure.com"; // Shared endpoint common in tiered subs
        }

        // 10. GOOGLE MAPS [ZEN]
        if (key === 'google_maps') {
            return localStorage.getItem('GIGI_SEC_GOOGLE_MAPS') || (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || undefined;
        }

        // 11. OPENROUTER [ZEN]
        if (key === 'openrouter') {
            return localStorage.getItem('GIGI_SEC_OPENROUTER') || (import.meta.env.VITE_OPENROUTER_API_KEY as string) || undefined;
        }

        // 12. REPLICATE (Image-to-3D)
        if (key === 'replicate') {
            return localStorage.getItem('GIGI_SEC_REPLICATE') || (import.meta.env.VITE_REPLICATE_API_TOKEN as string) || undefined;
        }

        // 13. DEEPSEEK [ZEN]
        if (key === 'deepseek') {
            return localStorage.getItem('GIGI_SEC_DEEPSEEK') || (import.meta.env.VITE_DEEPSEEK_API_KEY as string) || undefined;
        }

        return undefined;
    },

    /**
     * Local setter that ensures legacy keys are kept in sync for backward compatibility.
     */
    set: (key: string, value: string) => {
        const storageKey = `GIGI_SEC_${key.toUpperCase()}`;
        localStorage.setItem(storageKey, value);

        // Sync Legacy Keys to keep older components functional
        if (key === 'fireworks' || key === 'fireworks_api_key') {
            localStorage.setItem('GIGI_SEC_FIREWORKS', value);
            localStorage.setItem('fireworks_key_cache', value);
        }
    },

    /**
     * Cloud Persistence for all keys. 
     * This is the bridge that allows cross-device synchronization.
     */
    saveToCloud: async (userId: string, keys: {
        typesenseHost?: string;
        typesenseKey?: string;
        fireworksKey?: string;
        grokKey?: string;

        // Model IDs for the Roster
        modelFireworks?: string;
        modelReserve?: string;
        modelXAI?: string;
        googleClientId?: string;
        voyageKey?: string;
        googleMapsKey?: string;
        openRouterKey?: string;
        replicateKey?: string;
        deepseekKey?: string;
    }) => {
        if (!userId) return;

        const db = getFirestore();
        if (!db) { console.warn("[SecretsManager] DB not ready, skipping Cloud Save"); return; }

        try {
            const ref = doc(db, 'users', userId, 'zen_config', 'main');

            // Merge with existing config to avoid overwriting unrelated fields
            await setDoc(ref, keys, { merge: true });

            // Update local cache immediately to reflect changes without a full page reload
            if (keys.typesenseHost) localStorage.setItem("GIGI_SEC_TYPESENSE_HOST", keys.typesenseHost);
            if (keys.typesenseKey) localStorage.setItem("GIGI_SEC_TYPESENSE_KEY", keys.typesenseKey);

            if (keys.fireworksKey) {
                localStorage.setItem("GIGI_SEC_FIREWORKS", keys.fireworksKey);
                localStorage.setItem("fireworks_key_cache", keys.fireworksKey);
            }
            if (keys.grokKey) {
                localStorage.setItem("GIGI_SEC_XAI", keys.grokKey);
            }

            // [ZEN FIX] Explicit Model Sync
            if (keys.modelFireworks) localStorage.setItem("GIGI_SEC_MODEL_FIREWORKS", keys.modelFireworks);
            if (keys.modelReserve) localStorage.setItem("GIGI_SEC_MODEL_RESERVE", keys.modelReserve);
            if (keys.modelXAI) localStorage.setItem("GIGI_SEC_MODEL_XAI", keys.modelXAI);
            if (keys.googleClientId) localStorage.setItem("GIGI_SEC_GOOGLE_CLIENT_ID", keys.googleClientId);
            if (keys.googleMapsKey) localStorage.setItem("GIGI_SEC_GOOGLE_MAPS", keys.googleMapsKey);
            if (keys.voyageKey) localStorage.setItem("GIGI_SEC_VOYAGE", keys.voyageKey);
            if (keys.openRouterKey) localStorage.setItem("GIGI_SEC_OPENROUTER", keys.openRouterKey);
            if (keys.replicateKey) localStorage.setItem("GIGI_SEC_REPLICATE", keys.replicateKey);
            if (keys.deepseekKey) localStorage.setItem("GIGI_SEC_DEEPSEEK", keys.deepseekKey);

            console.log("[SecretsManager] Keys successfully saved to Cloud & Local Cache.");
        } catch (e) {
            console.error("[SecretsManager] Cloud Save Failed:", e);
            throw e;
        }
    },

    /**
     * App Boot Sync - Restores ALL keys from Firestore to local storage.
     * This is called when the app first initializes to handle cross-device logins.
     */
    sync: async (userId: string) => {
        if (!userId) return;
        if (syncAttemptedForUser.has(userId)) return;

        const db = getFirestore();
        if (!db) { console.warn("[SecretsManager] DB not ready, skipping Sync"); return; }

        try {
            // [CLEARED]
            const ref = doc(db, 'users', userId, 'zen_config', 'main');
            const snap = await getDoc(ref);

            syncAttemptedForUser.add(userId);

            if (snap.exists()) {
                const data = snap.data();

                if (data.grokKey) {
                    localStorage.setItem("GIGI_SEC_XAI", data.grokKey);
                }

                if (data.fireworksKey) {
                    localStorage.setItem("GIGI_SEC_FIREWORKS", data.fireworksKey);
                    localStorage.setItem("fireworks_key_cache", data.fireworksKey);
                }

                if (data.typesenseHost) {
                    localStorage.setItem("GIGI_SEC_TYPESENSE_HOST", data.typesenseHost);
                }

                if (data.typesenseKey) {
                    localStorage.setItem("GIGI_SEC_TYPESENSE_KEY", data.typesenseKey);
                }

                // Roster Model IDs
                if (data.modelFireworks) localStorage.setItem("GIGI_SEC_MODEL_FIREWORKS", data.modelFireworks);
                if (data.modelReserve) localStorage.setItem("GIGI_SEC_MODEL_RESERVE", data.modelReserve);
                if (data.modelXAI) localStorage.setItem("GIGI_SEC_MODEL_XAI", data.modelXAI);
                if (data.googleClientId) localStorage.setItem("GIGI_SEC_GOOGLE_CLIENT_ID", data.googleClientId);
                if (data.googleMapsKey) localStorage.setItem("GIGI_SEC_GOOGLE_MAPS", data.googleMapsKey);
                if (data.voyageKey) localStorage.setItem("GIGI_SEC_VOYAGE", data.voyageKey);
                if (data.openRouterKey) localStorage.setItem("GIGI_SEC_OPENROUTER", data.openRouterKey);
                if (data.replicateKey) localStorage.setItem("GIGI_SEC_REPLICATE", data.replicateKey);
                if (data.deepseekKey) localStorage.setItem("GIGI_SEC_DEEPSEEK", data.deepseekKey);

                console.log("[SecretsManager] Global Sync Complete.");
            } else {
                // [CLEARED]
            }
        } catch (error) {
            console.error("[SecretsManager] Sync Failed:", error);
            syncAttemptedForUser.delete(userId);
        }
    }
};

/**
 * Console-accessible helper for manual emergency key injection.
 * Usage: window.setGigiSecrets({ fireworks: "fw_...", typesenseHost: "..." })
 */
const setGigiSecrets = (keys: {
    xai?: string;
    firebase?: any;
    fireworks?: string;
    typesenseHost?: string;
    typesenseKey?: string;
    voyage?: string;
    googleMaps?: string;
    openrouter?: string;
    replicate?: string;
    deepseek?: string;
}) => {
    if (keys.openrouter) localStorage.setItem("GIGI_SEC_OPENROUTER", keys.openrouter);
    if (keys.replicate) localStorage.setItem("GIGI_SEC_REPLICATE", keys.replicate);
    if (keys.deepseek) localStorage.setItem("GIGI_SEC_DEEPSEEK", keys.deepseek);
    if (keys.googleMaps) localStorage.setItem("GIGI_SEC_GOOGLE_MAPS", keys.googleMaps);
    if (keys.xai) localStorage.setItem("GIGI_SEC_XAI", keys.xai);
    if (keys.fireworks) {
        localStorage.setItem("GIGI_SEC_FIREWORKS", keys.fireworks);
        localStorage.setItem("fireworks_key_cache", keys.fireworks);
    }
    if (keys.typesenseHost) localStorage.setItem("GIGI_SEC_TYPESENSE_HOST", keys.typesenseHost);
    if (keys.typesenseKey) localStorage.setItem("GIGI_SEC_TYPESENSE_KEY", keys.typesenseKey);
    if (keys.voyage) localStorage.setItem("GIGI_SEC_VOYAGE", keys.voyage);

    if (keys.firebase) {
        const json = JSON.stringify(keys.firebase);
        localStorage.setItem("GIGI_SEC_FIREBASE", json);
        localStorage.setItem("gigi_firebase_config", json);
    }

    console.log("✅ Secrets Injected via Console. Syncing to Cloud...");
    
    // [ZEN FIX] Explicit Cloud Push
    const userId = (window as any).gigiUserId || localStorage.getItem('gigi_user_id');
    if (userId) {
        SecretsManager.saveToCloud(userId, {
            grokKey: keys.xai,
            fireworksKey: keys.fireworks,
            typesenseHost: keys.typesenseHost,
            typesenseKey: keys.typesenseKey,
            voyageKey: keys.voyage,
            googleMapsKey: keys.googleMaps,
            openRouterKey: keys.openrouter,
            replicateKey: keys.replicate,
            deepseekKey: keys.deepseek
        }).then(() => {
            console.log("☁️ Cloud Sync Complete. Triggering Soft Reset...");
            window.dispatchEvent(new Event('gigi-hard-reset'));
        });
    } else {
        console.warn("❌ No UserID found, cloud sync skipped. Triggering Soft Reset...");
        window.dispatchEvent(new Event('gigi-hard-reset'));
    }
};

try {
    (window as any).setGigiSecrets = setGigiSecrets;
} catch (e) { }