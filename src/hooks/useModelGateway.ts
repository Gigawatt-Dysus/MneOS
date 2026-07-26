import { useState, useEffect, useCallback } from 'react';
import { appDataService } from '../services/serviceManager';
import { debugConfig } from '../debugConfig';
import { ModelRegistry, ModelRegistryManager } from '../services/ai/modelRegistryManager';

/**
 * [ZEN] Compare two Grok model IDs to find the newer version.
 * Handles patterns like grok-4.3, grok-4.20-0309-reasoning, grok-build-0.1, etc.
 */
export const compareGrokVersions = (a: string, b: string): number => {
    const parse = (modelId: string) => {
        const id = modelId.toLowerCase();
        // Extract the version numbers (e.g., '4.3' or '4.20')
        const match = id.match(/^grok-(\d+(?:\.\d+)*)/);
        if (!match) {
            // Non-versioned or build models rank lowest
            return { isVersioned: false, versionNum: 0, suffix: id };
        }
        
        const versionStr = match[1];
        // Parse as float to handle cases where 4.20 is older than 4.3 (4.2 < 4.3)
        const versionNum = parseFloat(versionStr);
        const suffix = id.slice(match[0].length);
        
        return { isVersioned: true, versionNum, suffix };
    };

    const parsedA = parse(a);
    const parsedB = parse(b);

    if (parsedA.isVersioned !== parsedB.isVersioned) {
        return parsedA.isVersioned ? 1 : -1;
    }

    if (parsedA.versionNum !== parsedB.versionNum) {
        return parsedA.versionNum - parsedB.versionNum;
    }

    // If version numbers are identical (e.g., 4.20), sort by suffix alphabetically (reasoning vs non-reasoning)
    return parsedA.suffix.localeCompare(parsedB.suffix);
};

export const useModelGateway = (userId: string | undefined) => {
    const [isLoading, setIsLoading] = useState(true);
    const [newFlagship, setNewFlagship] = useState<string | null>(null);

    const fetchRegistry = useCallback(async () => {
        if (!userId) {
            setIsLoading(false);
            return;
        }
        
        setIsLoading(true);
        try {
            // [CLEARED]
            const data = await appDataService.getAIModelRegistry(userId);
            if (data) {
                ModelRegistryManager.setRegistry(data);
            } else {
                // Initialize Firestore with defaults if empty
                const defaults = ModelRegistryManager.getRegistry();
                await appDataService.updateAIModelRegistry(userId, defaults);
            }
        } catch (error) {
            console.error("[ModelGateway] Registry sync failed:", error);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    const sniffModels = useCallback(async () => {
        if (!userId) return;
        try {
            // [ZEN] The Sniffer: Hardcoded known Grok models to bypass 403 Forbidden on /v1/models
            // The API no longer permits client-side fetching of models.
            const grokModels = [
                'grok-4.3',
                'grok-4.2',
                'grok-4.1'
            ].sort((a: string, b: string) => compareGrokVersions(b, a));

            if (grokModels.length > 0) {
                const latest = grokModels[0];
                const current = ModelRegistryManager.resolve('chat_primary');
                
                if (latest !== current && compareGrokVersions(latest, current) > 0) {
                    console.log(`[ModelGateway] 🆕 Neural Upgrade Detected: ${latest} (Current: ${current})`);
                    setNewFlagship(latest);
                }
            }
        } catch (e) {
            console.warn("[ModelGateway] Sniffer encountered temporal drift:", e);
        }
    }, [userId]);

    useEffect(() => {
        fetchRegistry();
    }, [fetchRegistry]);

    // Run sniffer once on boot after registry is loaded
    useEffect(() => {
        if (!isLoading && userId) {
            const timer = setTimeout(() => {
                sniffModels();
            }, 3000); // Wait 3s after boot to avoid congestion
            return () => clearTimeout(timer);
        }
    }, [isLoading, userId, sniffModels]);

    const promoteModel = async (role: keyof ModelRegistry, modelId: string) => {
        if (!userId) return;
        const current = ModelRegistryManager.getRegistry();
        const updated = { ...current, [role]: modelId };
        
        await appDataService.updateAIModelRegistry(userId, updated);
        ModelRegistryManager.setRegistry(updated);
        setNewFlagship(null);
    };

    return {
        registry: ModelRegistryManager.getRegistry(),
        isLoading,
        newFlagship,
        promoteModel,
        dismissUpgrade: () => setNewFlagship(null),
        refresh: fetchRegistry
    };
};
