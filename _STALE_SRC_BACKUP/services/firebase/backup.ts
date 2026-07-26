import { doc, getDoc, collection, getDocs, writeBatch, setDoc, addDoc } from 'firebase/firestore';
import { db, USERS_COLLECTION, EVENTS_COLLECTION, TAGS_COLLECTION, MEDIA_COLLECTION, CHAT_HISTORY_COLLECTION, CHAT_SEGMENTS_COLLECTION, getSubcollectionRef, cleanForFirestore, convertTimestampsToDates } from './core';
import type { LifeEvent, Tag, Media } from '@/types';

export const importLegacyData = async (userId: string, data: { events: LifeEvent[], tags: Tag[], media: Media[] }): Promise<void> => {
    const batch = writeBatch(db);
    
    data.events.forEach(e => {
        if (!e.id) return;
        const ref = doc(getSubcollectionRef(userId, EVENTS_COLLECTION), e.id);
        batch.set(ref, cleanForFirestore(convertTimestampsToDates(e)));
    });
    
    data.tags.forEach(t => {
        if (!t.id) return;
        const ref = doc(getSubcollectionRef(userId, TAGS_COLLECTION), t.id);
        batch.set(ref, cleanForFirestore(convertTimestampsToDates(t)));
    });
    
    data.media.forEach(m => {
        if (!m.id) return;
        const ref = doc(getSubcollectionRef(userId, MEDIA_COLLECTION), m.id);
        batch.set(ref, cleanForFirestore(convertTimestampsToDates(m)));
    });
    
    await batch.commit();
};

export const exportAllData = async (userId: string, includeConfig: boolean = false): Promise<object> => {
    console.log(`[Export] Starting full archive dump for ${userId}...`);
    
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    const userData = userDoc.exists() ? userDoc.data() : null;

    const eventsSnap = await getDocs(collection(db, USERS_COLLECTION, userId, EVENTS_COLLECTION));
    const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const tagsSnap = await getDocs(collection(db, USERS_COLLECTION, userId, TAGS_COLLECTION));
    const tags = tagsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const mediaSnap = await getDocs(collection(db, USERS_COLLECTION, userId, MEDIA_COLLECTION));
    const media = mediaSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const journalSnap = await getDocs(collection(db, USERS_COLLECTION, userId, 'gigiJournal'));
    const journals = journalSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let chatHistory = [];
    try {
        const legacyChatRef = doc(db, USERS_COLLECTION, userId, CHAT_HISTORY_COLLECTION, 'history');
        const legacySnap = await getDoc(legacyChatRef);
        if (legacySnap.exists()) {
            chatHistory = legacySnap.data().history || [];
        }
    } catch (e) {
        console.warn("[Export] Legacy history export failed", e);
    }

    let chatSegments: any[] = [];
    try {
        const segmentsRef = collection(db, USERS_COLLECTION, userId, CHAT_SEGMENTS_COLLECTION);
        const segmentsSnap = await getDocs(segmentsRef);
        chatSegments = segmentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`[Export] Retrieved ${chatSegments.length} chat segments.`);
    } catch (e) {
        console.warn("[Export] Chat segments export failed", e);
    }

    let firebaseConfig = undefined;
    if (includeConfig) {
        const configStr = localStorage.getItem('gigi_firebase_config');
        if (configStr) firebaseConfig = JSON.parse(configStr);
    }

    return {
        users: userData ? [userData] : [],
        events,
        tags,
        media,
        gigiJournal: journals,
        chatHistory: { history: chatHistory },
        chatSegments: chatSegments,
        firebaseConfig,
        meta: {
            exportDate: new Date().toISOString(),
            version: "2.1",
            app: "GIGI"
        }
    };
};

export const importBackupData = async (data: any, targetUserId?: string, onProgress?: (header: string, detail: string, current: number, total: number) => void): Promise<void> => {
    if (!targetUserId) throw new Error("Target User ID required for Cloud Import.");
    
    const processedData = convertTimestampsToDates(data);
    
    const events = Array.isArray(processedData.events) ? processedData.events : [];
    const tags = Array.isArray(processedData.tags) ? processedData.tags : [];
    const media = Array.isArray(processedData.media) ? processedData.media : [];
    const journals = Array.isArray(processedData.gigiJournal) ? processedData.gigiJournal : [];
    
    const legacyHistory = processedData.chatHistory?.history || (Array.isArray(processedData.chatHistory) ? processedData.chatHistory : []);
    const segmentHistory = Array.isArray(processedData.chatSegments) ? processedData.chatSegments : [];
    const allChatItems = [...legacyHistory, ...segmentHistory];

    const totalOperations = 1 + events.length + tags.length + media.length + journals.length;
    let completedOperations = 0;

    const reportProgress = (header: string, detail: string) => {
        completedOperations++;
        if (onProgress) onProgress(header, detail, completedOperations, totalOperations);
    };

    const usersToImport = Array.isArray(processedData.users) ? processedData.users : [];
    if (usersToImport.length > 0) {
        try {
            const sourceUser = usersToImport[0];
            if (sourceUser && Array.isArray(sourceUser.aiCompanions)) {
                const userRef = doc(db, USERS_COLLECTION, targetUserId);
                await setDoc(userRef, { aiCompanions: cleanForFirestore(sourceUser.aiCompanions) }, { merge: true });
            }
        } catch (e) {
            console.warn("Skipping user profile merge", e);
        }
    }
    reportProgress("SYSTEM", "Profiles Merged");

    const executeBatch = async (items: any[], collectionName: string, categoryHeader: string) => {
        const batchSize = 100;
        for (let i = 0; i < items.length; i += batchSize) {
            const chunk = items.slice(i, i + batchSize);
            const promises = chunk.map(async (item) => {
                if (!item || !item.id) return;
                try {
                    const sanitized = cleanForFirestore(item);
                    if (sanitized.base64Data && sanitized.base64Data.length > 1000000) {
                        delete sanitized.base64Data;
                    }
                    const ref = doc(getSubcollectionRef(targetUserId, collectionName), item.id);
                    await setDoc(ref, sanitized);
                    reportProgress(categoryHeader, item.title || item.name || "Item");
                } catch(e) { console.warn(`Skipping invalid ${categoryHeader}`, e); }
            });
            await Promise.all(promises);
        }
    };

    await executeBatch(events, EVENTS_COLLECTION, "EVENTS");
    await executeBatch(tags, TAGS_COLLECTION, "TAGS");
    await executeBatch(media, MEDIA_COLLECTION, "MEDIA MATRIX");
    await executeBatch(journals, 'gigiJournal', "MEMORIES");

    if (allChatItems.length > 0) {
        try {
            const segmentsRef = collection(db, USERS_COLLECTION, targetUserId, CHAT_SEGMENTS_COLLECTION);
            const uniqueChatItems = Array.from(new Map(allChatItems.map(item => [item.id || Math.random(), item])).values());

            const batch = writeBatch(db);
            let opCount = 0;
            
            for (const msg of uniqueChatItems) {
                const sanitizedMsg = cleanForFirestore(msg);
                const docId = (msg as any).id || `restored_${Date.now()}_${Math.random()}`;
                const docRef = doc(segmentsRef, docId);
                batch.set(docRef, sanitizedMsg);
                opCount++;
                
                if (opCount >= 400) { 
                    await batch.commit();
                    opCount = 0;
                }
            }
            if (opCount > 0) await batch.commit();
            
            reportProgress("CHAT LOGS", `Restored ${uniqueChatItems.length} messages`);
        } catch(e) { console.warn("Skipping chat history import", e); }
    }

    if (onProgress) onProgress("COMPLETE", "All data restored.", totalOperations, totalOperations);
};

export const resetAndSeedDatabase = async (_userId: string): Promise<void> => {
    console.warn("Reset not implemented for Cloud Mode.");
};