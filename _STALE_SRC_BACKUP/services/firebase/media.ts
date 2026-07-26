import { doc, getDocs, setDoc, deleteDoc, updateDoc, deleteField } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, MEDIA_COLLECTION, USERS_COLLECTION, getSubcollectionRef, cleanForFirestore, convertTimestampsToDates } from './core';
import { sanitizeAllMedia } from '../dataValidator';
import { base64ToBlob } from '../../utils/fileUtils';
import type { Media } from '@/types';

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
        const storage = getStorage();
        const storageRef = ref(storage, `users/${userId}/uploads/${mediaId}`);
        const blob = base64ToBlob(base64Data, mimeType);
        
        const uploadPromise = uploadBytes(storageRef, blob, { contentType: mimeType });
        const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error("Upload timeout")), 60000)
        );

        await Promise.race([uploadPromise, timeoutPromise]);
        const url = await getDownloadURL(storageRef);
        
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
    const storage = getStorage();
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const storagePath = `users/${userId}/uploads/${timestamp}-${safeName}`;
    const storageRef = ref(storage, storagePath);

    console.log(`[Firebase] Uploading ${file.name} to bucket path: ${storagePath}`);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log(`[Firebase] Upload Success. URL: ${downloadURL}`);

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

export const saveMedia = async (userId: string, media: Media): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, MEDIA_COLLECTION), media.id);
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
                    throw new Error("Cloud storage upload failed (Network/Timeout).");
                }
            } catch (e: any) {
                console.error("[Firestore] Upload process failed. Aborting save.", e);
                throw e; 
            }
        }
    }

    if (mediaToSave.base64Data && mediaToSave.base64Data.length > 900000) {
        throw new Error("File too large for database index. Cloud upload required.");
    }

    await setDoc(docRef, cleanForFirestore(mediaToSave));
};

export const deleteMedia = async (userId: string, mediaId: string): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, MEDIA_COLLECTION), mediaId);
    await deleteDoc(docRef);
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