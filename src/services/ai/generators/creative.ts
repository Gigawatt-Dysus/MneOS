import type { User, LifeEvent, Tag, Media } from '../../../types';

export const generateDaydreamEntry = async (
    user: User,
    events: LifeEvent[], 
    tags: Tag[],
    media: Media[]
): Promise<{ title: string, content: string, relatedEventId?: string } | null> => {
    // Logic resides in dedicated daydreamService or is stubbed here for now
    return null; 
};

export const generateDeepDiveFromQuery = async (
    query: string,
    user: User,
    allEvents: LifeEvent[],
    allTags: Tag[],
    allMedia: Media[] 
): Promise<{ title: string, content: string, relatedEventId?: string } | null> => {
    // Logic resides in deepDiveService
    return null;
};

// [ZEN FIX] Alias for legacy consumers (fixes geminiService.ts WSOD)
export const generateDeepDiveEntry = generateDeepDiveFromQuery;