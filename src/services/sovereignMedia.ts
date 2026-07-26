import { doc, getDocs, setDoc, deleteDoc, updateDoc, deleteField, getDoc } from './sovereignDbAdapter';
import { db, MEDIA_COLLECTION, USERS_COLLECTION, getSubcollectionRef, cleanForFirestore, convertTimestampsToDates, MEMORIAL_CONTRIBUTIONS_COLLECTION } from './sovereignCore';
import { sanitizeAllMedia } from './dataValidator';
import { base64ToBlob } from '../utils/fileUtils';
import { uploadFile } from './storageService';
import type { Media } from '../types';

// --- CIRCUIT BREAKER STATE ---
let isUploadHealthy = true;
let consecutiveUploadFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3; 

const uploadBase64ToStorage = async (userId: string, mediaId: string, base64Data: string, mimeType: string): Promise<string | null> => {
    if (!isUploadHealthy && consecutiveUploadFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn("[Firestore] Upload circuit breaker active. Skipping cloud upload.");
        return null;
    }

    try {
        const blob = base64ToBlob(base64Data, mimeType);
        const { url } = await uploadFile(blob, userId, mediaId);
        
        if (!url) throw new Error("Upload failed to return URL");

        isUploadHealthy = true;
        consecutiveUploadFailures = 0;
        return url;

    } catch (error: any) {
        consecutiveUploadFailures++;
        console.error(`[Firestore] Upload failed (${consecutiveUploadFailures}/${MAX_CONSECUTIVE_FAILURES}): ${error.message}`);
        
        if (consecutiveUploadFailures >= MAX_CONSECUTIVE_FAILURES) {
            isUploadHealthy = false;
        }
        return null;
    }
};

export const uploadMedia = async (userId: string, file: File): Promise<void> => {
    const timestamp = Date.now();
    
    console.log(`[B2] Uploading ${file.name}...`);
    const { url: downloadURL } = await uploadFile(file, userId);
    
    if (!downloadURL) throw new Error("B2 Upload failed to return a valid URL");
    console.log(`[B2] Upload Success. URL: ${downloadURL}`);

    const newMedia: Media = {
        id: `media-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        url: downloadURL,
        thumbnailUrl: downloadURL, 
        caption: file.name,
        uploadDate: new Date(),
        fileType: file.type,
        fileName: file.name,
        size: file.size,
        tagIds: [],
        mediaIds: [],
        status: 'clean'
    };

    const docRef = doc(getSubcollectionRef(userId, MEDIA_COLLECTION), newMedia.id);
    await setDoc(docRef, cleanForFirestore(newMedia));
};

export const saveMedia = async (userId: string, media: Media, targetCollection: string = MEDIA_COLLECTION): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, targetCollection), media.id);
    let mediaToSave = { ...media };

    if (mediaToSave.base64Data) {
        if (!mediaToSave.url || mediaToSave.url.startsWith('data:')) {
            try {
                const mime = mediaToSave.fileType || 'image/jpeg';
                const url = await uploadBase64ToStorage(userId, media.id, mediaToSave.base64Data, mime);
                
                if (url) {
                    mediaToSave.url = url;
                    mediaToSave.thumbnailUrl = url;
                    delete mediaToSave.base64Data;
                } else {
                    console.warn("[Firestore] Cloud storage upload failed (Network/Timeout). Falling back to Base64 in Firestore if under size limit.");
                }
            } catch (e: any) {
                console.warn("[Firestore] Upload process failed. Falling back to Base64 in Firestore if under size limit.", e);
            }
        }
    }

    if (mediaToSave.base64Data && mediaToSave.base64Data.length > 900000) {
        throw new Error("File too large for database index. Cloud upload required.");
    }

    console.log(`[saveMedia] Saving ${media.id} to ${targetCollection}. Rotation: ${(mediaToSave as any).rotation}`);
    await setDoc(docRef, cleanForFirestore({ ...mediaToSave, updatedAt: new Date() }));
};

export const deleteMedia = async (userId: string, mediaId: string, targetCollection: string = MEDIA_COLLECTION): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, targetCollection), mediaId);
    await deleteDoc(docRef);
};

export const getMediaById = async (mediaId: string, userId: string): Promise<Media | null> => {
    try {
        const docRef = doc(getSubcollectionRef(userId, MEDIA_COLLECTION), mediaId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return convertTimestampsToDates(snap.data() as Media);
    } catch (e) {
        console.error(`[Firestore] Failed to get media ${mediaId}:`, e);
        return null;
    }
};

export const getAllMedia = async (userId: string): Promise<Media[]> => {
    const querySnapshot = await getDocs(getSubcollectionRef(userId, MEDIA_COLLECTION));
    const media = querySnapshot.docs.map(doc => convertTimestampsToDates(doc.data() as Media));
    return sanitizeAllMedia(media);
};

export const migrateMediaToCloud = async (userId: string, onProgress: (current: number, total: number) => void): Promise<void> => {
    const mediaRef = getSubcollectionRef(userId, MEDIA_COLLECTION);
    const snapshot = await getDocs(mediaRef);
    const allMedia = snapshot.docs.map(d => d.data() as Media);
    
    const localMedia = allMedia.filter(m => m.base64Data && (!m.url || !m.url.startsWith('http')));
    let processed = 0;
    
    for (const mediaItem of localMedia) {
        if (mediaItem.base64Data && mediaItem.fileType) {
            const url = await uploadBase64ToStorage(userId, mediaItem.id, mediaItem.base64Data, mediaItem.fileType);
            if (url) {
                const docRef = doc(mediaRef, mediaItem.id);
                await updateDoc(docRef, {
                    url: url,
                    thumbnailUrl: url,
                    base64Data: deleteField()
                });
            }
        }
        processed++;
        onProgress(processed, localMedia.length);
    }
};

// --- MEMORIAL AIRLOCK ---

export const getMemorialContributions = async (userId: string): Promise<Media[]> => {
    const querySnapshot = await getDocs(getSubcollectionRef(userId, MEMORIAL_CONTRIBUTIONS_COLLECTION));
    return querySnapshot.docs.map(doc => convertTimestampsToDates(doc.data() as Media));
};

export const approveContribution = async (userId: string, contributionId: string): Promise<void> => {
    const contributionRef = doc(getSubcollectionRef(userId, MEMORIAL_CONTRIBUTIONS_COLLECTION), contributionId);
    const mediaRef = doc(getSubcollectionRef(userId, MEDIA_COLLECTION), contributionId);
    
    const snap = await getDoc(contributionRef);
    if (!snap.exists()) throw new Error("Contribution not found in Airlock");
    const contribution = snap.data() as Media;
    
    // [ZEN] Promote to primary media archive
    await setDoc(mediaRef, cleanForFirestore({ 
        ...contribution, 
        contributionStatus: 'verified', 
        status: 'clean',
        updatedAt: new Date()
    }));
    
    // [ZEN] Purge from Airlock
    await deleteDoc(contributionRef);
};

export const rejectContribution = async (userId: string, contributionId: string): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, MEMORIAL_CONTRIBUTIONS_COLLECTION), contributionId);
    // [ZEN] Hard reject (permanent deletion from airlock)
    await deleteDoc(docRef);
};