import { appDataService } from './serviceManager';
import type { Media, Tag } from '@/types';

export const CleanupService = {
    /**
     * Scans for "Zombie" Media. 
     * Any media item in the database with a URL starting with "blob:" is invalid 
     * after a page refresh. These must be purged.
     */
    scanForBrokenLinks: (allMedia: Media[]): Media[] => {
        if (!allMedia) return [];
        return allMedia.filter(m => m.url && m.url.startsWith('blob:'));
    },

    /**
     * Scans for Duplicates based on filename + type.
     * [SAFE MODE]: Ignores "image", "unknown", "download" to prevent false positives.
     */
    scanForDuplicates: (allMedia: Media[]): Media[] => {
        if (!allMedia) return [];
        
        const seen = new Set<string>();
        const duplicates: Media[] = [];

        // Sort by date added (oldest first) so we keep the original and flag the newer ones
        const sorted = [...allMedia].sort((a, b) => {
            const dateA = new Date(a.uploadDate || 0).getTime();
            const dateB = new Date(b.uploadDate || 0).getTime();
            return dateA - dateB;
        });

        for (const m of sorted) {
            const rawName = m.originalName ? m.originalName.trim().toLowerCase() : '';
            
            // [CRITICAL SAFETY] Skip generic names that cause mass false positives
            if (!rawName || rawName.length < 4 || rawName.includes('image') || rawName.includes('unknown') || rawName.includes('download')) {
                continue;
            }

            // Create a specific key: Name + FileType
            const key = `${rawName}::${m.fileType || 'unknown'}`;
            
            if (seen.has(key)) {
                // If we've seen this exact filename+type before, this is a dupe
                duplicates.push(m);
            } else {
                seen.add(key);
            }
        }

        return duplicates;
    },

    /**
     * NUCLEAR OPTION: Permanently deletes files. 
     * ONLY use this for 'broken' links that are 100% dead.
     */
    purgeMedia: async (userId: string, zombies: Media[]): Promise<number> => {
        let count = 0;
        for (const z of zombies) {
            try {
                console.log(`[Janitor] Deleting dead link ${z.id}...`);
                await appDataService.deleteMedia(userId, z.id);
                count++;
            } catch (e) {
                console.error(`[Janitor] Failed to delete ${z.id}`, e);
            }
        }
        return count;
    },

    /**
     * SAFE OPTION: Tags files for manual review.
     * Does NOT delete anything. It adds a "⚠️ Possible Duplicate" tag.
     */
    quarantineDuplicates: async (userId: string, duplicates: Media[], allTags: Tag[]): Promise<string> => {
        if (duplicates.length === 0) return "No duplicates to tag.";

        // 1. Find or Create the Safety Tag
        const tagName = "⚠️ Possible Duplicate";
        let reviewTag = allTags.find(t => t.name === tagName);
        
        if (!reviewTag) {
            const newTag: Tag = {
                id: `tag-system-review-${Date.now()}`,
                name: tagName,
                type: 'thing', 
                description: "System flagged potential duplicates for manual review.",
                keywords: ["system", "duplicate", "cleanup"],
                tagIds: [], 
                mainImageId: undefined,
                mediaIds: [],
                // [ZEN FIX] Base properties aligned with types.ts
                mediaGallery: [],
                privateNotes: "", // Fixed: Changed from [] to ""
                isPrivate: false,
                // [ZEN FIX] Cast metadata to any to satisfy 'ThingMetadata' requirements 
                metadata: {
                    acquisition: "System Scan",
                    status: "Review",
                    purpose: "Duplicate Quarantine"
                } as any
            };
            await appDataService.saveTag(userId, newTag);
            reviewTag = newTag;
        }

        // 2. Tag the Items
        let count = 0;
        for (const m of duplicates) {
            // Avoid double tagging
            if (!m.tagIds || !m.tagIds.includes(reviewTag.id)) {
                const currentTags = m.tagIds || [];
                const updated = { ...m, tagIds: [...currentTags, reviewTag.id] };
                await appDataService.saveMedia(userId, updated);
                count++;
            }
        }
        return `Flagged ${count} items. Look for the "${tagName}" tag in your Gallery.`;
    }
};