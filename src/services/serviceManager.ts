import { isFirebaseConfigured } from '../firebaseConfig';

import * as localDb from './localDbService';
import * as firebaseDb from './sovereignDbService';

// [ZEN EWO #130] Vector Backfill Utility (Console Access)
import './vectorBackfill';

interface AppDataService {
    getUserProfile: (userId: string) => Promise<any | null>;
    getAllUserProfiles: () => Promise<any[]>;
    updateUserProfile: (userId: string, data: Partial<any>) => Promise<void>;
    deleteUserProfile: (userId: string) => Promise<void>;

    getFullChatHistory: (userId: string) => Promise<any[]>; // [ZEN FIX]

    getChatHistory: (userId: string) => Promise<any[]>;
    saveChatHistory: (userId: string, history: any[]) => Promise<void>;
    updateChatMessage: (userId: string, msgId: string, updates: Partial<any>) => Promise<void>; // [ZEN FIX] Chronology
    deleteChatHistory: (userId: string) => Promise<void>;
    getGigiJournal: (userId: string) => Promise<any[]>;
    saveGigiJournalEntry: (userId: string, entry: any) => Promise<void>;
    deleteGigiJournalEntry: (userId: string, entryId: string) => Promise<void>;
    saveEvent: (userId: string, event: any) => Promise<void>;
    deleteEvent: (userId: string, eventId: string) => Promise<void>;
    saveTag: (userId: string, tag: any) => Promise<void>;
    getTag: (userId: string, tagId: string) => Promise<any | null>;
    deleteTag: (userId: string, tagId: string) => Promise<void>;
    uploadMedia: (userId: string, file: File) => Promise<void>;
    saveMedia: (userId: string, media: any, targetCollection?: string) => Promise<void>;
    deleteMedia: (userId: string, mediaId: string, targetCollection?: string) => Promise<void>;
    getMediaById: (mediaId: string, userId: string) => Promise<any | null>;
    getAllEvents: (userId: string) => Promise<any[]>;
    getAllTags: (userId: string) => Promise<any[]>;
    getAllMedia: (userId: string) => Promise<any[]>;
    importLegacyData: (userId: string, data: any) => Promise<void>;
    stageLegacyData: (userId: string, data: any) => Promise<void>; // [ZEN] Firewall Import
    resetAndSeedDatabase: (userId: string) => Promise<void>;

    // [ZEN NEW] Vanity Slug Public Index Routing Sync
    checkSlugAvailability?: (slug: string, requestingUserId: string) => Promise<boolean>;
    generateSlugAlternatives?: (slug: string) => Promise<string[]>;
    exportAllData: (userId: string, includeConfig?: boolean) => Promise<object>;
    importBackupData: (data: any, targetUserId?: string, onProgress?: (header: string, detail: string, current: number, total: number) => void) => Promise<void>;
    migrateMediaToCloud: (userId: string, onProgress: (current: number, total: number) => void) => Promise<void>;

    // [ZEN V32] Vantablack Shutter
    updateTagsExposureModeBulk: (userId: string, tagIds: string[], mode: 'white' | 'grey' | 'black') => Promise<void>;

    // Daydream Studio
    saveDaydream: (userId: string, story: any) => Promise<void>;
    getDaydreams: (userId: string) => Promise<any[]>;
    getDaydream: (userId: string, storyId: string) => Promise<any | null>;
    deleteDaydream: (userId: string, storyId: string) => Promise<void>;

    // Custom Presets
    getUserPresets: (userId: string) => Promise<any[]>;
    saveUserPreset: (userId: string, preset: any) => Promise<void>;
    deleteUserPreset: (userId: string, presetId: string) => Promise<void>;
    
    // Comms
    saveCommsMessage: (userId: string, message: any) => Promise<void>;

    // [ZEN] Memorial Airlock
    rejectContribution: (userId: string, contributionId: string) => Promise<void>;
    
    // [ZEN] Shoebox Staging
    stageArtifact: (userId: string, artifact: any) => Promise<void>;

    // [ZEN] Sovereign Model Gateway
    getAIModelRegistry: (userId: string) => Promise<any | null>;
    updateAIModelRegistry: (userId: string, registry: any) => Promise<void>;
}

let appDataService: AppDataService;
let initializationSuccessful = false;

try {
    if (isFirebaseConfigured()) {
        // console.log("%c[System] ATTEMPTING CLOUD CONNECTION...", "color: #00e7ff");
        // [ZEN] Auth is now fully handled by Clerk.
        // firebaseDb.initializeFirestore(); // Obsolete

        // [ZEN FIX] CLONE the frozen import object to make it extensible
        const db = { ...firebaseDb } as any;

        // Polyfill missing method
        if (!db.getFullChatHistory) {
            db.getFullChatHistory = db.getChatHistory;
        }

        appDataService = db as AppDataService;
        initializationSuccessful = true;
        // console.log("%c[System] CLOUD MODE ACTIVE", "background: #003b6f; color: #fff; font-size: 12px; padding: 4px; border-radius: 4px;");
    } else {
        throw new Error("Firebase config missing placeholders");
    }
} catch (error) {
    console.warn("[System] Firebase initialization failed or keys missing. Falling back to LOCAL MODE.", error);
    console.log("%c[System] LOCAL MODE ACTIVE", "background: #f59e0b; color: #000; font-size: 12px; padding: 4px; border-radius: 4px;");

    // [ZEN FIX] CLONE localDb too
    const db = { ...localDb } as any;
    if (!db.getFullChatHistory) {
        db.getFullChatHistory = db.getChatHistory;
    }

    appDataService = db as AppDataService;
    initializationSuccessful = false;
}

// [ZEN HARDENING] Final sanity check: Ensure stageArtifact exists in the active service
if (appDataService && !(appDataService as any).stageArtifact) {
    (appDataService as any).stageArtifact = async (uid: string, art: any) => {
        console.warn("[System] stageArtifact NOT IMPLEMENTED in current DB provider. No-op.");
    };
}

const initializeServices = (): boolean => {
    return initializationSuccessful;
};

export { appDataService, initializeServices };