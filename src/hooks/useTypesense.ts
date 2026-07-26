import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs } from '../services/sovereignDbAdapter';

// Cache to hold media documents so we don't query MongoDB on every single keystroke
const mediaCache: Record<string, any[]> = {};

export const useTypesense = (queryText: string, userId?: string, targetCollection: 'media' | 'pending_accessions' = 'media') => {
    const [matchingIds, setMatchingIds] = useState<Set<string> | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        // If query is empty, return NULL (Signal to show "All")
        if (!queryText.trim()) {
            setMatchingIds(null);
            setIsSearching(false);
            return;
        }

        if (!userId) {
            setMatchingIds(new Set());
            return;
        }

        const performSearch = async () => {
            setIsSearching(true);
            console.time(`Local Search: "${queryText}"`);

            try {
                // 1. Ensure we have the user's media hydrated in the cache
                const cacheKey = `${userId}_${targetCollection}`;
                if (!mediaCache[cacheKey]) {
                    const db = getFirestore();
                    const mediaRef = collection(db, 'users', userId, targetCollection);
                    const snapshot = await getDocs(mediaRef);
                    mediaCache[cacheKey] = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                }

                const userMedia = mediaCache[cacheKey];
                const lowerCaseQuery = queryText.toLowerCase().trim();

                // 2. Execute local keyword matching
                const ids = new Set<string>();

                // Parse query into included and excluded terms
                const includeTerms: string[] = [];
                const excludeTerms: string[] = [];

                let remainingQuery = lowerCaseQuery;

                // 1. Extract exact quoted phrases ("my black cat")
                const exactPhraseRegex = /"([^"]+)"/g;
                let match;
                while ((match = exactPhraseRegex.exec(remainingQuery)) !== null) {
                    if (match[1].trim()) {
                        includeTerms.push(match[1].trim());
                    }
                }

                // Remove the quoted phrases from the remaining string to avoid double-processing
                remainingQuery = remainingQuery.replace(exactPhraseRegex, '').trim();

                // 2. Process remaining loose terms
                const looseTerms = remainingQuery.split(/\s+/).filter(Boolean);
                looseTerms.forEach(term => {
                    const cleanTerm = term.replace(/["']/g, ''); // Strip any stray, unmatched quotes
                    if (cleanTerm.startsWith('-') && cleanTerm.length > 1) {
                        excludeTerms.push(cleanTerm.substring(1));
                    } else if (cleanTerm) {
                        includeTerms.push(cleanTerm);
                    }
                });

                for (const item of userMedia) {
                    const tagIds = Array.isArray(item.tagIds) ? item.tagIds.map((t: any) => t.toLowerCase()) : [];
                    const rawDate = item.logicalDate || item.uploadDate || item.dateAdded || '';
                    let parsedYear = item.year;
                    let parsedMonth = '';
                    
                    if (rawDate) {
                        let dateObj: Date | null = null;
                        if (typeof rawDate === 'object' && typeof rawDate.toDate === 'function') {
                            dateObj = rawDate.toDate();
                        } else if (rawDate instanceof Date) {
                            dateObj = rawDate;
                        } else if (typeof rawDate === 'string' && rawDate.length > 4) {
                            const d = new Date(rawDate);
                            if (!isNaN(d.getTime())) dateObj = d;
                            else if (!parsedYear) parsedYear = parseInt(rawDate.substring(0, 4));
                        }

                        if (dateObj) {
                            if (!parsedYear) parsedYear = dateObj.getFullYear();
                            parsedMonth = dateObj.toLocaleString('default', { month: 'long' });
                        }
                    }

                    const searchableContent = [
                        (item.title || ''),
                        (item.originalName || ''),
                        (item.description || ''),
                        (item.caption || ''),
                        (item.triage?.summary || ''),
                        (parsedYear || '').toString(),
                        parsedMonth.toLowerCase(),
                        ...tagIds
                    ].join(' ').toLowerCase();

                    // Compile regex for robust prefix matching
                    const matchPattern = (term: string) => {
                        try {
                            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            // [ZEN] Enforce both leading and trailing non-alphanumeric boundaries (to handle underscores in filenames)
                            const regex = new RegExp(`(^|[^a-z0-9])${escapedTerm}([^a-z0-9]|$)`, 'i');
                            return regex.test(searchableContent);
                        } catch {
                            return searchableContent.includes(term);
                        }
                    };

                    // Must contain all includeTerms
                    const matchesIncludes = includeTerms.length === 0 || includeTerms.every(term => matchPattern(term));
                    if (!matchesIncludes) continue;

                    // Must NOT contain any excludeTerms
                    const matchesExcludes = excludeTerms.length > 0 && excludeTerms.some(term => matchPattern(term));
                    if (matchesExcludes) continue;

                    ids.add(item.id);
                }

                console.timeEnd(`Local Search: "${queryText}"`);
                setMatchingIds(ids);
            } catch (err) {
                console.error("[SovereignSearch] Local search matching failed:", err);
                setMatchingIds(new Set());
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(performSearch, 300);
        return () => clearTimeout(timer);
    }, [queryText, userId, targetCollection]);

    const invalidateCache = () => {
        if (userId) {
            delete mediaCache[`${userId}_media`];
            delete mediaCache[`${userId}_pending_accessions`];
        }
    };

    return { matchingIds, isSearching, invalidateCache };
};