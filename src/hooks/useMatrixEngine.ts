import { useState, useEffect, useCallback, useRef } from 'react';
import { matrixEngine } from '../services/MatrixEngine';
import { Media } from '../types';

export const useMatrixEngine = (incomingAssets: Media[]) => {
    // UI State
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState(""); // [ZEN FIX]
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    // Result State
    const [visualAssets, setVisualAssets] = useState<Media[]>([]);
    const [documentAssets, setDocumentAssets] = useState<Media[]>([]);
    const [groupedVisuals, setGroupedVisuals] = useState<any[]>([]);
    const [flatLightboxList, setFlatLightboxList] = useState<Media[]>([]);

    // 1. DATA INGESTION
    useEffect(() => {
        const hasChanged = matrixEngine.load(incomingAssets);
        if (hasChanged) {
            runProcess();
        }
    }, [incomingAssets]);

    // 2. DEBOUNCE SEARCH (The UI Saver)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300); // Wait 300ms after user stops typing
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // 3. PROCESSING TRIGGER
    const runProcess = useCallback(() => {
        // Use the DEBOUNCED query, not the raw one
        const result = matrixEngine.process(debouncedQuery, sortOrder);
        
        setVisualAssets(result.visuals);
        setDocumentAssets(result.docs);
        setGroupedVisuals(result.groups);
        setFlatLightboxList(result.visuals);
    }, [debouncedQuery, sortOrder]);

    useEffect(() => {
        runProcess();
    }, [runProcess]);

    return {
        searchQuery,
        setSearchQuery, // Binds to Input (Fast)
        sortOrder,
        setSortOrder,
        visualAssets,
        documentAssets,
        groupedVisuals,
        flatLightboxList,
        isIndexing: false,
        isExactSearch: false,
        setIsExactSearch: (v: boolean) => {}
    };
};