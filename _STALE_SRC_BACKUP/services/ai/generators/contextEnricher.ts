// services/ai/generators/contextEnricher.ts
import type { LifeEvent, Media, Tag, Settings } from '@/types';
import { fetchImageAsBase64 } from '../perception'; 

export const enrichEventWithStarfishContext = async (
    event: LifeEvent, 
    allMedia: Media[], 
    allTags: Tag[], 
    settings?: Settings
): Promise<{ textContext: string, mediaParts: any[] }> => {
    const depthLimit = settings?.daydreamDepth || 10;
    const strategy = settings?.daydreamSampling || 'random';

    let candidateMedia = allMedia.filter(m => event.mediaIds?.includes(m.id));

    if (strategy === 'favorites') {
        const faves = candidateMedia.filter(m => m.isFavorite);
        const others = candidateMedia.filter(m => !m.isFavorite);
        candidateMedia = [...faves, ...others]; 
    } else if (strategy === 'random') {
        candidateMedia = candidateMedia.sort(() => 0.5 - Math.random());
    }

    const targetMedia = candidateMedia.slice(0, depthLimit);
    let contextString = `\n[Event Context: ${event.title}]\n`;
    
    const mediaPartsPromises = targetMedia.map(async (m) => {
        try {
            if (m.base64Data) {
                return { inlineData: { mimeType: m.fileType, data: m.base64Data } };
            } else if (m.url) {
                const b64 = await fetchImageAsBase64(m.url);
                return { inlineData: { mimeType: m.fileType || 'image/jpeg', data: b64 } };
            }
        } catch (e) {
            console.warn("Failed to fetch media for AI context", e);
        }
        return null;
    });

    const resolvedMediaParts = (await Promise.all(mediaPartsPromises)).filter(Boolean);

    targetMedia.forEach(m => {
        contextString += `- Media: ${m.title || m.originalName} (${m.fileType})\n`;
        const attachedTags = allTags.filter(t => m.tagIds?.includes(t.id));
        if (attachedTags.length > 0) {
            contextString += `  > Tagged: ${attachedTags.map(t => t.name + " (" + t.type + ")").join(', ')}\n`;
        }
    });

    return { textContext: contextString, mediaParts: resolvedMediaParts }; 
};