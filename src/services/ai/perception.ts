import { blobToBase64 } from '../../utils/fileUtils';

// Helper: Fetch image from URL and convert to Base64
// Used when the app only has a URL but needs to send image data to Grok
export const fetchImageAsBase64 = async (url: string): Promise<string> => {
    try {
        const cacheBuster = url.includes('?') ? '&' : '?';
        const finalUrl = url.startsWith('http') ? `${url}${cacheBuster}t=${Date.now()}` : url;
        const response = await fetch(finalUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        return await blobToBase64(blob);
    } catch (e) {
        console.warn("fetchImageAsBase64 failed. CORS or network issue.", e);
        throw e;
    }
};