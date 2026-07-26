import { getFirestore, collection, addDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';
import { MatrixAsset, Media } from '@/types'; // [ZEN] Added Media type for casting
import { StagedAsset } from '../components/StagingArea/types';
import { typesenseService } from './typesenseService'; // [ZEN] Import the Bridge

// --- DELETION LOGIC ---
export const deleteAssets = async (assets: MatrixAsset[], uid: string): Promise<{ success: number; errors: number }> => {
    let successCount = 0;
    let errorCount = 0;

    const promises = assets.map(async (asset) => {
        try {
            const storagePromises = [];

            // Delete Original
            if (typeof asset.url === 'string' && asset.url) {
                const originalRef = ref(storage, asset.url);
                storagePromises.push(deleteObject(originalRef).catch(e => console.warn("Original file missing:", e)));
            }

            // Delete Thumbnails
            if (asset.thumbnailUrls) {
                Object.values(asset.thumbnailUrls).forEach(url => {
                    if (typeof url === 'string' && url) {
                        const thumbRef = ref(storage, url);
                        storagePromises.push(deleteObject(thumbRef).catch(e => console.warn("Thumbnail missing:", e)));
                    }
                });
            }

            await Promise.all(storagePromises);
            await deleteDoc(doc(db, 'users', uid, 'media', asset.id));

            // [ZEN] Remove from Search Index
            await typesenseService.deleteMedia(asset.id);

            successCount++;
        } catch (error) {
            console.error(`Failed to delete asset ${asset.id}:`, error);
            errorCount++;
        }
    });

    await Promise.all(promises);
    return { success: successCount, errors: errorCount };
};

// --- SAVE LOGIC ---
export const saveToMatrix = async (asset: StagedAsset, userId: string): Promise<string> => {
    try {
        if (!userId) throw new Error("No user ID provided for Matrix save.");

        // 1. Prepare Storage Path
        const year = asset.logicalDate.getFullYear().toString();
        const safeFilename = asset.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `users/${userId}/media/${year}/${safeFilename}`;
        const storageRef = ref(storage, storagePath);

        // 2. Upload File
        const snapshot = await uploadBytes(storageRef, asset.file);
        const downloadUrl = await getDownloadURL(snapshot.ref);

        // 3. Construct the "Index Card" (Firestore Document)
        const mediaDoc = {
            uid: userId,
            url: downloadUrl,
            originalName: asset.file.name,
            fileType: asset.file.type,
            size: asset.file.size,
            storagePath: storagePath,
            dateAdded: serverTimestamp(),
            logicalDate: asset.logicalDate.toISOString(),

            // Metadata
            width: asset.metadata.width || 0,
            height: asset.metadata.height || 0,
            aspectRatio: asset.metadata.aspectRatio || 1,
            // @ts-ignore
            googleMetadata: asset.metadata.googlePhotos || null,

            // User Edits
            title: asset.title || '',
            description: asset.description || '',
            caption: asset.caption || '',
            tagIds: asset.tagIds || [],

            // System
            status: 'clean',
            source: 'web_staging_import',
            year: parseInt(year)
        };

        // 4. Write to Firestore
        const docRef = await addDoc(collection(db, `users/${userId}/media`), mediaDoc);
        console.log(`[MatrixService] Saved artifact ${docRef.id}`);

        // 5. [ZEN] Sync to Typesense (Instant Searchability)
        // We reconstruct the object with the new ID for the search index
        const indexObject = {
            ...mediaDoc,
            id: docRef.id,
            uploadDate: new Date() // Fallback for dateAdded which is serverTimestamp in Firestore
        };
        await typesenseService.updateMedia(indexObject as unknown as Media);

        return docRef.id;
    } catch (error) {
        console.error("[MatrixService] Save failed:", error);
        throw error;
    }
};