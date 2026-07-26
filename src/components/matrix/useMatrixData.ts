import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, query, getDocs, limit, orderBy } from '../../services/sovereignDbAdapter';
import { db } from '../../firebaseConfig';
import type { Media, User } from '../../types';
import { getMediaType } from './MatrixShared';const EMPTY_ARRAY: Media[] = [];

export const useMatrixData = (user: User, initialMediaObject?: Media | null, targetCollection: 'media' | 'pending_accessions' = 'media') => {
    const queryClient = useQueryClient();
    const [localOptimisticAssets, setLocalOptimisticAssets] = useState<Map<string, Media>>(new Map());

    const [localDeletedAssetIds, setLocalDeletedAssetIds] = useState<Set<string>>(new Set());

    const { data: dbAssets = EMPTY_ARRAY, isLoading: isQueryLoading } = useQuery({
        queryKey: ['matrix', 'media', user?.id, targetCollection],
        queryFn: async () => {
            if (!user?.id) return [];
            // [ZEN] Enforce server-side limit & order to prevent 10MB payload cap explosion and 15-second hang over hotspot!
            const q = query(
                collection(db, 'users', user.id, targetCollection),
                orderBy('logicalDate', 'desc'),
                limit(200)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc: any) => ({ 
                id: doc.id, 
                _collectionSource: targetCollection, // [ZEN FORENSIC] Attach source collection for tracing
                ...doc.data() 
            } as Media));
        },
        enabled: !!user?.id,
        refetchInterval: 10000, // 10 seconds polling for "real-time" feel
    });

    // Clear optimistic assets once the underlying data catches up
    useEffect(() => {
        setLocalOptimisticAssets(prev => prev.size > 0 ? new Map() : prev);
        // We do NOT clear localDeletedAssetIds here because the background deletion might still be running.
        // It's safe to keep deleted IDs around for the duration of the component lifecycle.
    }, [dbAssets]);

    // Merge dbAssets with provisional/optimistic assets
    const assets = useMemo(() => {
        // Filter out any items we know have been deleted locally to prevent "ghost" re-renders
        // from in-flight or racing background polling fetches.
        const assetMap = new Map<string, Media>(
            dbAssets
                .filter(a => !localDeletedAssetIds.has(a.id))
                .map(a => [a.id, a])
        );
        
        // Ensure initialMediaObject is present if it's not yet synced from DB
        if (initialMediaObject && !assetMap.has(initialMediaObject.id) && !localDeletedAssetIds.has(initialMediaObject.id)) {
            assetMap.set(initialMediaObject.id, initialMediaObject);
        }
        
        // Apply any locally updated/optimistic assets overriding DB state
        for (const [id, localAsset] of localOptimisticAssets.entries()) {
            if (!localDeletedAssetIds.has(id)) {
                assetMap.set(id, localAsset); // This will overwrite DB asset or append provisional
            }
        }
        
        return Array.from(assetMap.values());
    }, [dbAssets, initialMediaObject, localOptimisticAssets, localDeletedAssetIds]);

    // Loading state includes both React Query loading and lack of assets when we expect some
    const isLoading = isQueryLoading;

    // 3. Local State Update Helper
    const updateAsset = useCallback((updatedAsset: Media) => {
        setLocalOptimisticAssets(prev => {
            const next = new Map(prev);
            next.set(updatedAsset.id, updatedAsset);
            return next;
        });

        // Also push the update immediately into the TanStack Query cache to keep other subscribers in sync
        const queryKey = ['matrix', 'media', user?.id, targetCollection];
        queryClient.setQueryData(queryKey, (oldData: Media[] | undefined) => {
            if (!oldData) return [];
            return oldData.map(asset => asset.id === updatedAsset.id ? updatedAsset : asset);
        });
    }, [queryClient, user?.id, targetCollection]);

    const removeAsset = useCallback((id: string) => {
        // Technically removal should probably be a mutation that invalidates, but for local state:
        setLocalOptimisticAssets(prev => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
        
        setLocalDeletedAssetIds(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        
        // Remove from TanStack Query cache directly for instant UI update
        const queryKey = ['matrix', 'media', user?.id, targetCollection];
        queryClient.setQueryData(queryKey, (oldData: Media[] | undefined) => {
            if (!oldData) return [];
            return oldData.filter(asset => asset.id !== id);
        });
    }, [queryClient, user?.id, targetCollection]);

    // 4. Initial Tab Detection
    const getInitialTab = useCallback((): 'visuals' | 'documents' => {
        if (initialMediaObject) {
            const type = getMediaType(initialMediaObject);
            if (type === 'pdf' || type === 'audio' || type === 'unknown') {
                return 'documents';
            }
        }
        return 'visuals';
    }, [initialMediaObject]);

    return {
        assets,
        isLoading,
        updateAsset,
        removeAsset,
        getInitialTab
    };
};