import type { ChatMessage } from '../types';
import { getReserveModelId } from './ai/config';
import { sanitizeContent } from '../utils/textUtils';
import { httpsCallable } from './apiClient';
import { functions } from '../firebaseConfig';

// [ZEN CONFIG] THE ULTIMATE STOP LIST
const STOP_WORDS = new Set([
    "a", "about", "above", "after", "again", "am", "an", "and", "any", "are", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
    "can", "did", "do", "does", "doing", "don", "down", "during", "each", "few", "for",
    "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "i", "im", "if", "in", "into", "is", "it", "its", "itself",
    "just", "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off",
    "on", "once", "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own",
    "s", "same", "she", "should", "so", "some", "such", "t", "than", "that", "the", "their",
    "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those",
    "through", "to", "too", "under", "until", "up", "very", "was", "we", "were", "what",
    "when", "where", "which", "while", "who", "whom", "why", "will", "with", "you", "your",
    "yours", "yourself", "yourselves",
    "hey", "hello", "hi", "ok", "okay", "actually", "basically", "literally",
    "remember", "recall", "guess", "maybe", "like", "yeah", "yep", "nope"
]);

export const resetTypesenseClient = () => {
    console.log("[SearchService] 🔄 Typesense Client deprecated. Native MongoDB Atlas online.");
};

export const MEMORY_COLLECTION = 'chat_memory_v2_robust';

const expandQueryWithAI = async (rawQuery: string): Promise<string> => {
    try {
        if (rawQuery.split(' ').length < 4) return rawQuery;
        const { callXAI } = await import('./ai/providers');
        const modelId = getReserveModelId();
        const prompt = `TASK: Extract 3-5 keywords from the user's query to optimize search: "${rawQuery}"\nRETURN ONLY THE KEYWORDS, COMMA SEPARATED.`;
        const result = await callXAI(modelId, [{ role: 'user', parts: [{ text: prompt }] }], "");
        return result.text.trim();
    } catch (e) {
        console.error("[SearchAI] Expansion failed:", e);
        return rawQuery;
    }
};

const extractKeywords = (query: string): string => {
    const clean = query.toLowerCase().replace(/[?.,!;"'()]/g, '');
    const words = clean.split(/\s+/);
    const keywords = words.filter(w => (!STOP_WORDS.has(w) && w.length > 2) || !isNaN(Number(w)));
    if (keywords.length === 0) return clean;
    return [...new Set(keywords)].join('|'); // Pipeline friendly OR syntax for regex
};

// [ZEN ARCHITECTURE] Typesense Sync Excision
export const initMemoryStore = async () => {};
export const indexMessage = async (msg: ChatMessage, msgId: string, userId?: string) => {};
export const purgeUserMemory = async (userId: string): Promise<{ success: boolean, count: number }> => { return { success: true, count: 0 }; };
export const reindexChatSegments = async (userId: string, purgeFirst: boolean = false): Promise<{ success: boolean, count: number, error?: string }> => { return { success: true, count: 0 }; };

export interface SearchResult {
    id: string;
    content: string;
    timestamp: number;
    tags: string[];
    isCore: boolean;
    score?: number;
}

export const searchChatMemory = async (originalQuery: string, userId: string, filterOptions?: { isFiction?: boolean }): Promise<SearchResult[]> => {
    try {
        const aiExpandedQuery = await expandQueryWithAI(originalQuery);
        const optimizedRegex = extractKeywords(aiExpandedQuery);

        const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
        
        // [ZEN ARCHITECTURE] Genuine MongoDB Atlas Aggregation Pipeline
        const pipeline: any[] = [
            { 
                $match: { 
                    $and: [
                        { content: { $regex: optimizedRegex, $options: "i" } },
                        { isFiction: { $ne: true } },
                        { is_fiction: { $ne: true } },
                        { fiction: { $ne: true } }
                    ]
                } 
            },
            { $sort: { timestamp: -1 } },
            { $limit: 20 }
        ];

        const response = await sovereignDbQuery({
            collectionName: 'chat_segments',
            userId,
            pipeline
        });

        const data: any = response.data || [];
        const uniqueResults: SearchResult[] = [];
        const seen = new Set<string>();

        data.forEach((doc: any) => {
            if (!seen.has(doc.id)) {
                seen.add(doc.id);

                const memoryType = doc.is_core ? "CORE MEMORY" : (doc.fiction ? "FICTION/CREATIVE" : "REAL CONVERSATION");
                const islandTag = doc.island_id ? `[ISLAND: ${doc.island_id.toUpperCase()}]` : "[UNASSOCIATED]";
                const dateStr = new Date(doc.timestamp).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric'
                });

                let contextBlock = `--- MEMORY START ---\n`;
                contextBlock += `ID: ${doc.id}\nDATE: ${dateStr}\nTYPE: ${memoryType}\nLOCATION: ${islandTag}\n`;
                if (doc.title) contextBlock += `TOPIC: ${doc.title}\n`;
                if (doc.summary) contextBlock += `SUMMARY: ${doc.summary}\n`;
                if (doc.emotional_state) contextBlock += `EMOTIONAL STATE: ${doc.emotional_state}\n`;
                if (doc.subtext_analysis) contextBlock += `COGNITIVE SUBTEXT: "${doc.subtext_analysis}"\n`;
                contextBlock += `CONTENT:\n"${doc.content}"\n--- MEMORY END ---\n`;

                uniqueResults.push({
                    id: doc.id,
                    content: contextBlock,
                    timestamp: doc.timestamp,
                    tags: doc.keywords || [],
                    isCore: doc.is_core || false
                });
            }
        });

        return uniqueResults;
    } catch (e: any) {
        console.error("[SearchService] CRITICAL SEARCH FAILURE:", e.message);
        return [];
    }
};

export const searchDaydreams = async (originalQuery: string, userId: string): Promise<SearchResult[]> => {
    try {
        const aiExpandedQuery = await expandQueryWithAI(originalQuery);
        const optimizedRegex = extractKeywords(aiExpandedQuery);

        const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
        const response = await sovereignDbQuery({
            collectionName: 'daydream_stories',
            userId,
            pipeline: [
                { $match: { 
                    $or: [
                        { content: { $regex: optimizedRegex, $options: "i" } },
                        { title: { $regex: optimizedRegex, $options: "i" } }
                    ]
                }},
                { $sort: { timestamp: -1 } },
                { $limit: 20 }
            ]
        });

        const data: any = response.data || [];
        return data.map((d: any) => {
            let contentPreview = d.content || '';
            if (contentPreview.length > 500) contentPreview = contentPreview.substring(0, 500) + "...";
            return {
                id: d.id,
                content: `[DAYDREAM FOUND] Title: ${d.title} | ID: ${d.id}\nContent: "${contentPreview}"`,
                timestamp: d.timestamp || Date.now(),
                tags: d.tags || [],
                isCore: false
            };
        });
    } catch (e) {
        console.error("Daydream Search Failed", e);
        return [];
    }
};

export const searchTimeline = async (originalQuery: string, userId: string): Promise<SearchResult[]> => {
    try {
        const aiExpandedQuery = await expandQueryWithAI(originalQuery);
        const optimizedRegex = extractKeywords(aiExpandedQuery);

        const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
        const response = await sovereignDbQuery({
            collectionName: 'events',
            userId,
            pipeline: [
                { $match: { 
                    $or: [
                        { details: { $regex: optimizedRegex, $options: "i" } },
                        { description: { $regex: optimizedRegex, $options: "i" } },
                        { title: { $regex: optimizedRegex, $options: "i" } }
                    ]
                }},
                { $sort: { date: -1 } },
                { $limit: 20 }
            ]
        });

        const data: any = response.data || [];
        return data.map((d: any) => {
            const date = new Date(d.date).toLocaleDateString();
            return {
                id: d.id,
                content: `[LIFE EVENT FOUND] Date: ${date} | Title: ${d.title}\nDetails: "${d.description || d.details || ''}"`,
                timestamp: d.date,
                tags: d.tags || [],
                isCore: false
            };
        });
    } catch (e) {
        console.error("Timeline Search Failed", e);
        return [];
    }
};
export const alignCognitiveVectors = async (text: string, userId: string): Promise<any[]> => { return []; };


export const reindexGlobal = async (userId: string): Promise<any> => { return { success: true }; };
export const hydrateUserFullProfile = async (userId: string): Promise<any> => { return {}; };


export const reindexAllTags = async (userId: string): Promise<any> => { return { success: true }; };
export const reindexMedia = async (userId: string): Promise<any> => { return { success: true }; };
export const reindexDaydreams = async (userId: string): Promise<any> => { return { success: true }; };
export const reindexEvents = async (userId: string): Promise<any> => { return { success: true }; };

// [ZEN] Sovereign Vector Search for Takeout Media (113k Atlas records)
export const searchTakeoutMedia = async (query: string, userId: string): Promise<SearchResult[]> => {
    try {
        const { getEmbedding } = await import('./ai/providers');
        
        // 1. Generate local 1024-dim embedding via Python MoE Server
        const queryVector = await getEmbedding(query);
        
        if (!queryVector) {
            console.error("[SearchService] ⚠️ Failed to generate embedding. Is the Python vector_server running on port 5005?");
            return [];
        }

        // 2. Fire to Vercel Serverless Endpoint for MongoDB Atlas Vector Search
        // Note: Using standard fetch since this is an /api route, not a Firebase Function
        const token = (window as any).Clerk?.session?.getToken ? await (window as any).Clerk.session.getToken() : null;
        
        const response = await fetch('/api/sovereignSearch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                collectionName: 'takeout_media',
                userId,
                queryText: query,
                queryVector,
                limit: 15
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${err.error || response.statusText}`);
        }

        const data = await response.json();
        const results = data.data || [];

        return results.map((d: any) => {
            return {
                id: d.hash || d.id || String(Math.random()),
                hash: d.hash,
                filepath: d.filepath,
                caption: d.caption || d.description || 'None',
                grokEnhanced: d.grokEnhanced || false,
                content: `[TAKEOUT ARCHIVE] ${d.filename}\nPath: ${d.filepath}\nSize: ${(d.size / 1024 / 1024).toFixed(2)} MB\nCaption: ${d.caption || d.description || 'None'}\nGrok Enhanced: ${d.grokEnhanced ? 'Yes' : 'No'}`,
                timestamp: Date.now(),
                tags: d.tags || [],
                isCore: false,
                score: d.score
            };
        });
    } catch (e) {
        console.error("Takeout Media Search Failed", e);
        return [];
    }
};


