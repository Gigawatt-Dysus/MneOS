import type { LifeEvent, Media, Tag } from '../../../types';
import { getTitle, parseFlexibleDate } from '../utils';
import { isSubstantiveMemory } from '../facebook/index';

/**
 * [ZEN] Legacy Ingestion Engine
 * Handles old-school JSON/JS object structures from the 2009-2012 era.
 */

export const processEventObject = (rawEvent: any, eventDate: Date, allTags: Map<string, Tag>, allMedia: Media[], existingTags: Tag[] = []): LifeEvent => {
    const eventId = rawEvent.id || `event-${eventDate.toISOString()}-${Math.random().toString(36).substr(2, 9)}`;

    const tagIds: string[] = [];
    if (Array.isArray(rawEvent.tags)) {
        for (const tagName of rawEvent.tags) {
            const sanitizedTagName = String(tagName ?? '').trim();
            if (!sanitizedTagName || sanitizedTagName.toLowerCase() === 'his own' || sanitizedTagName.toLowerCase() === 'her own') continue;
            
            const existingMatch = Array.from(allTags.values()).find(t => t.name.toLowerCase() === sanitizedTagName.toLowerCase()) || 
                                  existingTags.find(t => t.name.toLowerCase() === sanitizedTagName.toLowerCase());
            
            if (existingMatch) {
                tagIds.push(existingMatch.id);
                continue;
            }

            const isPlace = rawEvent.places?.some((p: any) => p.name === sanitizedTagName);
            const tagId = `tag-${sanitizedTagName.replace(/\s+/g, '-').toLowerCase()}`;
            if (!allTags.has(tagId)) {
                let newTag: Tag;
                if (isPlace) {
                    newTag = {
                        id: tagId,
                        name: sanitizedTagName,
                        type: 'place',
                        mainImageId: undefined,
                        mediaGallery: [],
                        description: '',
                        privateNotes: '',
                        isPrivate: false,
                        tagIds: [],
                        mediaIds: [],
                        metadata: { name: sanitizedTagName, address: '', significance: '' }
                    } as Tag;
                } else {
                    newTag = {
                        id: tagId,
                        name: sanitizedTagName,
                        type: 'person',
                        mainImageId: undefined,
                        mediaGallery: [],
                        description: '',
                        privateNotes: '',
                        isPrivate: false,
                        tagIds: [],
                        mediaIds: [],
                        metadata: { isProvisional: true }
                    } as Tag;
                }
                allTags.set(tagId, newTag);
            }
            tagIds.push(tagId);
        }
    }

    const mediaIds: string[] = [];
    if (Array.isArray(rawEvent.media)) {
        for (const rawMedia of rawEvent.media) {
            if (!rawMedia || !rawMedia.url) continue;
            const mediaId = `media-${eventDate.toISOString()}-${Math.random().toString(36).substr(2, 9)}`;
            const newMedia: Media = {
                id: mediaId,
                url: String(rawMedia.url ?? ''),
                thumbnailUrl: String(rawMedia.thumbnailUrl || rawMedia.url || ''),
                caption: String(rawMedia.caption ?? 'No caption provided'),
                uploadDate: eventDate,
                fileType: 'image/jpeg',
                tagIds: [],
                mediaIds: []
            };
            allMedia.push(newMedia);
            mediaIds.push(mediaId);
        }
    }

    return {
        id: eventId,
        title: getTitle(rawEvent),
        date: eventDate,
        details: String(rawEvent.details ?? ''),
        privateDetails: String(rawEvent.privateDetails ?? ''),
        isPrivateDetailsCloaked: Boolean(rawEvent.isPrivateDetailsCloaked ?? false),
        historical: String(rawEvent.historical ?? ''),
        tagIds,
        mediaIds,
        metadata: {
            ...rawEvent.metadata,
            places: rawEvent.places,
            links: rawEvent.links
        }
    };
};

export const parseLegacyData = (fileContent: string, existingTags: Tag[] = [], dateRange?: { start: Date, end: Date }): { events: LifeEvent[], tags: Tag[], media: Media[] } => {
    if (typeof fileContent !== 'string' || fileContent.trim().length === 0) {
        throw new Error("The selected file is empty or contains only whitespace.");
    }
    
    if (fileContent.charCodeAt(0) === 0xFEFF) fileContent = fileContent.substring(1);
    const trimmedContent = fileContent.trim();
    
    const firstCurly = trimmedContent.indexOf('{');
    const firstSquare = trimmedContent.indexOf('[');
    let startIndex = -1;
    if (firstCurly === -1 && firstSquare === -1) throw new Error("Could not find a starting '{' or '['.");
    startIndex = (firstCurly === -1) ? firstSquare : (firstSquare === -1) ? firstCurly : Math.min(firstCurly, firstSquare);

    const openChar = trimmedContent[startIndex];
    const closeChar = openChar === '{' ? '}' : ']';
    let balance = 1;
    let endIndex = -1;

    for (let i = startIndex + 1; i < trimmedContent.length; i++) {
        const char = trimmedContent[i];
        if (char === openChar) balance++;
        else if (char === closeChar) balance--;
        if (balance === 0) { endIndex = i; break; }
    }

    if (endIndex === -1) throw new Error("Unbalanced brackets in data structure.");
    const jsonString = trimmedContent.substring(startIndex, endIndex + 1);
    let parsedJson: any;

    try {
        parsedJson = JSON.parse(jsonString);
    } catch (jsonError) {
        try {
            parsedJson = new Function(`return (${jsonString})`)();
        } catch (lenientError: any) {
            throw new Error(`Syntax error: ${lenientError.message}`);
        }
    }
    
    const allEvents: LifeEvent[] = [];
    const allMedia: Media[] = [];
    const allTags: Map<string, Tag> = new Map();

    let dataToParse = parsedJson;
    if (dataToParse && typeof dataToParse === 'object' && dataToParse.historyData) dataToParse = dataToParse.historyData;

    if (Array.isArray(dataToParse)) {
        for (const rawEvent of dataToParse) {
            if (!rawEvent) continue;
            const rawDate = rawEvent.date || rawEvent.timestamp || rawEvent.timestamp_ms || rawEvent.creation_timestamp || rawEvent.created_time;
            if (!rawDate) continue;
            const eventDate = parseFlexibleDate(rawDate);
            if (!eventDate) continue; 
            if (!isSubstantiveMemory(rawEvent)) continue;
            allEvents.push(processEventObject(rawEvent, eventDate, allTags, allMedia, existingTags));
        }
    } else if (typeof dataToParse === 'object' && dataToParse !== null) {
        for (const year in dataToParse) {
            if (dataToParse.hasOwnProperty(year) && /^\d{4}$/.test(year)) {
                const yearData = dataToParse[year as keyof typeof dataToParse];
                if (!yearData || typeof yearData !== 'object') continue;
                for (let [dateStr, rawEvent] of Object.entries(yearData as any)) {
                    if (!rawEvent || typeof rawEvent !== 'object') continue;
                    const dateStringToParse = dateStr === 'null' ? '??-??' : dateStr;
                    const eventDate = parseFlexibleDate(dateStringToParse, parseInt(year, 10));
                    if (!eventDate) continue;
                    allEvents.push(processEventObject(rawEvent, eventDate, allTags, allMedia, existingTags));
                }
            }
        }
    }

    return { events: allEvents, tags: Array.from(allTags.values()), media: allMedia };
};
