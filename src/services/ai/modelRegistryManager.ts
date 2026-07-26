/**
 * [ZEN] SOVEREIGN MODEL REGISTRY MANAGER
 * This singleton stores the active model mappings resolved at boot.
 * It allows non-hook services (like providers.ts) to access dynamic model IDs.
 */

export interface ModelRegistry {
    enrichment: string;
    chat_primary: string;
    vision: string;
    lastChecked?: any;
    flagship_detected?: string | null;
}

const DEFAULT_REGISTRY: ModelRegistry = {
    enrichment: 'grok-build-0.1',
    chat_primary: 'grok-4.3',
    vision: 'grok-4.3',
};

let activeRegistry: ModelRegistry = { ...DEFAULT_REGISTRY };

export const ModelRegistryManager = {
    setRegistry: (reg: ModelRegistry) => {
        activeRegistry = { ...DEFAULT_REGISTRY, ...reg };
        // [CLEARED]
    },
    
    getRegistry: () => activeRegistry,
    
    resolve: (role: keyof ModelRegistry | string): string => {
        // Handle specific roles, fallback to primary
        const r = role as keyof ModelRegistry;
        return activeRegistry[r] || activeRegistry.chat_primary;
    }
};
