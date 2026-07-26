import type { LifeEvent, Media, Tag } from '@/types';

/**
 * Parses a variety of date formats, including incomplete ones, into a valid Date object.
 * This function is designed to be robust and avoid the ambiguous behavior of `new Date(string)`.
 * @param dateInput The raw date input, could be a string or already a date.
 * @param contextYear An optional year to use if the dateInput doesn't contain one.
 * @returns A valid Date object or null if unparseable.
 */
const parseFlexibleDate = (dateInput: any, contextYear?: number): Date | null => {
    if (!dateInput) return null;

    // If it's already a valid date object, just return it.
    if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
        return dateInput;
    }

    // Attempt to parse standard ISO 8601 format first, as it's unambiguous.
    // e.g., "2008-09-28T..." or "2008-09-28"
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
        const isoDate = new Date(dateInput);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }
    }

    // Now handle custom/legacy formats. Must be a string from here.
    if (typeof dateInput !== 'string') {
        // It might be a timestamp number, try that as a last resort before failing.
        try {
            const numDate = new Date(dateInput);
            if (!isNaN(numDate.getTime())) return numDate;
        } catch (e) { /* ignore errors from invalid inputs */ }
        return null;
    }

    // Replace common separators and split.
    const parts = dateInput.replace(/[./]/g, '-').split('-');

    let year: number | undefined;
    let month: number = 1; // Default to January
    let day: number = 1; // Default to 1st

    if (parts.length === 3) { // MM-DD-YYYY, MM-DD-YY, YYYY-MM-DD
        const p1 = parseInt(parts[0]);
        const p2 = parseInt(parts[1]);
        const p3 = parseInt(parts[2]);

        if (parts[0].length === 4) { // YYYY-MM-DD
            year = p1;
            month = p2 || 1;
            day = p3 || 1;
        } else { // MM-DD-YYYY or MM-DD-YY
            month = p1 || 1;
            day = p2 || 1;
            if (!isNaN(p3)) {
                year = p3 < 100 ? p3 + (p3 > 50 ? 1900 : 2000) : p3;
            } else {
                year = contextYear; // Fallback to context if year part is invalid (e.g., '??')
            }
        }
    } else if (parts.length === 2 && contextYear) { // MM-DD with context
        month = parseInt(parts[0]) || 1;
        day = parseInt(parts[1]) || 1;
        year = contextYear;
    } else {
        // Unrecognized format, or a format we can't handle without context.
        return null;
    }

    if (year === undefined || year === null) {
        return null; // Can't form a date without a year.
    }

    // Month is 0-indexed for Date constructor. Validate ranges.
    if (month < 1 || month > 12) month = 1;
    if (day < 1 || day > 31) day = 1;

    const finalDate = new Date(Date.UTC(year, month - 1, day));

    if (isNaN(finalDate.getTime())) {
        console.warn(`[Importer] Failed to construct a valid date from input:`, { dateInput, contextYear, year, month, day });
        return null;
    }

    return finalDate;
};


/**
 * A helper function to process a raw event object from any supported format.
 * @param rawEvent The raw event object.
 * @param eventDate The parsed date for the event.
 * @param allTags A map to accumulate unique tags.
 * @param allMedia An array to accumulate all media items.
 * @returns A fully formed LifeEvent object.
 */
const processEventObject = (rawEvent: any, eventDate: Date, allTags: Map<string, Tag>, allMedia: Media[]): LifeEvent => {
    const eventId = `event-${eventDate.toISOString()}-${Math.random().toString(36).substr(2, 9)}`;

    const getTitle = (raw: any): string => {
        // Prefer `title` or `event` fields if they are non-empty strings.
        const potentialTitle = raw.title || raw.event;
        if (typeof potentialTitle === 'string' && potentialTitle.trim()) {
            return potentialTitle.trim();
        }

        // Fallback to `details` if it's a non-empty string.
        const detailsText = String(raw.details ?? '');
        if (detailsText.trim()) {
            // Take the first line of details as the title, up to 70 chars.
            const firstLine = detailsText.split('\n')[0].trim();
            return firstLine.length > 70 ? firstLine.substring(0, 67) + '...' : firstLine;
        }

        // If no suitable title can be found, return a default.
        return 'Untitled Entry';
    };

    // Process Tags
    const tagIds: string[] = [];
    if (Array.isArray(rawEvent.tags)) {
        for (const tagName of rawEvent.tags) {
            const sanitizedTagName = String(tagName ?? '').trim();
            if (!sanitizedTagName) continue;

            const tagId = `tag-${sanitizedTagName.replace(/\s+/g, '-').toLowerCase()}`;
            if (!allTags.has(tagId)) {
                // FIX: Changed 'mainImage' to 'mainImageId' to conform to the BaseTag/UnknownTag types.
                // Set to undefined as it's unknown during import.
                // FIX: Added missing mediaIds property
                allTags.set(tagId, {
                    id: tagId,
                    name: sanitizedTagName,
                    type: 'unknown', // Default type for imported tags
                    mainImageId: undefined,
                    mediaGallery: [],
                    description: '',
                    privateNotes: '',
                    isPrivate: false,
                    tagIds: [],
                    mediaIds: [],
                    metadata: {},
                });
            }
            tagIds.push(tagId);
        }
    }

    // Process Media
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
                fileType: 'image/jpeg', // Assume jpeg
                tagIds: [],
            };
            allMedia.push(newMedia);
            mediaIds.push(mediaId);
        }
    }

    // Create LifeEvent, ensuring every field exists with a default value to prevent data loss.
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
    };
};


/**
 * Parses legacy JSON or JS Object data from a string and transforms it into the application's data model.
 * It intelligently handles multiple formats and provides clear error messages.
 * @param fileContent The raw string content from a user-provided file.
 */
export const parseLegacyData = (fileContent: string): { events: LifeEvent[], tags: Tag[], media: Media[] } => {
    console.log('[Importer] Starting parseLegacyData...');
    if (typeof fileContent !== 'string' || fileContent.trim().length === 0) {
        console.error('[Importer] File is empty or not a string.');
        throw new Error("The selected file is empty or contains only whitespace.");
    }

    // Remove BOM (Byte Order Mark) if present.
    if (fileContent.charCodeAt(0) === 0xFEFF) {
        fileContent = fileContent.substring(1);
    }

    const trimmedContent = fileContent.trim();

    // Find the start of the first JSON object or array
    const firstCurly = trimmedContent.indexOf('{');
    const firstSquare = trimmedContent.indexOf('[');

    let startIndex = -1;
    if (firstCurly === -1 && firstSquare === -1) {
        console.error("[Importer] Could not find a starting '{' or '['.");
        throw new Error("Could not find a starting '{' or '['. The file does not appear to contain a JSON object or array.");
    }

    if (firstCurly === -1) {
        startIndex = firstSquare;
    } else if (firstSquare === -1) {
        startIndex = firstCurly;
    } else {
        startIndex = Math.min(firstCurly, firstSquare);
    }
    console.log(`[Importer] Found starting bracket at index: ${startIndex}`);

    const openChar = trimmedContent[startIndex];
    const closeChar = openChar === '{' ? '}' : ']';
    let balance = 1;
    let endIndex = -1;

    // Use a bracket-balancing algorithm to find the correct end of the data structure
    for (let i = startIndex + 1; i < trimmedContent.length; i++) {
        const char = trimmedContent[i];
        if (char === openChar) {
            balance++;
        } else if (char === closeChar) {
            balance--;
        }

        if (balance === 0) {
            endIndex = i;
            break;
        }
    }

    if (endIndex === -1) {
        console.error("[Importer] Unbalanced brackets in data structure.");
        throw new Error(`Found a starting '${openChar}' but the data structure seems to be incomplete or malformed (unbalanced brackets).`);
    }

    const jsonString = trimmedContent.substring(startIndex, endIndex + 1);
    console.log(`[Importer] Extracted potential JSON/JS object string of length: ${jsonString.length}`);
    let parsedJson: any;

    try {
        console.log('[Importer] Attempting strict JSON.parse...');
        parsedJson = JSON.parse(jsonString);
        console.log('[Importer] Strict JSON.parse successful.');
    } catch (jsonError) {
        console.warn('[Importer] Strict JSON.parse failed. Attempting lenient JS object parse.');
        try {
            parsedJson = new Function(`return (${jsonString})`)();
            console.log('[Importer] Lenient JS object parse successful.');
        } catch (lenientError: any) {
            console.error('[Importer] Lenient JS object parse also failed.', lenientError);
            throw new Error(`The file has a syntax error within the data structure. The parser reported: ${lenientError.message}`);
        }
    }

    const allEvents: LifeEvent[] = [];
    const allMedia: Media[] = [];
    const allTags: Map<string, Tag> = new Map();

    let dataToParse = parsedJson;
    console.log('[Importer] Data parsed. Detecting format...');

    // Check for and unwrap a common "historyData" wrapper object, ignoring other top-level keys like "tagData".
    if (dataToParse && typeof dataToParse === 'object' && dataToParse.historyData) {
        console.log('[Importer] Found "historyData" wrapper. Unwrapping...');
        dataToParse = dataToParse.historyData;
    }

    // Handle standard array of event objects format
    if (Array.isArray(dataToParse)) {
        console.log(`[Importer] Detected array format with ${dataToParse.length} items. Processing events...`);
        for (const rawEvent of dataToParse) {
            if (!rawEvent || !rawEvent.date) continue;

            const eventDate = parseFlexibleDate(rawEvent.date);
            if (!eventDate) continue; // Skip if date is completely unparseable

            const newEvent = processEventObject(rawEvent, eventDate, allTags, allMedia);
            allEvents.push(newEvent);
        }
    }
    // Handle the original year-based object structure
    else if (typeof dataToParse === 'object' && dataToParse !== null) {
        console.log(`[Importer] Detected object format with keys: ${Object.keys(dataToParse).join(', ')}. Processing year keys...`);
        for (const year in dataToParse) {
            // Ensure the key is a year and an own property
            if (dataToParse.hasOwnProperty(year) && /^\d{4}$/.test(year)) {
                const yearData = dataToParse[year as keyof typeof dataToParse];
                if (!yearData || typeof yearData !== 'object') continue;

                for (let [dateStr, rawEvent] of Object.entries(yearData as any)) {
                    if (!rawEvent || typeof rawEvent !== 'object') continue;

                    const dateStringToParse = dateStr === 'null' ? '??-??' : dateStr;
                    const eventDate = parseFlexibleDate(dateStringToParse, parseInt(year, 10));
                    if (!eventDate) continue; // Skip if date is unparseable

                    const newEvent = processEventObject(rawEvent, eventDate, allTags, allMedia);
                    allEvents.push(newEvent);
                }
            }
        }
    }
    // If format is neither, throw an error
    else {
        console.error('[Importer] Unrecognized data format.');
        throw new Error("Unrecognized JSON format. The file should contain an array of events or an object with years as keys.");
    }

    // After attempting to parse, if no events were found, it's a problem.
    if (allEvents.length === 0) {
        console.error('[Importer] No valid events could be extracted from the parsed data.');
        throw new Error("The provided file was parsed, but no valid events were found. Please check the file's structure and content.");
    }

    console.log(`[Importer] Finished processing. Total found: ${allEvents.length} events, ${allTags.size} tags, ${allMedia.length} media.`);
    return {
        events: allEvents,
        tags: Array.from(allTags.values()),
        media: allMedia,
    };
};