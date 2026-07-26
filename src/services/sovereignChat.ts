/**
 * ============================================================================
 * 🛑 MONGODB BACKEND — NOT FIREBASE. DO NOT WRITE NATIVE FIRESTORE QUERIES.
 * ============================================================================
 * All calls below use sovereignDbAdapter.ts (Firebase SDK facade over MongoDB).
 * VALID PATH SIGNATURES ONLY:
 *   - doc(db, 'users', userId, subcol, docId)   → 4 segments [subcol collection]
 *   - collection(db, 'users', userId, subcol)   → 3 segments [subcol collection]
 * ANY OTHER DEPTH THROWS AN ERROR BY DESIGN.
 *
 * Collections in use here:
 *   - TRANSMISSIONS_COLLECTION  → inter-user comms messages
 *   - CHAT_SEGMENTS_COLLECTION  → AI companion chat history (modern)
 *   - CHAT_HISTORY_COLLECTION   → AI companion chat history (legacy fallback)
 * ============================================================================
 */
import { doc, getDoc, collection, getDocs, writeBatch, query, orderBy, limit, updateDoc, serverTimestamp, setDoc, deleteDoc } from './sovereignDbAdapter';
import { db, USERS_COLLECTION, CHAT_SEGMENTS_COLLECTION, CHAT_HISTORY_COLLECTION, TRANSMISSIONS_COLLECTION, CHAT_SESSIONS_COLLECTION, cleanForFirestore, convertTimestampsToDates } from './sovereignCore';
import type { ChatMessage, CommsMessage, ChatSession } from '../types';

export const getMessages = async (userId: string): Promise<CommsMessage[]> => {
    try {
        // [MONGODB] 3-segment collection → TRANSMISSIONS_COLLECTION subcollection, scoped by userId
        const msgsRef = collection(db, USERS_COLLECTION, userId, TRANSMISSIONS_COLLECTION);
        const q = query(msgsRef, orderBy('timestamp', 'desc'), limit(500));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => convertTimestampsToDates({ id: doc.id, ...doc.data() }) as CommsMessage);
    } catch (e) {
        console.error("[Firestore] Failed to load comms messages:", e);
        return [];
    }
};

export const markMessageAsRead = async (userId: string, messageId: string): Promise<void> => {
    try {
        // [MONGODB] 4-segment doc → TRANSMISSIONS_COLLECTION subcollection, scoped by userId
        const msgRef = doc(db, USERS_COLLECTION, userId, TRANSMISSIONS_COLLECTION, messageId);
        await updateDoc(msgRef, { read: true });
    } catch (e) {
        console.error("[Firestore] Failed to mark message as read:", e);
    }
};

export const saveCommsMessage = async (userId: string, message: CommsMessage): Promise<void> => {
    try {
        const docId = message.id || `msg-${Date.now()}`;
        const msgRef = doc(db, USERS_COLLECTION, userId, TRANSMISSIONS_COLLECTION, docId);
        await updateDoc(msgRef, { ...cleanForFirestore(message), read: !!message.read }, { merge: true } as any);
    } catch (e) {
        // [ZEN FIX] If document doesn't exist, use setDoc instead of updateDoc
        try {
            const docId = message.id || `msg-${Date.now()}`;
            const msgRef = doc(db, USERS_COLLECTION, userId, TRANSMISSIONS_COLLECTION, docId);
            const { setDoc } = await import('./sovereignDbAdapter');
            await setDoc(msgRef, cleanForFirestore(message));
        } catch (innerErr) {
            console.error("[Firestore] Failed to save comms message:", innerErr);
        }
    }
};

// [ZEN FIX] Unified fetcher that prioritizes segments but falls back to legacy
export const getChatHistory = async (userId: string, limitCount: number = 50, sessionId?: string): Promise<ChatMessage[]> => {
    try {
        // [MONGODB] 3-segment collection → CHAT_SEGMENTS_COLLECTION subcollection, scoped by userId
        const segmentsRef = collection(db, USERS_COLLECTION, userId, CHAT_SEGMENTS_COLLECTION);
        // [ZEN FIX] Filter out deleted messages at the query level
        const { where } = await import('./sovereignDbAdapter');
        
        let q;
        if (sessionId) {
            q = query(
                segmentsRef,
                where('sessionId', '==', sessionId),
                where('isDeleted', '!=', true),
                orderBy('isDeleted'),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
        } else {
            q = query(
                segmentsRef, 
                where('isDeleted', '!=', true),
                orderBy('isDeleted'), // Required for != filter
                orderBy('timestamp', 'desc'), 
                limit(limitCount)
            );
        }

        let querySnapshot;
        try {
            querySnapshot = await getDocs(q);
        } catch (indexError) {
            console.warn("[Firestore] Index missing for isDeleted filter. Falling back to client-side filter.");
            if (sessionId) {
                querySnapshot = await getDocs(query(segmentsRef, where('sessionId', '==', sessionId), orderBy('timestamp', 'desc'), limit(limitCount)));
            } else {
                querySnapshot = await getDocs(query(segmentsRef, orderBy('timestamp', 'desc'), limit(limitCount)));
            }
        }

        if (!querySnapshot.empty) {
            const messages = querySnapshot.docs
                .map(doc => convertTimestampsToDates({ id: doc.id, ...doc.data() }) as ChatMessage)
                .filter(m => !m.isDeleted);
            return messages.reverse();
        }

        // If a specific session is requested but empty, don't fall back to legacy monolithic history
        if (sessionId) return [];

        // Fallback to Legacy
        // [MONGODB] 4-segment doc → CHAT_HISTORY_COLLECTION legacy fallback, scoped by userId
        const legacyDocRef = doc(db, USERS_COLLECTION, userId, CHAT_HISTORY_COLLECTION, 'history');
        const docSnap = await getDoc(legacyDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && Array.isArray(data.history)) {
                return convertTimestampsToDates(data.history);
            }
        }
        return [];
    } catch (e) {
        console.error("[Firestore] Failed to load chat history:", e);
        return [];
    }
};

// [ZEN FIX] Full Backup Fetcher (No Limits + Log Merging)
export const getFullChatHistory = async (userId: string): Promise<ChatMessage[]> => {
    try {
        console.log(`[Firestore] Fetching FULL chat history for ${userId}...`);

        // 1. Fetch Modern Segments (Unlimited & Unfiltered)
        // [ZEN FIX] Explicitly exclude deleted messages
        const { where } = await import('./sovereignDbAdapter');
        const segmentsRef = collection(db, USERS_COLLECTION, userId, CHAT_SEGMENTS_COLLECTION);
        let segmentSnap;
        try {
            segmentSnap = await getDocs(query(segmentsRef, where('isDeleted', '!=', true)));
        } catch (e) {
            segmentSnap = await getDocs(segmentsRef);
        }
        
        const segments = segmentSnap.docs
            .map(doc => convertTimestampsToDates({ id: doc.id, ...doc.data() }) as ChatMessage)
            .filter(m => !m.isDeleted)
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // 2. Fetch Legacy
        let legacy: ChatMessage[] = [];
        try {
            const legacyDocRef = doc(db, USERS_COLLECTION, userId, CHAT_HISTORY_COLLECTION, 'history');
            const legacySnap = await getDoc(legacyDocRef);
            if (legacySnap.exists()) {
                const data = legacySnap.data();
                if (Array.isArray(data.history)) {
                    legacy = convertTimestampsToDates(data.history);
                }
            }
        } catch (err) { console.warn("[Firestore] Legacy fetch failed (ignoring):", err); }

        // 3. Merge Strategies
        // If we have segments, they typically supersede legacy. 
        // But for a backup, we want to be safe. 
        // We will concat Legacy + Segments, then deduplicate by ID and Timestamp.

        const rawCombined = [...legacy, ...segments];
        const seen = new Set<string>();
        const deduplicated = rawCombined.filter(msg => {
            // Create a unique fingerprint (ID or Content+Time)
            const id = (msg as any).id;
            const contentSig = msg.content?.substring(0, 20) + '_' + new Date(msg.timestamp).getTime();
            const key = id || contentSig;

            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        console.log(`[Firestore] Backup Compiled: ${legacy.length} legacy + ${segments.length} segments = ${deduplicated.length} total.`);
        return deduplicated;

    } catch (e) {
        console.error("[Firestore] Failed to run full backup fetch:", e);
        throw e;
    }
};

export const saveChatHistory = async (userId: string, history: ChatMessage[]): Promise<void> => {
    if (!history || history.length === 0) return;

    const lastMessage = history[history.length - 1];
    if (!lastMessage || !lastMessage.role || lastMessage.content === undefined) return;

    try {
        const batch = writeBatch(db);

        // [ZEN FIX] Idempotent saving using generated ID
        const docId = (lastMessage as any).id || `msg_${new Date(lastMessage.timestamp).getTime()}_${lastMessage.role}`;
        // [MONGODB] 4-segment doc → CHAT_SEGMENTS_COLLECTION, idempotent upsert by generated ID
        const docRef = doc(db, USERS_COLLECTION, userId, CHAT_SEGMENTS_COLLECTION, docId);

        const sanitizedMessage = cleanForFirestore(lastMessage);
        sanitizedMessage.id = docId;

        batch.set(docRef, sanitizedMessage, { merge: true });
        await batch.commit();

    } catch (e) {
        console.error("[Firestore] Failed to save chat message:", e);
        throw e;
    }
};

export const deleteChatHistory = async (userId: string): Promise<void> => {
    try {
        const batch = writeBatch(db);
        const segmentsRef = collection(db, USERS_COLLECTION, userId, CHAT_SEGMENTS_COLLECTION);
        const segmentsSnap = await getDocs(segmentsRef);
        segmentsSnap.docs.forEach(doc => batch.delete(doc.ref));

        const legacyDocRef = doc(db, USERS_COLLECTION, userId, CHAT_HISTORY_COLLECTION, 'history');
        batch.delete(legacyDocRef);

        await batch.commit();
        console.log("[Firestore] Chat history purged for user:", userId);

        // [ZEN FIX] Trigger Typesense Purge to kill AI search-based memory
        try {
            const { purgeUserMemory } = await import('./searchService');
            await purgeUserMemory(userId);
        } catch (searchError) {
            console.error("[Firestore] Failed to trigger search purge:", searchError);
        }
    } catch (e) {
        console.error("[Firestore] Failed to purge chat history:", e);
        throw e;
    }
};

// [ZEN FIX] Chronology: Edit Message without breaking Time Sort
export const updateChatMessage = async (userId: string, msgId: string, updates: Partial<ChatMessage>): Promise<void> => {
    try {
        // [MONGODB] 4-segment doc → CHAT_SEGMENTS_COLLECTION, targeted field update
        const docRef = doc(db, USERS_COLLECTION, userId, CHAT_SEGMENTS_COLLECTION, msgId);
        // We do NOT spread ...oldData because updateDoc merges.
        // We just pass what changed + updatedAt.
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
    } catch (e) {
        console.error("[Firestore] Failed to update chat message:", e);
        throw e;
    }
};

// [ZEN FIX] Forensic: Heal messages with string timestamps to restore query alignment
export const healGhostMessages = async (userId: string, ghosts: ChatMessage[]): Promise<number> => {
    if (!ghosts.length) return 0;
    try {
        const batch = writeBatch(db);
        const { Timestamp } = await import('./sovereignCore');
        
        ghosts.forEach(msg => {
            if (!msg.id) return;
            // [MONGODB] 4-segment doc → CHAT_SEGMENTS_COLLECTION, forensic timestamp heal
            const docRef = doc(db, USERS_COLLECTION, userId, CHAT_SEGMENTS_COLLECTION, msg.id);
            // Convert string timestamp to proper Date/Timestamp
            const fixedDate = new Date(msg.timestamp);
            batch.update(docRef, {
                timestamp: Timestamp.fromDate(fixedDate),
                updatedAt: serverTimestamp(),
                forensicHeal: true // Mark as healed
            });
        });
        
        await batch.commit();
        console.log(`[Forensic] Successfully healed ${ghosts.length} ghost messages.`);
        return ghosts.length;
    } catch (e) {
        console.error("[Forensic] Failed to heal ghost messages:", e);
        return 0;
    }
};

// ==========================================
// [ZEN] CHAT SESSIONS (Thread Isolation)
// ==========================================

export const getChatSessions = async (userId: string): Promise<ChatSession[]> => {
    try {
        const sessionsRef = collection(db, USERS_COLLECTION, userId, CHAT_SESSIONS_COLLECTION);
        const q = query(sessionsRef, orderBy('lastUpdatedAt', 'desc'), limit(100));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => convertTimestampsToDates({ id: doc.id, ...doc.data() }) as ChatSession);
    } catch (e) {
        console.error("[Firestore] Failed to load chat sessions:", e);
        return [];
    }
};

export const saveChatSession = async (userId: string, session: ChatSession): Promise<void> => {
    try {
        const docRef = doc(db, USERS_COLLECTION, userId, CHAT_SESSIONS_COLLECTION, session.id);
        await setDoc(docRef, cleanForFirestore(session), { merge: true });
    } catch (e) {
        console.error("[Firestore] Failed to save chat session:", e);
        throw e;
    }
};

export const deleteChatSession = async (userId: string, sessionId: string): Promise<void> => {
    try {
        const docRef = doc(db, USERS_COLLECTION, userId, CHAT_SESSIONS_COLLECTION, sessionId);
        await deleteDoc(docRef);
        
        // Also wipe all messages in this session
        const batch = writeBatch(db);
        const segmentsRef = collection(db, USERS_COLLECTION, userId, CHAT_SEGMENTS_COLLECTION);
        const { where } = await import('./sovereignDbAdapter');
        const q = query(segmentsRef, where('sessionId', '==', sessionId));
        const messagesSnap = await getDocs(q);
        
        messagesSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    } catch (e) {
        console.error("[Firestore] Failed to delete chat session:", e);
        throw e;
    }
};
