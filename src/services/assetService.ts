// services/assetService.ts
import { deleteDoc, doc } from './sovereignDbAdapter';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';
import { MatrixAsset } from '../types';

export const deleteAssets = async (assets: MatrixAsset[], uid: string): Promise<{ success: number; errors: number }> => {
    let successCount = 0;
    let errorCount = 0;

    const promises = assets.map(async (asset) => {
        try {
            const storagePromises = [];

            // Fix: Strict check for string type
            if (typeof asset.url === 'string' && asset.url) {
                const originalRef = ref(storage, asset.url);
                storagePromises.push(deleteObject(originalRef).catch(e => console.warn("Original file missing:", e)));
            }

            if (asset.thumbnailUrls) {
                Object.values(asset.thumbnailUrls).forEach(url => {
                    // Fix: Strict check for string type here too
                    if (typeof url === 'string' && url) {
                        const thumbRef = ref(storage, url);
                        storagePromises.push(deleteObject(thumbRef).catch(e => console.warn("Thumbnail missing:", e)));
                    }
                });
            }

            await Promise.all(storagePromises);
            await deleteDoc(doc(db, 'users', uid, 'media', asset.id));
            successCount++;
        } catch (error) {
            console.error(`Failed to delete asset ${asset.id}:`, error);
            errorCount++;
        }
    });

    await Promise.all(promises);
    return { success: successCount, errors: errorCount };
};