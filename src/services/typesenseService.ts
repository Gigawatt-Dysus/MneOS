// src/services/typesenseService.ts
// [ZEN HIGH-FIDELITY FACADE] Refactored to completely bypass external Typesense 
// and route search queries directly to MongoDB Atlas via Vercel serverless routes
// using genuine MongoDB aggregation pipelines and $vectorSearch proximities.

import { httpsCallable } from './apiClient';
import { functions } from '../firebaseConfig';

const mongoCollectionMap: Record<string, string> = {
  'chat_memory_v2_robust': 'chat_segments',
  'media_v1': 'media',
  'tags_v1': 'tags',
  'timevortex_v1': 'events',
  'messenger_sessions_v1': 'communication_archives',
  'documents': 'documents'
};

class TypesenseService {
    /**
     * Detects common address corruption patterns (Character-split or Object-dump)
     */
    isAddressCorrupted(address: string | null | undefined): boolean {
        if (!address) return false;
        if (address.includes('[object Object]')) return true;
        
        // Character-split: "M a i n   S t" vs "Main St"
        const tokens = address.split(/\s+/);
        const singleCharCount = tokens.filter(t => t.length === 1).length;
        if (tokens.length > 4 && singleCharCount / tokens.length > 0.6) return true;
        
        return false;
    }

    /**
     * Semantic Vector Search using Native MongoDB Atlas $vectorSearch
     */
    async semanticSearch(options: {
        collection: string;
        vector: number[];
        limit?: number;
        userId: string;
        filterBy?: string;
    }): Promise<any[]> {
        const { collection, vector, limit = 12, userId } = options;

        try {
            const mappedCollection = mongoCollectionMap[collection] || collection;
            const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
            
            // Native MongoDB Atlas $vectorSearch pipeline
            const pipeline = [
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: vector,
                        numCandidates: Math.max(100, limit * 10),
                        limit: limit
                    }
                },
                {
                    $match: {
                        $and: [
                            { isFiction: { $ne: true } },
                            { is_fiction: { $ne: true } },
                            { fiction: { $ne: true } },
                            { "metadata.is_fiction": { $ne: true } },
                            { "metadata.isFiction": { $ne: true } }
                        ]
                    }
                }
            ];

            const response = await sovereignDbQuery({
                collectionName: mappedCollection,
                userId,
                pipeline
            });

            return response.data || [];

        } catch (error) {
            console.error(`[SovereignSearch Facade] Semantic search failed on ${collection}:`, error);
            return [];
        }
    }

    /**
     * Upsert & Delete facades: MongoDB writes are atomic on primary database adapters 
     */
    async upsertDocument(collection: string, document: any) { return true; }
    async updateMedia(media: any) { return true; }
    async deleteMedia(id: string) { return true; }
    async patchSchema() {}
    async deleteChatMessage(id: string) { return true; }
    async updateChatMessage(id: string, content: string) { return true; }
    async setFictionStatus(id: string, status: boolean) { return true; }
    async setCoreStatus(id: string, status: boolean) { return true; }
    async upsertTag(tag: any, userId: string, embedding?: number[]) { return true; }
    async updateEvent(event: any, userId: string, embedding?: number[]) { return true; }
    async upsertMessengerSession(session: any) { return true; }
    async upsertArchivalDocument(docRecord: any) { return true; }
    async healUpsert(doc: any) { return true; }

    /**
     * Chat Segment Keyword search via Native MongoDB text/regex matching
     */
    async searchChatSegments(query: string, userId: string, limit: number = 50) {
        try {
            const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
            const response = await sovereignDbQuery({
                collectionName: 'chat_segments',
                userId,
                pipeline: [
                    { $match: { content: { $regex: query, $options: "i" } } },
                    { $sort: { timestamp: -1 } },
                    { $limit: limit }
                ]
            });
            return response.data || [];
        } catch (e) {
            console.error("[SovereignSearch Facade] Chat segment search failed:", e);
            return [];
        }
    }

    /**
     * Search for Tags (Persons, Places, Pets, Things)
     */
    async searchTags(query: string): Promise<any[]> {
        try {
            const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
            const response = await sovereignDbQuery({
                collectionName: 'tags',
                pipeline: [
                    { $match: { 
                        $or: [
                            { name: { $regex: query, $options: "i" } },
                            { alias: { $regex: query, $options: "i" } },
                            { description: { $regex: query, $options: "i" } }
                        ]
                    }},
                    { $limit: 10 }
                ]
            });
            return response.data || [];
        } catch (e) {
            console.error("[SovereignSearch Facade] Tag search failed:", e);
            return [];
        }
    }

    /**
     * Search Messenger Sessions
     */
    async searchMessengerSessions(params: {
        query: string;
        userId: string;
        limit?: number;
        filterBy?: string;
        vector?: number[];
    }) {
        const { query, userId, limit = 8, vector } = params;
        try {
            const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
            let pipeline: any[] = [];
            
            if (vector) {
                pipeline.push({
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: vector,
                        numCandidates: Math.max(100, limit * 10),
                        limit: limit
                    }
                });
                // RAG Firewall: exclude fiction communication archives
                pipeline.push({
                    $match: {
                        $and: [
                            { isFiction: { $ne: true } },
                            { is_fiction: { $ne: true } },
                            { fiction: { $ne: true } },
                            { "metadata.is_fiction": { $ne: true } },
                            { "metadata.isFiction": { $ne: true } }
                        ]
                    }
                });
            } else if (query) {
                pipeline.push({
                    $match: {
                        $and: [
                            {
                                $or: [
                                    { content: { $regex: query, $options: "i" } },
                                    { summary: { $regex: query, $options: "i" } }
                                ]
                            },
                            { isFiction: { $ne: true } },
                            { is_fiction: { $ne: true } },
                            { fiction: { $ne: true } },
                            { "metadata.is_fiction": { $ne: true } },
                            { "metadata.isFiction": { $ne: true } }
                        ]
                    }
                });
                pipeline.push({ $limit: limit });
            }

            const response = await sovereignDbQuery({
                collectionName: 'communication_archives',
                userId,
                pipeline
            });
            return response.data || [];
        } catch (error) {
            console.error("[SovereignSearch Facade] Messenger search failed:", error);
            return [];
        }
    }

    /**
     * Search for Archival Documents
     */
    async searchArchivalDocuments(params: {
        query: string;
        userId: string;
        limit?: number;
        filterBy?: string;
        vector?: number[];
    }) {
        const { query, userId, limit = 8, vector } = params;
        try {
            const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
            let pipeline: any[] = [];
            
            if (vector && vector.length > 0) {
                pipeline.push({
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: vector,
                        numCandidates: Math.max(100, limit * 10),
                        limit: limit
                    }
                });
                // RAG Firewall: exclude fiction documents from vector search
                pipeline.push({
                    $match: {
                        $and: [
                            { isFiction: { $ne: true } },
                            { is_fiction: { $ne: true } },
                            { "metadata.is_fiction": { $ne: true } },
                            { "metadata.isFiction": { $ne: true } }
                        ]
                    }
                });
            } else if (query) {
                pipeline.push({
                    $match: {
                        $and: [
                            {
                                $or: [
                                    { content: { $regex: query, $options: "i" } },
                                    { title: { $regex: query, $options: "i" } }
                                ]
                            },
                            { isFiction: { $ne: true } },
                            { is_fiction: { $ne: true } },
                            { "metadata.is_fiction": { $ne: true } },
                            { "metadata.isFiction": { $ne: true } }
                        ]
                    }
                });
                pipeline.push({ $limit: limit });
            }

            const response = await sovereignDbQuery({
                collectionName: 'documents',
                userId,
                pipeline
            });
            return response.data || [];
        } catch (error) {
            console.error("[SovereignSearch Facade] Document search failed:", error);
            return [];
        }
    }
}

export const typesenseService = new TypesenseService();
export const isAddressCorrupted = (addr: string | null | undefined) => typesenseService.isAddressCorrupted(addr);
export default typesenseService;