import { doc, getDoc, collection, getDocs, writeBatch, setDoc, addDoc } from './sovereignDbAdapter';
import { Timestamp } from './sovereignDbAdapter';
import { db, USERS_COLLECTION, EVENTS_COLLECTION, TAGS_COLLECTION, MEDIA_COLLECTION, CHAT_HISTORY_COLLECTION, CHAT_SEGMENTS_COLLECTION, getSubcollectionRef, cleanForFirestore, convertTimestampsToDates } from './sovereignCore';
import type { LifeEvent, Tag, Media } from '../types';

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

/**
 * [ZEN] Archive Firewall
 * Stages legacy data into the persistent triage pipeline (pending_accessions)
 * instead of committing directly to the Matrix.
 */
export const stageLegacyData = async (userId: string, data: { events: LifeEvent[], tags: Tag[], media: Media[], journal?: any[], signals?: any[] }): Promise<void> => {
    const batchId = `import_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const stagingRef = collection(db, USERS_COLLECTION, userId, 'pending_accessions');
    
    // Combine all items to be staged
    const allStagingItems: any[] = [];

    // Helper to robustly resolve a timestamp from various possible fields
    const resolveTimestamp = (item: any, fallbackField?: string): Timestamp => {
        const rawDate = item.logicalDate || (fallbackField ? item[fallbackField] : null);
        if (!rawDate) return Timestamp.now();
        
        try {
            const dateObj = rawDate instanceof Date ? rawDate : new Date(rawDate);
            if (isNaN(dateObj.getTime())) return Timestamp.now();
            return Timestamp.fromDate(dateObj);
        } catch (e) {
            return Timestamp.now();
        }
    };

    // Stage Events (and embed their media so the Gateway displays them as one node)
    const eventMediaIds = new Set<string>();
    data.events.forEach(e => {
        if (e.mediaIds) {
            e.mediaIds.forEach(id => eventMediaIds.add(id));
        }
        
        const attachedMedia = data.media.filter(m => e.mediaIds?.includes(m.id));
        const firstMedia = attachedMedia[0];

        allStagingItems.push({
            ...e,
            type: (e as any).type || 'event',
            status: 'pending',
            source: 'archive_import',
            importId: batchId,
            createdAt: Timestamp.now(),
            logicalDate: resolveTimestamp(e, 'date'),
            
            // [ZEN] Inject Media metadata so the Gateway displays the photo ON the Event card
            attachedMedia,
            mediaUrl: firstMedia?.url || null,
            fileSize: firstMedia?.size || null,
            metadata: firstMedia ? { 
                width: firstMedia.width || 0, 
                height: firstMedia.height || 0, 
                aspectRatio: firstMedia.aspectRatio || (firstMedia.width && firstMedia.height ? firstMedia.width / firstMedia.height : 1)
            } : { width: 0, height: 0, aspectRatio: 1 },

            triage: {
                title: e.title,
                summary: e.details || (e as any).textContent || 'Imported memory',
                suggestedTags: e.tagIds
            }
        });
    });

    // Stage Journal Entries (Narrative Volumes)
    if (data.journal) {
        data.journal.forEach(j => {
            allStagingItems.push({
                ...j,
                type: 'journal',
                status: 'pending',
                source: 'archive_import',
                importId: batchId,
                createdAt: Timestamp.now(),
                logicalDate: resolveTimestamp(j, 'creationDate'),
                triage: {
                    title: j.title,
                    summary: `Narrative Volume: ${j.content.substring(0, 100)}...`,
                    suggestedTags: j.tagIds
                }
            });
        });
    }

    // Stage Signals (Digital Exhaust)
    if (data.signals) {
        data.signals.forEach(s => {
            allStagingItems.push({
                ...s,
                type: 'signal',
                status: 'pending',
                source: 'archive_import',
                importId: batchId,
                createdAt: Timestamp.now(),
                logicalDate: resolveTimestamp(s, 'timestamp'),
                triage: {
                    title: s.subject,
                    summary: s.body,
                    suggestedTags: []
                }
            });
        });
    }

    // Stage Media artifacts (ONLY if they are NOT attached to an event, to avoid duplicate Gateway cards)
    data.media.forEach(m => {
        if (!eventMediaIds.has(m.id)) {
            allStagingItems.push({
                ...m,
                type: 'media',
                mediaUrl: m.url,
                status: 'pending',
                source: 'archive_import',
                importId: batchId,
                createdAt: Timestamp.now(),
                logicalDate: resolveTimestamp(m, 'uploadDate'),
                triage: {
                    title: m.caption || 'Imported Media',
                    suggestedTags: m.tagIds
                }
            });
        }
    });

    // [ZEN] Stage Provisional Tags (Person Discovery)
    data.tags.forEach(t => {
        allStagingItems.push({
            ...t,
            type: 'tag',
            status: 'pending',
            source: 'archive_import',
            importId: batchId,
            createdAt: Timestamp.now(),
            logicalDate: Timestamp.now(), // Tags don't have a logical date, but we need one for the Gateway sort
            triage: {
                title: t.name,
                summary: `Provisional Person Tag discovered in archive.`,
                suggestedTags: []
            }
        });
    });

    // Execute in batches of 400 to stay safely under the 500 limit
    const batchSize = 400;
    for (let i = 0; i < allStagingItems.length; i += batchSize) {
        const chunk = allStagingItems.slice(i, i + batchSize);
        const batch = writeBatch(db);
        
        chunk.forEach(item => {
            const ref = doc(stagingRef);
            batch.set(ref, cleanForFirestore(item));
        });
        
        await batch.commit();
        console.log(`[Importer] Committed batch ${i / batchSize + 1} of ${Math.ceil(allStagingItems.length / batchSize)}`);
    }

    console.log(`[Importer] Successfully staged ${allStagingItems.length} items (Batch: ${batchId})`);
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