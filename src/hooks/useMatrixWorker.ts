import { useState, useEffect, useRef } from 'react';
import { Media } from '../types';

export const useMatrixWorker = (incomingAssets: Media[]) => {
    // UI State
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Media[]>([]);
    const [isIndexing, setIsIndexing] = useState(false);
    
    // Worker Reference
    const workerRef = useRef<Worker | null>(null);
    const dataSignature = useRef<string>("");

    // 1. INITIALIZE WORKER
    useEffect(() => {
        workerRef.current = new Worker(new URL('../workers/matrix.worker.ts', import.meta.url), { type: 'module' });

        workerRef.current.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'LOAD_COMPLETE') {
                setIsIndexing(false);
            } else if (type === 'SEARCH_RESULTS') {
                // We got IDs. Now we filter the main list.
                // This is very fast (O(N) filter on 4000 items is ~1ms)
                if (payload.length === 0) {
                    setSearchResults([]);
                } else {
                    const idSet = new Set(payload);
                    // Use a functional update or ref to access latest assets if needed, 
                    // but usually filtering the prop is fine here.
                    // To avoid closure staleness, we might need a ref to assets.
                }
            }
        };

        return () => workerRef.current?.terminate();
    }, []);

    // 2. SEND DATA TO WORKER (Optimized)
    useEffect(() => {
        if (!incomingAssets || incomingAssets.length === 0 || !workerRef.current) return;

        const first = incomingAssets[0]?.id || 'x';
        const last = incomingAssets[incomingAssets.length - 1]?.id || 'y';
        const newSig = `${incomingAssets.length}-${first}-${last}`;

        if (dataSignature.current !== newSig) {
            setIsIndexing(true);
            dataSignature.current = newSig;

            // Prepare Lightweight Payload (Strings Only)
            const payload = incomingAssets.map(a => ({
                id: a.id,
                title: a.title || '',
                originalName: a.originalName || '',
                description: a.description || '',
                caption: a.caption || '',
                tags: a.tagIds ? a.tagIds.join(' ') : '',
                year: a.year ? String(a.year) : '',
                fileType: a.fileType || ''
            }));

            workerRef.current.postMessage({ type: 'LOAD', payload });
        }
    }, [incomingAssets]);

    // 3. HANDLE SEARCH & HYDRATION
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]); 
            return;
        }

        const handleWorkerMessage = (e: MessageEvent) => {
            if (e.data.type === 'SEARCH_RESULTS') {
                const ids = new Set(e.data.payload as string[]);
                // Filter the source assets
                const results = incomingAssets.filter(a => ids.has(a.id));
                setSearchResults(results);
            }
        };

        workerRef.current?.addEventListener('message', handleWorkerMessage);
        
        // Debounce (300ms)
        const timer = setTimeout(() => {
            workerRef.current?.postMessage({ type: 'SEARCH', payload: searchQuery });
        }, 300);

        return () => {
            clearTimeout(timer);
            workerRef.current?.removeEventListener('message', handleWorkerMessage);
        };
    }, [searchQuery, incomingAssets]);

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        isIndexing
    };
};