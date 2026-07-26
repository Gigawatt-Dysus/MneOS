import { doc, getDoc, collection, getDocs, writeBatch, query, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { db, USERS_COLLECTION, CHAT_SEGMENTS_COLLECTION, CHAT_HISTORY_COLLECTION, cleanForFirestore, convertTimestampsToDates } from './core';
import type { ChatMessage } from '@/types';

export const getChatHistory = async (userId: string): Promise<ChatMessage[]> => {
    try {
        const segmentsRef = collection(db, USERS_COLLECTION, userId, CHAT_SEGMENTS_COLLECTION);
        const q = query(segmentsRef, orderBy('timestamp', 'desc'), limit(50));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const messages = querySnapshot.docs.map(doc => convertTimestampsToDates(doc.data()) as ChatMessage);
            return messages.reverse();
        }

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

export const saveChatHistory = async (userId: string, history: ChatMessage[]): Promise<void> => {
    if (!history || history.length === 0) return;

    const lastMessage = history[history.length - 1];
    if (!lastMessage || !lastMessage.role || lastMessage.content === undefined) return;

    try {
        const batch = writeBatch(db);

        // [ZEN FIX] Idempotent saving using generated ID
        const docId = (lastMessage as any).id || `msg_${new Date(lastMessage.timestamp).getTime()}_${lastMessage.role}`;
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

export const deleteAllChatData = async (userId: string): Promise<string[]> => {
    console.log(`[Firestore] Deleting all chat data for user: ${userId}`);
    const deletedIds: string[] = [];

    try {
        const batch = writeBatch(db);

        // 1. Delete NEW segments
        const segmentsRef = collection(db, USERS_COLLECTION, userId, CHAT_SEGMENTS_COLLECTION);
        const snapshot = await getDocs(segmentsRef);
        snapshot.docs.forEach(d => {
            batch.delete(d.ref);
            deletedIds.push(d.id);
        });

        // 2. Delete LEGACY document
        const legacyDocRef = doc(db, USERS_COLLECTION, userId, CHAT_HISTORY_COLLECTION, 'history');
        batch.delete(legacyDocRef);

        await batch.commit();
        console.log(`[Firestore] Successfully deleted ${deletedIds.length} segments and legacy history.`);
        return deletedIds;
    } catch (e) {
        console.error("[Firestore] Failed to delete chat data:", e);
        throw e;
    }
};