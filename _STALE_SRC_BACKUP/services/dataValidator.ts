import type { LifeEvent, Tag, Media, PersonTag, PetTag, ThingTag, PlaceTag, EventTag, UnknownTag, EducationEntry } from '@/types';

// --- HELPER: Robust Date Parsing ---
const parseDate = (dateInput: any): Date => {
    if (!dateInput) return new Date(); 
    if (dateInput instanceof Date) return dateInput;
    if (dateInput && typeof dateInput === 'object' && 'seconds' in dateInput) {
        return new Date(dateInput.seconds * 1000);
    }
    if (typeof dateInput === 'string') return new Date(dateInput);
    if (typeof dateInput === 'number') return new Date(dateInput);
    return new Date();
};

const toDateString = (val: any): string => {
    const d = parseDate(val);
    return d.toISOString();
};

export const sanitizeEvent = (event: any): LifeEvent | null => {
    if (!event || typeof event !== 'object') return null;
    const validDate = parseDate(event.date);

    return {
        id: typeof event.id === 'string' && event.id ? event.id : `event-${Date.now()}-${Math.random()}`,
        title: typeof event.title === 'string' && event.title ? event.title : 'Untitled Event',
        date: validDate,
        details: typeof event.details === 'string' ? event.details : '',
        privateDetails: typeof event.privateDetails === 'string' ? event.privateDetails : undefined,
        isPrivateDetailsCloaked: typeof event.isPrivateDetailsCloaked === 'boolean' ? event.isPrivateDetailsCloaked : false,
        historical: typeof event.historical === 'string' ? event.historical : undefined,
        tagIds: Array.isArray(event.tagIds) ? event.tagIds : [],
        mediaIds: Array.isArray(event.mediaIds) ? event.mediaIds : [],
        reactions: Array.isArray(event.reactions) ? event.reactions : [],
        comments: Array.isArray(event.comments) ? event.comments : [],
        description: typeof event.description === 'string' ? event.description : '',
        location: event.location && typeof event.location === 'object' ? event.location : undefined,
    };
};

export const sanitizeMedia = (item: any): Media | null => {
    if (!item || typeof item !== 'object') return null;
    const validDate = parseDate(item.uploadDate || item.dateAdded);

    return {
        id: typeof item.id === 'string' ? item.id : `media-${Date.now()}`,
        url: typeof item.url === 'string' ? item.url : '',
        thumbnailUrl: typeof item.thumbnailUrl === 'string' ? item.thumbnailUrl : '',
        caption: typeof item.caption === 'string' ? item.caption : '',
        location: item.location || undefined,
        uploadDate: validDate,
        fileType: typeof item.fileType === 'string' ? item.fileType : 'unknown',
        fileName: typeof item.fileName === 'string' ? item.fileName : undefined,
        size: typeof item.size === 'number' ? item.size : 0,
        base64Data: typeof item.base64Data === 'string' ? item.base64Data : undefined,
        tagIds: Array.isArray(item.tagIds) ? item.tagIds : [],
        // [ZEN FIX] Ensure mediaIds is always an array
        mediaIds: Array.isArray(item.mediaIds) ? item.mediaIds : [],
        reactions: Array.isArray(item.reactions) ? item.reactions : [],
        originalName: typeof item.originalName === 'string' ? item.originalName : undefined,
        logicalDate: typeof item.logicalDate === 'string' ? item.logicalDate : undefined,
        year: typeof item.year === 'number' ? item.year : undefined,
        status: ['clean', 'provisional', 'archived'].includes(item.status) ? item.status : undefined,
        thumbnailUrls: item.thumbnailUrls || undefined,
        width: typeof item.width === 'number' ? item.width : undefined,
        height: typeof item.height === 'number' ? item.height : undefined,
        title: typeof item.title === 'string' ? item.title : undefined,
        description: typeof item.description === 'string' ? item.description : undefined,
        isFavorite: !!item.isFavorite,
        mainImageId: typeof item.mainImageId === 'string' ? item.mainImageId : undefined,
        aiProcessed: !!item.aiProcessed,
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
    };
};

export const sanitizeTag = (tag: any): Tag | null => {
    if (!tag || typeof tag !== 'object') return null;
    
    // Ensure basic fields exist
    const baseTag = {
        id: typeof tag.id === 'string' ? tag.id : `tag-${Date.now()}`,
        name: typeof tag.name === 'string' ? tag.name : 'Unnamed Tag',
        description: typeof tag.description === 'string' ? tag.description : '',
        privateNotes: typeof tag.privateNotes === 'string' ? tag.privateNotes : '',
        isPrivate: !!tag.isPrivate,
        tagIds: Array.isArray(tag.tagIds) ? tag.tagIds : [],
        mediaIds: Array.isArray(tag.mediaIds) ? tag.mediaIds : [],
        mainImageId: typeof tag.mainImageId === 'string' ? tag.mainImageId : undefined,
        mediaGallery: Array.isArray(tag.mediaGallery) ? tag.mediaGallery : [],
        keywords: Array.isArray(tag.keywords) ? tag.keywords : [],
    };

    const type = typeof tag.type === 'string' ? tag.type : 'unknown';
    const m = tag.metadata || {};

    switch (type) {
        case 'person':
            return { 
                ...baseTag, 
                type: 'person', 
                metadata: {
                    ...m,
                    dates: m.dates || { birth: '', death: '' },
                    isDeceased: !!m.isDeceased,
                    gender: typeof m.gender === 'string' ? m.gender : '',
                    emails: Array.isArray(m.emails) ? m.emails : [],
                    socials: Array.isArray(m.socials) ? m.socials : [],
                    contacts: Array.isArray(m.contacts) ? m.contacts : [],
                    relationships: Array.isArray(m.relationships) ? m.relationships : [],
                    locations: Array.isArray(m.locations) ? m.locations : [],
                }
            } as PersonTag;
        case 'pet':
            return {
                ...baseTag,
                type: 'pet',
                metadata: {
                    ...m,
                    species: typeof m.species === 'string' ? m.species : 'Unknown',
                    dates: m.dates || { birth: '', adoption: '', death: '' },
                    medical: m.medical || { vetName: '', conditions: [] },
                    documents: Array.isArray(m.documents) ? m.documents : [],
                }
            } as PetTag;
        case 'thing':
             return {
                ...baseTag,
                type: 'thing',
                metadata: {
                    ...m,
                    acquisition: m.acquisition || { date: '', cost: 0, sourceTagId: '' },
                    status: m.status || { currentVal: 0, condition: '', locationTagId: '' },
                    purpose: typeof m.purpose === 'string' ? m.purpose : '',
                }
            } as ThingTag;
        case 'place':
            return {
               ...baseTag,
               type: 'place',
               metadata: {
                    ...m,
                    address: m.address || '',
                    significance: typeof m.significance === 'string' ? m.significance : '',
                    coordinates: m.coordinates || undefined,
                    telephone: typeof m.telephone === 'string' ? m.telephone : '',
                    email: typeof m.email === 'string' ? m.email : '',
                    url: typeof m.url === 'string' ? m.url : '',
                    socials: Array.isArray(m.socials) ? m.socials : [],
               }
            } as PlaceTag;
        case 'event':
             return { ...baseTag, type: 'event', metadata: m || {} } as EventTag;
        default:
             return { ...baseTag, type: 'unknown', metadata: m || {} } as UnknownTag;
    }
};

export const sanitizeAllEvents = (events: any[]): LifeEvent[] => {
    if (!Array.isArray(events)) return [];
    const sanitized: LifeEvent[] = [];
    for (const event of events) {
        try {
            const s = sanitizeEvent(event);
            if (s) sanitized.push(s);
        } catch (e) { }
    }
    return sanitized;
};

export const sanitizeAllMedia = (media: any[]): Media[] => {
    if (!Array.isArray(media)) return [];
    const sanitized: Media[] = [];
    for (const item of media) {
        try {
            const s = sanitizeMedia(item);
            if (s) sanitized.push(s);
        } catch (e) { }
    }
    return sanitized;
};

export const sanitizeAllTags = (tags: any[]): Tag[] => {
    if (!Array.isArray(tags)) return [];
    const sanitized: Tag[] = [];
    for (const tag of tags) {
        try {
            const s = sanitizeTag(tag);
            if (s) sanitized.push(s);
        } catch (e) { }
    }
    return sanitized;
};