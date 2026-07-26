import { Media } from '../types';

// Fast Date Sorter
const getTimestamp = (input: any): number => {
    if (!input) return 0;
    if (typeof input === 'number') return input;
    if (input instanceof Date) return input.getTime();
    if (input && typeof input.toDate === 'function') return input.toDate().getTime();
    return Date.parse(input) || 0;
};

// Zero-Allocation Levenshtein (Fixed Types)
const levenshtein = (s: string, t: string): number => {
    if (s === t) return 0;
    const n = s.length;
    const m = t.length;
    if (n === 0) return m;
    if (m === 0) return n;
    if (Math.abs(n - m) > 2) return 100; // Optimization

    let x = 0;
    let y = 0;
    // [ZEN FIX] Explicitly type the array to prevent TS7022
    const vector: number[] = [];
    
    for (y = 0; y <= n; y++) vector[y] = y;

    for (x = 1; x <= m; x++) {
        // [ZEN FIX] Explicitly type prev
        let prev: number = vector[0];
        vector[0] = x;
        for (y = 1; y <= n; y++) {
            const temp = vector[y];
            const cost = s.charAt(y - 1) === t.charAt(x - 1) ? 0 : 1;
            vector[y] = Math.min(vector[y] + 1, vector[y - 1] + 1, prev + cost);
            prev = temp;
        }
    }
    return vector[n];
};

export class MatrixEngine {
    private assets: Media[] = [];
    private cache: { 
        id: string; 
        fullText: string;  
        shortText: string; 
    }[] = [];
    
    private signature: string = "";

    constructor() {
        console.log("[MatrixEngine] Initialized (Linear Turbo).");
    }

    public load(newAssets: Media[]): boolean {
        if (!newAssets || newAssets.length === 0) return false;

        const first = newAssets[0]?.id || 'x';
        const last = newAssets[newAssets.length - 1]?.id || 'y';
        const newSig = `${newAssets.length}-${first}-${last}`;

        if (this.signature === newSig) return false;

        console.time("Engine:Load");
        this.assets = newAssets;
        this.signature = newSig;

        // Build Cache
        this.cache = this.assets.map(asset => {
            const tags = asset.tagIds ? asset.tagIds.join(' ') : '';
            const title = asset.title || '';
            const originalName = asset.originalName || '';
            const year = asset.year ? String(asset.year) : '';

            return {
                id: asset.id,
                fullText: [
                    title,
                    originalName,
                    asset.description || '',
                    asset.caption || '',
                    year,
                    asset.fileType || '',
                    tags
                ].join(' ').toLowerCase(),
                shortText: [title, tags, originalName, year].join(' ').toLowerCase()
            };
        });

        console.timeEnd("Engine:Load");
        return true;
    }

    public process(query: string, sortOrder: 'asc' | 'desc') {
        // A. SEARCH
        let resultIds: Set<string> | null = null;
        
        if (query.trim()) {
            const terms = query.toLowerCase().trim().split(/\s+/);
            resultIds = new Set();
            let matchesFound = 0;

            for (const item of this.cache) {
                // Check if ALL terms match (AND logic)
                const isMatch = terms.every(term => {
                    // 1. Exact Match
                    if (item.fullText.includes(term)) return true;
                    
                    // 2. Fuzzy Match (Only high-value short text)
                    if (term.length > 3) {
                        const words = item.shortText.split(/\s+/);
                        for (const word of words) {
                            if (Math.abs(word.length - term.length) > 2) continue;
                            if (levenshtein(term, word) <= 1) return true;
                        }
                    }
                    return false;
                });

                if (isMatch) {
                    resultIds.add(item.id);
                    matchesFound++;
                }

                if (matchesFound >= 500) break;
            }
        }

        // B. FILTER & GROUP
        const visuals: Media[] = [];
        const docs: Media[] = [];
        const groups: Record<string, Media[]> = {};

        for (const asset of this.assets) {
            if (resultIds && !resultIds.has(asset.id)) continue;

            const type = asset.fileType?.toLowerCase() || '';
            const isVisual = type.includes('image') || type.includes('video');

            if (isVisual) {
                visuals.push(asset);
                const ts = getTimestamp(asset.logicalDate);
                const date = new Date(ts);
                const key = isNaN(ts) ? "Unknown Date" : date.toDateString();
                if (!groups[key]) groups[key] = [];
                groups[key].push(asset);
            } else {
                docs.push(asset);
            }
        }

        // C. SORT
        visuals.sort((a, b) => {
            const tA = getTimestamp(a.logicalDate);
            const tB = getTimestamp(b.logicalDate);
            return sortOrder === 'asc' ? tA - tB : tB - tA;
        });

        // D. FORMAT GROUPS
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
            visuals,
            docs,
            groups: groupArray
        };
    }
}

export const matrixEngine = new MatrixEngine();