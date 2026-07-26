import { useMemo } from 'react';
import { Media } from '@/types';

export const useSimpleSearch = (assets: Media[], query: string) => {
    
    const results = useMemo(() => {
        const trimmedQuery = query.trim().toLowerCase();
        
        if (!trimmedQuery) return [];
        if (!assets || assets.length === 0) return [];

        // console.time("Search");
        
        const matches = assets.filter(asset => {
            // Build haystack on fly - cheapest method for <10k items
            // because memory allocation is transient (garbage collected efficiently)
            const haystack = [
                asset.title,
                asset.originalName,
                asset.description,
                asset.caption,
                asset.year,
                asset.fileType,
                asset.tagIds ? asset.tagIds.join(' ') : ''
            ].join(' ').toLowerCase();

            return haystack.includes(trimmedQuery);
        });

        // console.timeEnd("Search");
        return matches;

    }, [assets, query]); // Stable dependency 'assets' prevents loops

    return { results };
};