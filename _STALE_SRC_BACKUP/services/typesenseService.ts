import Typesense from 'typesense';
import type { Media } from '@/types';

// [ZEN] Typesense Client Configuration
// Using the Admin Key to allow 'upsert' operations from the client.
// NOTE: In a multi-user production app, this key should be hidden behind a Cloud Function.
// For this Personal Archive, direct client access provides the fastest "Zen" feedback loop.
const ADMIN_KEY = 'ygfJJTAGaGfvWOoCIGxEk16CVxYr8h6D';
const HOST = 'u3sc4eka1lib0qnhp-1.a1.typesense.net';
const SCHEMA_NAME = 'media_v1';

const client = new Typesense.Client({
    nodes: [{
        host: HOST,
        port: 443,
        protocol: 'https'
    }],
    apiKey: ADMIN_KEY,
    connectionTimeoutSeconds: 5
});

export const typesenseService = {
    /**
     * Pushes a media record to Typesense Cloud.
     * Uses 'upsert' to insert if new or update if existing.
     */
    async updateMedia(media: Media) {
        try {
            // Standardize Timestamp (match indexToTypesense logic)
            let ts = 0;
            if (media.logicalDate) {
                ts = new Date(media.logicalDate).getTime();
            } else if ((media as any).dateAdded?.toMillis) {
                ts = (media as any).dateAdded.toMillis();
            } else if (media.uploadDate) {
                ts = new Date(media.uploadDate).getTime();
            }

            // Construct the Document
            // Must match the Schema fields defined in indexToTypesense.ts
            const document = {
                id: media.id,
                title: media.title || '',
                description: media.description || '',
                originalName: media.originalName || '',
                tags: media.tagIds || [], // Typesense stores the ID array for filtering
                year: media.year ? String(media.year) : '',
                type: media.fileType?.startsWith('video') ? 'video' : 'image',
                timestamp: ts
            };

            await client.collections(SCHEMA_NAME).documents().upsert(document);
            console.log(`[Typesense] ⚡ Synced: ${media.id}`);
        } catch (error) {
            console.error("[Typesense] Sync Failed:", error);
        }
    },

    /**
     * Removes a record from the search index.
     */
    async deleteMedia(mediaId: string) {
        try {
            await client.collections(SCHEMA_NAME).documents(mediaId).delete();
            console.log(`[Typesense] 🗑️ Deleted: ${mediaId}`);
        } catch (error) {
            console.error("[Typesense] Delete Failed:", error);
        }
    }
};