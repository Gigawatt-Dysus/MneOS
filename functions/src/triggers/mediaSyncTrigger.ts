import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import axios from 'axios';

// --- INITIALIZATION ---
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

/**
 * mediaSyncTrigger
 * [ZEN] The Limbic Weaver. Synchronizes Media, Tags, and Typesense Search.
 */
export const onMediaWritten = onDocumentWritten("users/{uid}/media/{mediaId}", async (event) => {
    const uid = event.params.uid;
    const mediaId = event.params.mediaId;
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();

    // 1. DELETE EVENT
    if (!afterData) {
        console.log(`[MediaSync] 🗑️ Detected deletion of ${mediaId}. Purging Tag links...`);
        if (beforeData?.tagIds) {
            await purgeMediaFromTags(uid, mediaId, beforeData.tagIds);
        }
        await deleteFromTypesense(uid, mediaId);
        return;
    }

    // 2. UPSERT EVENT (Create or Update)
    console.log(`[MediaSync] ⚡ Processing update for ${mediaId}...`);
    
    // Sync to Typesense (The 2010 Fix)
    await syncToTypesense(uid, { ...afterData, id: mediaId });

    // Heal Tag Relationships (The Alex's Holes Fix)
    const oldTagIds = beforeData?.tagIds || [];
    const newTagIds = afterData.tagIds || [];

    // Tags to ADD this media to
    const tagsToAdd = newTagIds.filter((id: string) => !oldTagIds.includes(id));
    // Tags to REMOVE this media from
    const tagsToRemove = oldTagIds.filter((id: string) => !newTagIds.includes(id));
    // Tags that STAY (need their gallery updated if image/title changed)
    const tagsToRefresh = newTagIds.filter((id: string) => oldTagIds.includes(id));

    if (tagsToAdd.length > 0) {
        await addMediaToTags(uid, mediaId, afterData, tagsToAdd);
    }
    if (tagsToRemove.length > 0) {
        await purgeMediaFromTags(uid, mediaId, tagsToRemove);
    }
    // Refresh the gallery entry for existing tags to ensure no "holes" if URL changed
    await addMediaToTags(uid, mediaId, afterData, tagsToRefresh);
});

/**
 * addMediaToTags
 * Updates the tag document to include this media in its IDs and Gallery.
 */
async function addMediaToTags(uid: string, mediaId: string, mediaData: any, tagIds: string[]) {
    for (const tagId of tagIds) {
        try {
            const tagRef = db.collection('users').doc(uid).collection('tags').doc(tagId);
            const tagDoc = await tagRef.get();
            if (!tagDoc.exists) continue;

            const tagData = tagDoc.data() || {};
            const mediaIds = tagData.mediaIds || [];
            const mediaGallery = tagData.mediaGallery || [];

            // Add ID if missing
            if (!mediaIds.includes(mediaId)) {
                mediaIds.push(mediaId);
            }

            // Update/Add Gallery Entry
            const entryIndex = mediaGallery.findIndex((e: any) => e.mediaId === mediaId || (e.url === mediaData.url && e.type === 'image'));
            const newEntry = {
                mediaId: mediaId,
                type: 'image',
                url: mediaData.url,
                caption: mediaData.title || mediaData.caption || 'Neural Reconstruction',
                date: mediaData.logicalDate || mediaData.uploadDate
            };

            if (entryIndex >= 0) {
                mediaGallery[entryIndex] = newEntry;
            } else {
                // Add to start of gallery for "Recent Memories"
                mediaGallery.unshift(newEntry);
            }

            // Keep gallery lean (max 100 entries for profile view)
            const leanGallery = mediaGallery.slice(0, 100);

            await tagRef.update({
                mediaIds: mediaIds,
                mediaGallery: leanGallery,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[MediaSync] 🔗 Linked ${mediaId} to Tag ${tagId}`);
        } catch (e: any) {
            console.error(`[MediaSync] Failed to link tag ${tagId}:`, e.message);
        }
    }
}

/**
 * purgeMediaFromTags
 * Removes the media ID and its gallery entry from the specified tags.
 */
async function purgeMediaFromTags(uid: string, mediaId: string, tagIds: string[]) {
    for (const tagId of tagIds) {
        try {
            const tagRef = db.collection('users').doc(uid).collection('tags').doc(tagId);
            const tagDoc = await tagRef.get();
            if (!tagDoc.exists) continue;

            const tagData = tagDoc.data() || {};
            const mediaIds = (tagData.mediaIds || []).filter((id: string) => id !== mediaId);
            const mediaGallery = (tagData.mediaGallery || []).filter((e: any) => e.mediaId !== mediaId);

            await tagRef.update({
                mediaIds,
                mediaGallery
            });
            console.log(`[MediaSync] ✂️ Unlinked ${mediaId} from Tag ${tagId}`);
        } catch (e: any) {
            console.error(`[MediaSync] Failed to unlink tag ${tagId}:`, e.message);
        }
    }
}

/**
 * syncToTypesense
 * Pushes media record to Typesense Cloud for the Matrix search.
 */
async function syncToTypesense(uid: string, media: any) {
    try {
        const configRef = await db.collection('users').doc(uid).collection('zen_config').doc('main').get();
        const config = configRef.data();
        if (!config || !config.typesenseHost || !config.typesenseKey) return;

        const ts = media.logicalDate ? new Date(media.logicalDate).getTime() : 
                   (media.uploadDate ? new Date(media.uploadDate).getTime() : Date.now());

        const document = {
            id: media.id,
            title: media.title || '',
            description: media.description || '',
            originalName: media.originalName || '',
            tags: media.tagIds || [],
            year: media.datePrecision === 'year' ? media.dateStr : (media.logicalDate ? new Date(media.logicalDate).getFullYear().toString() : ''),
            type: media.fileType?.startsWith('video') ? 'video' : 'image',
            timestamp: Math.floor(ts),
            address: media.location?.address || '',
            userId: uid
        };

        const url = `https://${config.typesenseHost}/collections/media_v1/documents?action=upsert`;
        await axios.post(url, document, {
            headers: {
                'X-TYPESENSE-API-KEY': config.typesenseKey,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[MediaSync] 🚀 Matrix Search Indexed: ${media.id}`);
    } catch (e: any) {
        console.error(`[MediaSync] Typesense Sync Failed:`, e.response?.data || e.message);
    }
}

/**
 * deleteFromTypesense
 * Removes record from search index.
 */
async function deleteFromTypesense(uid: string, mediaId: string) {
    try {
        const configRef = await db.collection('users').doc(uid).collection('zen_config').doc('main').get();
        const config = configRef.data();
        if (!config || !config.typesenseHost || !config.typesenseKey) return;

        const url = `https://${config.typesenseHost}/collections/media_v1/documents/${mediaId}`;
        await axios.delete(url, {
            headers: { 'X-TYPESENSE-API-KEY': config.typesenseKey }
        });
        console.log(`[MediaSync] 🗑️ Matrix Search Purged: ${mediaId}`);
    } catch (e: any) {
        console.error(`[MediaSync] Typesense Delete Failed:`, e.message);
    }
}
