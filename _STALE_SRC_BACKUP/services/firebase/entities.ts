import { doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, USERS_COLLECTION, EVENTS_COLLECTION, TAGS_COLLECTION, getSubcollectionRef, cleanForFirestore, convertTimestampsToDates } from './core';
import { sanitizeAllEvents, sanitizeAllTags } from '../dataValidator';
import type { User, LifeEvent, Tag, GigiJournalEntry } from '@/types';

// --- USERS ---
export const getUserProfile = async (userId: string): Promise<User | null> => {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Firestore getDoc timed out")), 7000)
    );

    try {
        const docSnap: any = await Promise.race([getDoc(docRef), timeoutPromise]);
        if (docSnap.exists()) {
            return convertTimestampsToDates(docSnap.data() as User);
        }
        return null;
    } catch (error) {
        console.error("[Firestore] Error fetching user profile:", error);
        throw error; 
    }
};

export const getAllUserProfiles = async (): Promise<User[]> => {
    return []; 
};

export const updateUserProfile = async (userId: string, data: User): Promise<void> => {
    const docRef = doc(db, USERS_COLLECTION, userId);
    await setDoc(docRef, cleanForFirestore({ ...data, id: userId }), { merge: true });
};

// --- EVENTS ---
export const saveEvent = async (userId: string, event: LifeEvent): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, EVENTS_COLLECTION), event.id);
    await setDoc(docRef, cleanForFirestore(event));
};

export const deleteEvent = async (userId: string, eventId: string): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, EVENTS_COLLECTION), eventId);
    await deleteDoc(docRef);
};

export const getAllEvents = async (userId: string): Promise<LifeEvent[]> => {
    const querySnapshot = await getDocs(getSubcollectionRef(userId, EVENTS_COLLECTION));
    const events = querySnapshot.docs.map(doc => convertTimestampsToDates(doc.data() as LifeEvent));
    return sanitizeAllEvents(events);
};

// --- TAGS ---
export const saveTag = async (userId: string, tag: Tag): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, TAGS_COLLECTION), tag.id);
    await setDoc(docRef, cleanForFirestore(tag));
};

export const deleteTag = async (userId: string, tagId: string): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, TAGS_COLLECTION), tagId);
    await deleteDoc(docRef);
};

export const getAllTags = async (userId: string): Promise<Tag[]> => {
    const querySnapshot = await getDocs(getSubcollectionRef(userId, TAGS_COLLECTION));
    const tags = querySnapshot.docs.map(doc => convertTimestampsToDates(doc.data() as Tag));
    return sanitizeAllTags(tags);
};

// --- JOURNAL ---
export const getGigiJournal = async (userId: string): Promise<GigiJournalEntry[]> => {
    try {
        const querySnapshot = await getDocs(getSubcollectionRef(userId, 'gigiJournal'));
        return querySnapshot.docs.map(doc => {
            const data = convertTimestampsToDates(doc.data());
            if (data.creationDate && !(data.creationDate instanceof Date)) {
                data.creationDate = new Date(data.creationDate);
            }
            if (data.comments && Array.isArray(data.comments)) {
                data.comments = data.comments.map((c: any) => ({
                    ...c,
                    timestamp: c.timestamp ? new Date(c.timestamp) : new Date()
                }));
            }
            return data as GigiJournalEntry;
        });
    } catch (e) {
        return [];
    }
};

export const saveGigiJournalEntry = async (userId: string, entry: GigiJournalEntry): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, 'gigiJournal'), entry.id);
    await setDoc(docRef, cleanForFirestore(entry));
};

export const deleteGigiJournalEntry = async (userId: string, entryId: string): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, 'gigiJournal'), entryId);
    await deleteDoc(docRef);
};