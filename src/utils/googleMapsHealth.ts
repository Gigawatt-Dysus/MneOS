// [ZEN STABILITY] Google Maps Global Health Monitor
// Detects runtime failures (like BillingNotEnabledMapError) and provides a global "Safe Fallback" state.

let mapsBroken = false;
let onHealthChange: ((isBroken: boolean) => void) | null = null;

/**
 * Initialize the global auth failure hook.
 * Google Maps calls 'gm_authFailure' automatically when API keys are invalid or billing is missing.
 */
if (typeof window !== 'undefined') {
    (window as any).gm_authFailure = () => {
        console.error("[GIGI MAPS] ❌ Google Maps Authentication/Billing Failure Detected.");
        mapsBroken = true;
        if (onHealthChange) onHealthChange(true);
    };
}

export const isGoogleMapsBroken = () => mapsBroken;

export const subscribeToMapsHealth = (callback: (isBroken: boolean) => void) => {
    onHealthChange = callback;
    // Return unsubscribe
    return () => { onHealthChange = null; };
};

/**
 * Force mark as broken (e.g. if a library fails to import)
 */
export const markMapsAsBroken = () => {
    mapsBroken = true;
    if (onHealthChange) onHealthChange(true);
};
