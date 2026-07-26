import type { User, LifeEvent, Tag, Media, ChatMessage, GigiJournalEntry } from '@/types';
import { dbGet, dbPut, dbGetAll, dbClearStore, dbDelete, closeDB } from './dbService';
import { mockEvents, mockMedia, mockTags } from '../mockData'; // [ZEN FIX] Corrected import path
import { sanitizeAllEvents, sanitizeAllMedia, sanitizeAllTags } from './dataValidator';
import { blobToBase64 } from '../utils/fileUtils';

const USER_STORE_NAME = 'users';
const EVENTS_STORE_NAME = 'events';
const TAGS_STORE_NAME = 'tags';
const MEDIA_STORE_NAME = 'media';
const CHAT_HISTORY_STORE_NAME = 'chatHistory';
const GIGI_JOURNAL_STORE_NAME = 'gigiJournal';

// --- [ZEN FIX] UPLOAD LOGIC FOR LOCAL MODE ---
export const uploadMedia = async (userId: string, file: File): Promise<void> => {
    console.log("[LocalDB] Processing local file upload...");

    // 1. Convert to Base64 (Local Storage mode has no bucket)
    const base64 = await blobToBase64(file);
    const dataUrl = `data:${file.type};base64,${base64}`;

    // 2. Create Media Object
    const newMedia: Media = {
        id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url: dataUrl,
        thumbnailUrl: dataUrl,
        caption: file.name,
        uploadDate: new Date(),
        fileType: file.type,
        fileName: file.name,
        size: file.size,
        base64Data: base64, // We MUST keep this for local mode to work
        tagIds: [],
        mediaIds: [],
        status: 'clean'
    };

    // 3. Save to IndexDB
    await dbPut(MEDIA_STORE_NAME, newMedia);
    console.log("[LocalDB] File saved to IndexDB.");
};

// --- CRUD EXPORTS ---

export const getUserProfile = async (userId: string): Promise<User | null> => {
    const user = await dbGet<User>(USER_STORE_NAME, userId);
    if (user) {
        if (user.joinDate) {
            user.joinDate = new Date(user.joinDate);
            if (isNaN(user.joinDate.getTime())) {
                user.joinDate = new Date();
            }
        } else {
            user.joinDate = new Date();
        }
    }
    return user || null;
};

export const getAllUserProfiles = async (): Promise<User[]> => {
    const users = await dbGetAll<User>(USER_STORE_NAME);
    return users
        .filter(u => u && typeof u === 'object' && u.email)
        .map(user => {
            let validDate = new Date();
            if (user.joinDate) {
                const parsed = new Date(user.joinDate);
                if (!isNaN(parsed.getTime())) {
                    validDate = parsed;
                }
            }
            return { ...user, joinDate: validDate };
        });
};

export const updateUserProfile = async (userId: string, data: User): Promise<void> => {
    await dbPut(USER_STORE_NAME, { ...data, id: userId });
};

export const getChatHistory = async (userId: string): Promise<ChatMessage[]> => {
    const result = await dbGet<{ userId: string; history: ChatMessage[] }>(CHAT_HISTORY_STORE_NAME, userId);
    if (result && Array.isArray(result.history)) {
        return result.history
            .filter(msg => msg && msg.timestamp)
            .map(msg => ({ ...msg, timestamp: new Date(msg.timestamp) }))
            .filter(msg => !isNaN(msg.timestamp.getTime()));
    }
    return [];
};
export const saveChatHistory = async (userId: string, history: ChatMessage[]): Promise<void> => {
    await dbPut(CHAT_HISTORY_STORE_NAME, { userId, history });
};

export const getGigiJournal = async (userId: string): Promise<GigiJournalEntry[]> => {
    const entries = await dbGetAll<GigiJournalEntry>(GIGI_JOURNAL_STORE_NAME);
    if (entries && Array.isArray(entries)) {
        return entries
            .filter(e => e && e.creationDate)
            .map(e => ({ ...e, creationDate: new Date(e.creationDate) }))
            .filter(e => !isNaN(e.creationDate.getTime()));
    }
    return [];
};
export const saveGigiJournalEntry = async (userId: string, entry: GigiJournalEntry): Promise<void> => {
    await dbPut(GIGI_JOURNAL_STORE_NAME, entry);
};
export const deleteGigiJournalEntry = async (userId: string, entryId: string): Promise<void> => {
    await dbDelete(GIGI_JOURNAL_STORE_NAME, entryId);
};


export const saveEvent = async (userId: string, event: LifeEvent): Promise<void> => {
    await dbPut(EVENTS_STORE_NAME, event);
};
export const deleteEvent = async (userId: string, eventId: string): Promise<void> => {
    await dbDelete(EVENTS_STORE_NAME, eventId);
};
export const saveTag = async (userId: string, tag: Tag): Promise<void> => {
    await dbPut(TAGS_STORE_NAME, tag);
};
export const deleteTag = async (userId: string, tagId: string): Promise<void> => {
    await dbDelete(TAGS_STORE_NAME, tagId);
};
export const saveMedia = async (userId: string, media: Media): Promise<void> => {
    await dbPut(MEDIA_STORE_NAME, media);
};
export const deleteMedia = async (userId: string, mediaId: string): Promise<void> => {
    await dbDelete(MEDIA_STORE_NAME, mediaId);
};
export const getAllEvents = async (userId: string): Promise<LifeEvent[]> => {
    const events = await dbGetAll<LifeEvent>(EVENTS_STORE_NAME);
    return sanitizeAllEvents(events);
};
export const getAllTags = async (userId: string): Promise<Tag[]> => {
    const tags = await dbGetAll<Tag>(TAGS_STORE_NAME);
    return sanitizeAllTags(tags);
};
export const getAllMedia = async (userId: string): Promise<Media[]> => {
    const media = await dbGetAll<Media>(MEDIA_STORE_NAME);
    return sanitizeAllMedia(media);
};

export const importLegacyData = async (userId: string, data: { events: LifeEvent[], tags: Tag[], media: Media[] }): Promise<void> => {
    await dbClearStore(EVENTS_STORE_NAME);
    await dbClearStore(TAGS_STORE_NAME);
    await dbClearStore(MEDIA_STORE_NAME);
    const eventsPromise = Promise.all(data.events.map(event => dbPut(EVENTS_STORE_NAME, event)));
    const tagsPromise = Promise.all(data.tags.map(tag => dbPut(TAGS_STORE_NAME, tag)));
    const mediaPromise = Promise.all(data.media.map(media => dbPut(MEDIA_STORE_NAME, media)));
    await Promise.all([eventsPromise, tagsPromise, mediaPromise]);
};
export const resetAndSeedDatabase = async (userId: string): Promise<void> => {
    await dbClearStore(EVENTS_STORE_NAME);
    await dbClearStore(TAGS_STORE_NAME);
    await dbClearStore(MEDIA_STORE_NAME);
    await initializeMockData();
};
export const initializeMockData = async (): Promise<void> => {
    const eventsPromise = Promise.all(mockEvents.map(event => dbPut(EVENTS_STORE_NAME, event)));
    const tagsPromise = Promise.all(mockTags.map(tag => dbPut(TAGS_STORE_NAME, tag)));
    const mediaPromise = Promise.all(mockMedia.map(media => dbPut(MEDIA_STORE_NAME, media)));
    await Promise.all([eventsPromise, tagsPromise, mediaPromise]);
};
export const exportAllData = async (userId: string, includeConfig: boolean = false): Promise<object> => {
    const users = await dbGetAll<User>(USER_STORE_NAME);
    const events = await dbGetAll<LifeEvent>(EVENTS_STORE_NAME);
    const tags = await dbGetAll<Tag>(TAGS_STORE_NAME);
    const media = await dbGetAll<Media>(MEDIA_STORE_NAME);
    const chatHistory = await dbGetAll(CHAT_HISTORY_STORE_NAME);
    const gigiJournal = await dbGetAll<GigiJournalEntry>(GIGI_JOURNAL_STORE_NAME);

    const exportData: any = { users, events, tags, media, chatHistory, gigiJournal };

    if (includeConfig) {
        try {
            const configStr = localStorage.getItem('gigi_firebase_config');
            if (configStr) {
                exportData.firebaseConfig = JSON.parse(configStr);
                console.log("[Export] Included Firebase configuration keys in backup.");
            }
        } catch (e) {
            console.error("[Export] Failed to include firebase config", e);
        }
    }

    return exportData;
};
export const importBackupData = async (data: any, targetUserId?: string, onProgress?: (header: string, detail: string, current: number, total: number) => void): Promise<void> => {
    if (!data || typeof data !== 'object') {
        throw new Error("Invalid backup file format.");
    }

    const chatHistoryToImport = Array.isArray(data.chatHistory) ? data.chatHistory : [];
    const gigiJournalToImport = Array.isArray(data.gigiJournal) ? data.gigiJournal : [];
    const usersToImport = Array.isArray(data.users) ? data.users : [];
    const events = Array.isArray(data.events) ? data.events : [];
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const media = Array.isArray(data.media) ? data.media : [];

    const totalItems = usersToImport.length + events.length + tags.length + media.length + chatHistoryToImport.length + gigiJournalToImport.length;
    let processedItems = 0;

    const report = (header: string, detail: string) => {
        processedItems++;
        if (onProgress) onProgress(header, detail, processedItems, totalItems);
    }

    await Promise.all([
        dbClearStore(USER_STORE_NAME),
        dbClearStore(EVENTS_STORE_NAME),
        dbClearStore(TAGS_STORE_NAME),
        dbClearStore(MEDIA_STORE_NAME),
        dbClearStore(CHAT_HISTORY_STORE_NAME),
        dbClearStore(GIGI_JOURNAL_STORE_NAME)
    ]);

    for (const u of usersToImport) { await dbPut(USER_STORE_NAME, u); report("SYSTEM", "Profile: " + (u.displayName || "User")); }
    for (const e of events) { await dbPut(EVENTS_STORE_NAME, e); report("EVENTS", e.title || "Event"); }
    for (const t of tags) { await dbPut(TAGS_STORE_NAME, t); report("TAGS", t.name || "Tag"); }
    for (const m of media) { await dbPut(MEDIA_STORE_NAME, m); report("MEDIA MATRIX", m.fileName || "Media File"); }
    for (const c of chatHistoryToImport) { await dbPut(CHAT_HISTORY_STORE_NAME, c); report("CHAT LOGS", "History Segment"); }
    for (const j of gigiJournalToImport) { await dbPut(GIGI_JOURNAL_STORE_NAME, j); report("MEMORIES", j.title || "Journal Entry"); }
};

export const migrateMediaToCloud = async (userId: string, onProgress: (current: number, total: number) => void): Promise<void> => {
    console.log("[LocalDB] Migration not supported in local mode. Use Firebase.");
    return Promise.resolve();
};

// [ZEN FIX] Restored missing function required by useGigiUI
export const clearLocalDataAfterSync = async () => {
    await Promise.all([
        dbClearStore(EVENTS_STORE_NAME),
        dbClearStore(TAGS_STORE_NAME),
        dbClearStore(MEDIA_STORE_NAME),
        dbClearStore(GIGI_JOURNAL_STORE_NAME),
        dbClearStore(CHAT_HISTORY_STORE_NAME),
    ]);
    console.log("[LocalDB] Local data stores cleared after sync.");
};