import { useState, useEffect } from 'react';
import { Media, User } from '../../../types';
import { UniversalMedia } from './types';
import { appDataService } from '../../../services/serviceManager';
import { uploadFile } from '../../../services/storageService';

export const useStudioMedia = (asset: UniversalMedia, user: User, valuesRef: any, setIsDirty: (d: boolean) => void) => {
    const [attachedMediaIds, setAttachedMediaIds] = useState<string[]>(asset.mediaIds || []);
    const [attachedMediaObjects, setAttachedMediaObjects] = useState<Media[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const hydrateAttachedMedia = async () => {
            if (asset.mediaIds && asset.mediaIds.length > 0 && attachedMediaObjects.length === 0) {
                try {
                    const mediaPromises = asset.mediaIds.map(id => appDataService.getMediaById(id, user.id));
                    const results = await Promise.all(mediaPromises);
                    setAttachedMediaObjects(results.filter(Boolean) as Media[]);
                } catch (e) { console.error("[StudioMedia] Hydration failed", e); }
            }
        };
        hydrateAttachedMedia();
    }, [asset.id, user.id]);

    const handleMatrixSelect = (selectedMedia: Media[]) => {
        setAttachedMediaIds(prevIds => {
            const newIds = [...prevIds];
            selectedMedia.forEach(m => { if (!newIds.includes(m.id)) newIds.push(m.id); });
            valuesRef.current.mediaIds = newIds;
            return newIds;
        });

        setAttachedMediaObjects(prevObjects => {
            const newObjects = [...prevObjects];
            selectedMedia.forEach(m => { if (!newObjects.some(o => o.id === m.id)) newObjects.push(m); });
            return newObjects;
        });

        setIsDirty(true);
    };

    const handleScrapbookUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            const addedObjects: Media[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const { url, base64 } = await uploadFile(file, user.id, `scrapbook-${Date.now()}-${i}`);
                const newMedia: Media = {
                    id: `media-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
                    url: url || (base64 ? `data:${file.type};base64,${base64}` : ''),
                    thumbnailUrl: url || (base64 ? `data:${file.type};base64,${base64}` : ''),
                    caption: file.name,
                    uploadDate: new Date(),
                    fileType: file.type,
                    fileName: file.name,
                    size: file.size,
                    tagIds: [],
                    mediaIds: [],
                    status: 'provisional',
                    logicalDate: new Date().toISOString()
                };
                await appDataService.saveMedia(user.id, newMedia);
                addedObjects.push(newMedia);
            }

            setAttachedMediaIds(prev => {
                const next = [...prev, ...addedObjects.map(m => m.id)];
                valuesRef.current.mediaIds = next;
                return next;
            });
            setAttachedMediaObjects(prev => [...prev, ...addedObjects]);
            setIsDirty(true);
        } catch (err) { console.error("[StudioMedia] Upload failed", err); }
        finally { setIsUploading(false); }
    };

    const handleRemoveAttachment = (id: string) => {
        setAttachedMediaIds(prev => {
            const next = prev.filter(tid => tid !== id);
            valuesRef.current.mediaIds = next;
            return next;
        });
        setAttachedMediaObjects(prev => prev.filter(m => m.id !== id));
        setIsDirty(true);
    };

    return {
        attachedMediaIds,
        attachedMediaObjects,
        isUploading,
        handleMatrixSelect,
        handleScrapbookUpload,
        handleRemoveAttachment
    };
};
