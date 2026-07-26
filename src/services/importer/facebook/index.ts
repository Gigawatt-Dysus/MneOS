import { fixFBString, getTitle, getMessage, parseFlexibleDate } from '../utils';

/**
 * [ZEN] Facebook Ingestion Engine
 * Specialized extraction logic for legacy Facebook export structures.
 */

export const FB_NOISE_PATTERNS = [
    /liked .*(post|comment|photo|video|link|status|album|reel|story|page|life event)/i,
    /reacted to .*(post|comment|photo|video|link|status|album|reel|story|page|life event)/i,
    /added .* to (his|her|their) profile/i,
    /joined the group/i,
    /voted on .*poll/i,
    /shared a link/i,
    /updated (his|her|their) (profile picture|cover photo|status)/i,
    /was (mentioned|tagged) in .*post/i,
    /commented on .*(post|photo|video|status)/i
];

export const FB_LIFE_EVENT_SIGNATURES = [
    /got engaged/i,
    /is now married/i,
    /started a new job/i,
    /left a job/i,
    /moved to/i,
    /graduated from/i,
    /started school/i,
    /set .* as his hometown/i,
    /relationship status/i,
    /is now friends with/i,
    /are now friends/i,
    /accepted .*'s friend request/i,
    /became friends with/i,
    /removed .* as a friend/i,
    /unfriended/i
];

export const extractFbMediaUrls = (raw: any): any[] => {
    const urls: any[] = [];
    if (!raw) return urls;

    const findMedia = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        let uri = obj.uri || obj.media?.uri || obj.media?.image?.src || obj.photo_data?.uri || obj.video_data?.uri || obj.mediaUrl;
        
        if (uri && typeof uri === 'string') {
            if (uri.includes('stickers_used')) return;

            if (uri.match(/\.(jpeg|jpg|gif|png|mp4|mov)$/i)) {
                const foundMedia: any = { 
                    url: uri, 
                    caption: obj.title || obj.description || '' 
                };
                
                const exif = obj.media_metadata?.photo_metadata?.exif_data?.[0] || obj.exif_data?.[0];
                if (exif && exif.latitude && exif.longitude) {
                    foundMedia.latitude = exif.latitude;
                    foundMedia.longitude = exif.longitude;
                }
                urls.push(foundMedia);
            }
        }
        
        if (Array.isArray(obj)) {
            obj.forEach(findMedia);
        } else {
            Object.values(obj).forEach(findMedia);
        }
    };
    
    findMedia(raw);
    return urls;
};

export const extractFbPlaces = (raw: any): any[] => {
    const places: any[] = [];
    if (!raw || !raw.attachments) return places;

    const findPlace = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.place) places.push(obj.place);
        if (Array.isArray(obj)) obj.forEach(findPlace);
        else Object.values(obj).forEach(findPlace);
    };
    findPlace(raw.attachments);
    return places;
};

export const extractFbTags = (raw: any): string[] => {
    const tags: string[] = [];
    if (!raw) return tags;
    
    if (Array.isArray(raw.tags)) {
        raw.tags.forEach((t: any) => {
            if (typeof t === 'string') tags.push(t);
            else if (t && t.name) tags.push(t.name);
        });
    }

    const title = getTitle(raw);
    const withMatch = title.match(/was with (.*?) (at|in|near|during|$)/i);
    if (withMatch) {
        const names = withMatch[1].split(/, | and /);
        names.forEach(n => {
            const sanitized = n.trim();
            if (sanitized && !tags.includes(sanitized)) tags.push(sanitized);
        });
    }

    return tags;
};

export const extractFbLinks = (raw: any): string[] => {
    const links: string[] = [];
    if (!raw || !raw.attachments) return links;

    const findLinks = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.external_context?.url) links.push(obj.external_context.url);
        if (Array.isArray(obj)) obj.forEach(findLinks);
        else Object.values(obj).forEach(findLinks);
    };
    findLinks(raw.attachments);
    return links;
};

export const isSubstantiveMemory = (raw: any): boolean => {
    const title = getTitle(raw);
    const message = getMessage(raw);
    const combined = (title + " " + message).toLowerCase();
    
    const extractedMedia = extractFbMediaUrls(raw);
    const hasLocalMedia = extractedMedia.some(m => m.url && !m.url.startsWith('http'));

    const isNoise = FB_NOISE_PATTERNS.some(regex => regex.test(combined));
    if (isNoise) {
        if (!hasLocalMedia) return false;
    }

    if (extractedMedia.length > 0) return true;

    const isLifeEvent = FB_LIFE_EVENT_SIGNATURES.some(sig => sig.test(title));
    if (isLifeEvent) return true;

    const normalizedMessage = message.replace(/[.!]/g, '').trim().toLowerCase();
    const normalizedTitle = title.replace(/[.!]/g, '').trim().toLowerCase();
    
    if (!message.trim() || normalizedMessage === normalizedTitle) return false;
    
    if ((title === 'Untitled Entry' || title === 'Facebook Memory') && !message.trim()) return false;

    return true;
};
