import { isFirebaseConfigured } from '../firebaseConfig';
import { initializeAuth } from './authService';

import * as localDb from './localDbService';
import * as firebaseDb from './firebaseDbService';
import { clearUserChatMemory } from './searchService';

interface AppDataService {
    getUserProfile: (userId: string) => Promise<any | null>;
    getAllUserProfiles: () => Promise<any[]>;
    updateUserProfile: (userId: string, data: any) => Promise<void>;

    getFullChatHistory: (userId: string) => Promise<any[]>;

    getChatHistory: (userId: string) => Promise<any[]>;
    saveChatHistory: (userId: string, history: any[]) => Promise<void>;
    deleteChatHistory: (userId: string) => Promise<string[]>; // [ZEN NEW]

    getGigiJournal: (userId: string) => Promise<any[]>;
    saveGigiJournalEntry: (userId: string, entry: any) => Promise<void>;
    deleteGigiJournalEntry: (userId: string, entryId: string) => Promise<void>;
    saveEvent: (userId: string, event: any) => Promise<void>;
    deleteEvent: (userId: string, eventId: string) => Promise<void>;
    saveTag: (userId: string, tag: any) => Promise<void>;
    deleteTag: (userId: string, tagId: string) => Promise<void>;
    uploadMedia: (userId: string, file: File) => Promise<void>;
    saveMedia: (userId: string, media: any) => Promise<void>;
    deleteMedia: (userId: string, mediaId: string) => Promise<void>;
    getAllEvents: (userId: string) => Promise<any[]>;
    getAllTags: (userId: string) => Promise<any[]>;
    getAllMedia: (userId: string) => Promise<any[]>;
    importLegacyData: (userId: string, data: any) => Promise<void>;
    resetAndSeedDatabase: (userId: string) => Promise<void>;
    exportAllData: (userId: string, includeConfig?: boolean) => Promise<object>;
    importBackupData: (data: any, targetUserId?: string, onProgress?: (header: string, detail: string, current: number, total: number) => void) => Promise<void>;
    migrateMediaToCloud: (userId: string, onProgress: (current: number, total: number) => void) => Promise<void>;
}

let appDataService: AppDataService;
let initializationSuccessful = false;

try {
    if (isFirebaseConfigured()) {
        console.log("%c[System] ATTEMPTING FIREBASE CONNECTION...", "color: #00e7ff");
        initializeAuth();
        firebaseDb.initializeFirestore();

        const db = { ...firebaseDb } as any;

        // Polyfill missing method mapping
        if (!db.getFullChatHistory) db.getFullChatHistory = db.getChatHistory;
        if (!db.deleteChatHistory) db.deleteChatHistory = db.deleteAllChatData;

        appDataService = db as AppDataService;
        initializationSuccessful = true;
        console.log("%c[System] FIREBASE MODE ACTIVE", "background: #003b6f; color: #fff; font-size: 12px; padding: 4px; border-radius: 4px;");
    } else {
        throw new Error("Firebase config missing placeholders");
    }
} catch (error) {
    console.warn("[System] Firebase initialization failed. Falling back to LOCAL MODE.", error);

    const db = { ...localDb } as any;
    if (!db.getFullChatHistory) db.getFullChatHistory = db.getChatHistory;
    if (!db.deleteChatHistory) db.deleteChatHistory = async () => []; // No-op for local

    appDataService = db as AppDataService;
    initializationSuccessful = false;
}

const initializeServices = (): boolean => initializationSuccessful;

export { appDataService, initializeServices };