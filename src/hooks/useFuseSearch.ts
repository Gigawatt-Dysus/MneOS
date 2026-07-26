import { useState, useMemo, useEffect } from 'react';
import Fuse from 'fuse.js';
import { Media } from '../types';

export const useFuseSearch = (assets: Media[]) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Media[]>([]);
    
    // 1. CONFIGURE FUSE (The Engine)
    const fuse = useMemo(() => {
        if (!assets || assets.length === 0) return null;

        return new Fuse(assets, {
            keys: [
                { name: 'title', weight: 2 },        // Title matches are most important
                { name: 'tagIds', weight: 2 },       // Tags are equally important
                { name: 'description', weight: 1 },
                { name: 'originalName', weight: 1 },
                { name: 'caption', weight: 1 },
                { name: 'year', weight: 0.5 },
                { name: 'fileType', weight: 0.5 }
            ],
            threshold: 0.3, // 0.0 = Perfect match, 1.0 = Match anything. 0.3 is good fuzziness.
            ignoreLocation: true, // Search anywhere in the string
            useExtendedSearch: true // Allows logical operators if we need them later
        });
    }, [assets]); // Only rebuilds if the raw data changes

    // 2. EXECUTE SEARCH
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        if (!fuse) return;

        console.time("FuseSearch");
        // execute search
        const fuseResults = fuse.search(query);
        console.timeEnd("FuseSearch");

        // Map back to original items
        // LIMIT TO 500 ITEMS to prevent rendering crashes
        // If you have 2000 "cottage" photos, rendering them all at once kills the DOM.
        const topResults = fuseResults
            .slice(0, 500) 
            .map(result => result.item);

        setResults(topResults);
    }, [query, fuse]);

    return {
        results,
        search: setQuery
    };
};