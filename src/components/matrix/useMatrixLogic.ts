import { useState, useMemo, useEffect } from 'react';
import type { Media } from '../../types';
import { filterSystemAssets } from './MatrixShared';
import { TEMPORAL_SHOEBOX_YEAR } from '../../types/constants';
import { formatLifeOSDate } from '../../utils/dateSanitizer';

// Local helper for sorting
const getTimestamp = (input: any): number => {
    if (!input) return 0;
    if (typeof input === 'number') return input;
    if (input instanceof Date) return input.getTime();
    if (input && typeof input.toDate === 'function') return input.toDate().getTime();
    return Date.parse(input) || 0;
};

const PAGE_SIZE = 150;

interface UseMatrixLogicProps {
    assets: Media[];
    matchingIds: Set<string> | null;
    isSearching: boolean;
    searchQuery: string;
    sortOrder: 'asc' | 'desc';
    initialMediaId?: string | null;
    showShoebox?: boolean; // [ZEN] New toggle for undated items
    showFictionalLore?: boolean; // [ZEN] Filter for Fictional items
    showRotationReviews?: boolean; // [ZEN] Filter for flagged rotations
    aiProvenanceFilter?: 'all' | 'gemini-2.5-flash' | 'grok-test' | 'gemini-test' | 'blank-metadata' | 'ai-processed' | 'inferred-dates'; // [ZEN] Filter by AI provenance
    activeBucketId?: string | null; // [ZEN] Filter by Silo
    showRawDailies?: boolean; // [ZEN] Toggle to show machine-recorded dates vs human logical dates
}

export const useMatrixLogic = ({ assets, matchingIds, isSearching, searchQuery, sortOrder, initialMediaId, showShoebox, showFictionalLore, showRotationReviews, aiProvenanceFilter, activeBucketId, showRawDailies }: UseMatrixLogicProps) => {
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

    const { sortedVisuals, sortedDocs, flatLightboxList, totalVisualCount } = useMemo(() => {
        let sourceList: Media[] = [];

        // [ZEN FIX] Use the aggressive global filter to ensure no system artifacts leak through,
        // EXCEPT when we are explicitly hunting for blank artifacts.
        let cleanAssets = filterSystemAssets(assets || [], aiProvenanceFilter === 'blank-metadata');
        
        // [ZEN] FICTIONAL LORE LOGIC
        // Isolate fictional items unless showFictionalLore is true
        cleanAssets = cleanAssets.filter(a => {
            const isFictionalAsset = a.isFiction === true;
            return showFictionalLore ? isFictionalAsset : !isFictionalAsset;
        });

        // [ZEN] BUCKET / SILO LOGIC
        cleanAssets = cleanAssets.filter(a => {
            if (activeBucketId) return a.bucketId === activeBucketId;
            return !a.bucketId; // Global Matrix items have no bucketId
        });

        // [ZEN] SHOEBOX LOGIC
        // Filter out items from the Year 5000 (or undated items) from the main view, OR only show them if showShoebox is true
        cleanAssets = cleanAssets.filter(a => {
            const dateStr = typeof a.logicalDate === 'string' ? a.logicalDate : '';
            let parsedYear = a.year;
            if (!parsedYear && dateStr) {
                const match = dateStr.match(/^(\d{4})/);
                if (match) parsedYear = parseInt(match[1], 10);
            }
            const isShoeboxItem = !parsedYear || parsedYear === TEMPORAL_SHOEBOX_YEAR || dateStr.startsWith(TEMPORAL_SHOEBOX_YEAR.toString());
            return showShoebox ? isShoeboxItem : !isShoeboxItem;
        });

        // [ZEN] ROTATION REVIEW LOGIC
        // Isolate items flagged for manual rotation review
        cleanAssets = cleanAssets.filter(a => {
            const isReviewItem = a.orientation_flag === 'manual_review';
            return showRotationReviews ? isReviewItem : true;
        });

        // [ZEN] AI PROVENANCE FILTER LOGIC
        cleanAssets = cleanAssets.filter(a => {
            if (!aiProvenanceFilter || aiProvenanceFilter === 'all') return true;
            if (aiProvenanceFilter === 'gemini-2.5-flash') return (a as any).aiModel === 'gemini-2.5-flash';
            if (aiProvenanceFilter === 'grok-test') return (a as any).aiModel === 'grok-test' || (a as any).aiModel === 'grok-4.1-fast-test' || (a as any).aiGenerator === 'Grok 4.3 Vision';
            if (aiProvenanceFilter === 'gemini-test') return (a as any).aiModel === 'gemini-test' || (a as any).aiModel === 'gemini-3.1-pro' || (a as any).aiModel === 'gemini-3.1-flash-lite' || (a as any).aiModel === 'gemini-2.5-pro' || (a as any).aiGenerator === 'Gemini 3.1 Pro';
            if (aiProvenanceFilter === 'ai-processed') return a.aiProcessed === true;
            if (aiProvenanceFilter === 'inferred-dates') return (a as any).datePrecision === 'inferred';
            if (aiProvenanceFilter === 'blank-metadata') {
                const isBlank = (s: any) => !s || (typeof s === 'string' && s.trim() === '');
                return isBlank(a.description) && isBlank((a as any).narrative) && isBlank(a.caption) && isBlank((a as any).ai_description);
            }
            return true;
        });

        // Ensure the deep-link asset is always included even if it would be filtered
        if (initialMediaId) {
            const deepLinkAsset = (assets || []).find(a => a.id === initialMediaId);
            if (deepLinkAsset && !cleanAssets.find(a => a.id === initialMediaId)) {
                cleanAssets.push(deepLinkAsset);
            }
        }

        // A. Source Selection
        if (hasActiveQuery && matchingIds && !isWaitingForResults) {
            sourceList = cleanAssets.filter(a => matchingIds.has(a.id));
        } else {
            sourceList = cleanAssets;
        }

        // B. Sort
        const sorted = [...sourceList].sort((a, b) => {
            const dateStrA = showRawDailies ? ((a as any).uploadDate || (a as any).dateAdded || a.logicalDate) : a.logicalDate;
            const dateStrB = showRawDailies ? ((b as any).uploadDate || (b as any).dateAdded || b.logicalDate) : b.logicalDate;

            const tA = getTimestamp(dateStrA);
            const tB = getTimestamp(dateStrB);
            
            if (tA === tB) {
                // Secondary Sort: Fallback to actual creation/upload date for items with matching dates (e.g. Shoebox)
                // [ZEN FIX] Prioritize recently AI processed items so they bubble to the top of the grid, but EXCLUDE dateModified to prevent UI jumping during active editing.
                const addedA = getTimestamp((a as any).aiProcessedAt || (a as any).dateAdded || (a as any).uploadDate || 0);
                const addedB = getTimestamp((b as any).aiProcessedAt || (b as any).dateAdded || (b as any).uploadDate || 0);
                
                if (addedA !== addedB) {
                    return sortOrder === 'asc' ? addedA - addedB : addedB - addedA;
                }
                
                // Tertiary Sort (CRITICAL FORENSIC FIX): Deterministic tie-breaker to prevent UI grid shuffling.
                // If items have matching logical and creation dates, MongoDB may return them in non-deterministic order.
                // By forcing an ID string comparison, we guarantee the index array remains frozen and immune to pointer desyncs.
                return a.id.localeCompare(b.id);
            }
            
            return sortOrder === 'asc' ? tA - tB : tB - tA;
        });

        // C. Split Types
        const visuals: Media[] = [];
        const docs: Media[] = [];
        
        for (const asset of sorted) {
            const mediaType = asset.fileType?.toLowerCase() || '';
            let isVisual = mediaType.includes('image') || mediaType.includes('video');
            
            if (!isVisual) {
                const str = (asset.url || asset.originalName || '').toLowerCase();
                if (str.match(/\.(jpg|jpeg|png|gif|webp|svg|heic|mp4|mov|avi|webm|mkv)$/i)) {
                    isVisual = true;
                } else if (asset.thumbnailUrl || asset.thumbnailUrls) {
                    isVisual = true;
                } else if (asset.url || (asset as any).mediaUrl) {
                    isVisual = true; // [ZEN FIX] Ensure pending accessions with URLs aren't ghosted to Documents tab
                }
            }

            if (isVisual) visuals.push(asset);
            else docs.push(asset);
        }

        return {
            sortedVisuals: visuals,
            sortedDocs: docs,
            flatLightboxList: visuals, 
            totalVisualCount: visuals.length
        };
    }, [assets, matchingIds, sortOrder, isWaitingForResults, hasActiveQuery, showShoebox, showFictionalLore, showRotationReviews, aiProvenanceFilter, activeBucketId, showRawDailies, initialMediaId]);

    const { visualAssets, documentAssets, groupedVisuals } = useMemo(() => {
        // D. Pagination
        const visibleVisuals = isWaitingForResults ? [] : sortedVisuals.slice(0, visibleCount);

        // E. Grouping
        const groups: Record<string, { title: string, dateKey: number, assets: Media[] }> = {};
        for (const asset of visibleVisuals) {
            const dateStr = showRawDailies ? ((asset as any).uploadDate || (asset as any).dateAdded || asset.logicalDate) : asset.logicalDate;
            const ts = getTimestamp(dateStr);
            const date = new Date(ts);
            
            // [ZEN] Group by semantic precision. Downcast 'exact' to 'day' so they group together on the same day.
            let title = formatLifeOSDate(dateStr, asset.datePrecision === 'exact' ? 'day' : (asset.datePrecision || 'day'));
            
            // [ZEN] Shoebox Date Masking
            // If the year is 5000 (or 4999 due to local TZ offset), label it correctly for the user
            if (date.getFullYear() >= 4999) {
                title = "Temporal Shoebox (Undated)";
            }
            if (!title) title = "Unknown Date";

            if (!groups[title]) {
                groups[title] = {
                    title: title,
                    dateKey: isNaN(ts) ? 0 : ts,
                    assets: []
                };
            }
            groups[title].assets.push(asset);
        }

        const groupArray = Object.values(groups);

        groupArray.sort((a, b) => b.dateKey - a.dateKey);

        return {
            visualAssets: visibleVisuals,
            documentAssets: sortedDocs,
            groupedVisuals: groupArray
        };
    }, [sortedVisuals, sortedDocs, visibleCount, isWaitingForResults, showRawDailies]);

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