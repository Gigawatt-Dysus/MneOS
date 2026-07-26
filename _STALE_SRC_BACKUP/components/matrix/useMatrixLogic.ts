import { useState, useMemo, useEffect } from 'react';
import type { Media } from '@/types';

// Local helper for sorting
const getTimestamp = (input: any): number => {
    if (!input) return 0;
    if (typeof input === 'number') return input;
    if (input instanceof Date) return input.getTime();
    if (input && typeof input.toDate === 'function') return input.toDate().getTime();
    return Date.parse(input) || 0;
};

const PAGE_SIZE = 50;

interface UseMatrixLogicProps {
    assets: Media[];
    matchingIds: Set<string> | null;
    isSearching: boolean;
    searchQuery: string;
    sortOrder: 'asc' | 'desc';
}

export const useMatrixLogic = ({ assets, matchingIds, isSearching, searchQuery, sortOrder }: UseMatrixLogicProps) => {
    const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [debouncedQuery, sortOrder]);

    const isUserTyping = searchQuery !== debouncedQuery;
    const hasActiveQuery = searchQuery.length > 0;
    const isWaitingForResults = hasActiveQuery && (isUserTyping || isSearching || !matchingIds);

    const { visualAssets, documentAssets, groupedVisuals, flatLightboxList, totalVisualCount } = useMemo(() => {
        let sourceList: Media[] = [];

        // [ZEN FIX] UPDATED PRE-FILTER
        // Now checks for the Boolean Flag OR the "avatar_" naming convention
        const cleanAssets = (assets || []).filter(a => {
            // 1. Check strict flag
            if ((a as any).isAvatar === true) return false;
            
            // 2. Check Naming Convention (Case insensitive)
            const title = (a.title || '').toLowerCase();
            const filename = (a.originalName || '').toLowerCase();
            
            if (title.startsWith('avatar_')) return false;
            if (filename.startsWith('avatar_')) return false;
            
            return true;
        });

        // A. Source Selection
        if (hasActiveQuery && matchingIds && !isWaitingForResults) {
            sourceList = cleanAssets.filter(a => matchingIds.has(a.id));
        } else {
            sourceList = cleanAssets;
        }

        // B. Sort
        const sorted = [...sourceList].sort((a, b) => {
            const tA = getTimestamp(a.logicalDate);
            const tB = getTimestamp(b.logicalDate);
            return sortOrder === 'asc' ? tA - tB : tB - tA;
        });

        // C. Split Types
        const visuals: Media[] = [];
        const docs: Media[] = [];
        
        for (const asset of sorted) {
            const type = asset.fileType?.toLowerCase() || '';
            const isVisual = type.includes('image') || type.includes('video');
            if (isVisual) visuals.push(asset);
            else docs.push(asset);
        }

        // D. Pagination
        const visibleVisuals = isWaitingForResults ? [] : visuals.slice(0, visibleCount);

        // E. Grouping
        const groups: Record<string, Media[]> = {};
        for (const asset of visibleVisuals) {
            const ts = getTimestamp(asset.logicalDate);
            const date = new Date(ts);
            const key = isNaN(ts) ? "Unknown Date" : date.toDateString();
            if (!groups[key]) groups[key] = [];
            groups[key].push(asset);
        }

        const groupArray = Object.entries(groups).map(([title, groupAssets]) => {
            const d = new Date(title);
            return {
                title,
                dateKey: isNaN(d.getTime()) ? 0 : d.getTime(),
                assets: groupAssets
            };
        });

        groupArray.sort((a, b) => b.dateKey - a.dateKey);

        return {
            visualAssets: visibleVisuals,
            documentAssets: docs,
            groupedVisuals: groupArray,
            flatLightboxList: visuals, 
            totalVisualCount: visuals.length
        };
    }, [assets, matchingIds, sortOrder, isWaitingForResults, hasActiveQuery, visibleCount]);

    return {
        debouncedQuery,
        isWaitingForResults,
        visualAssets,
        documentAssets,
        groupedVisuals,
        flatLightboxList,
        totalVisualCount,
        visibleCount,
        setVisibleCount,
        PAGE_SIZE
    };
};