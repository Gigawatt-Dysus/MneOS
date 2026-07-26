import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import type { Media, User } from '@/types';
import { getMediaType } from './MatrixShared';

export const useMatrixData = (user: User, initialMediaObject?: Media | null) => {
    const [assets, setAssets] = useState<Media[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const injectedObjectIdRef = useRef<string | null>(null);

    // 1. Inject Provisional Asset (Deep Link / New Upload)
    useEffect(() => {
        if (initialMediaObject && injectedObjectIdRef.current !== initialMediaObject.id) {
            setAssets(prev => {
                // Prevent duplicates
                if (prev.some(a => a.id === initialMediaObject.id)) return prev;
                
                // console.log(`[Matrix Data] 💉 Injecting Provisional Asset: ${initialMediaObject.id}`);
                injectedObjectIdRef.current = initialMediaObject.id;
                return [initialMediaObject, ...prev];
            });
        }
    }, [initialMediaObject]);

    // 2. Firestore Subscription
    useEffect(() => {
        if (!user?.id) return;

        const q = query(collection(db, 'users', user.id, 'media'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Media));
            
            setAssets(prev => {
                const assetMap = new Map(loaded.map(a => [a.id, a]));
                
                // Keep provisional asset if it hasn't synced from DB yet
                if (initialMediaObject && !assetMap.has(initialMediaObject.id)) {
                    assetMap.set(initialMediaObject.id, initialMediaObject);
                }
                
                // Keep any other provisional assets currently in state (e.g. optimistic uploads)
                prev.forEach(p => {
                    if (p.status === 'provisional' && !assetMap.has(p.id)) {
                        assetMap.set(p.id, p);
                    }
                });
                
                return Array.from(assetMap.values());
            });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user.id, initialMediaObject]);

    // 3. Local State Update Helper
    const updateAsset = useCallback((updatedAsset: Media) => {
        setAssets(prev => prev.map(a => a.id === updatedAsset.id ? updatedAsset : a));
    }, []);

    // 4. Initial Tab Detection
    const getInitialTab = (): 'visuals' | 'documents' => {
        if (initialMediaObject) {
            const type = getMediaType(initialMediaObject);
            if (type === 'pdf' || type === 'audio' || type === 'unknown') {
                return 'documents';
            }
        }
        return 'visuals';
    };

    return {
        assets,
        isLoading,
        updateAsset,
        getInitialTab
    };
};