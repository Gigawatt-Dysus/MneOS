/**
 * ============================================================================
 * 🛑 MONGODB BACKEND — NOT FIREBASE. DO NOT WRITE NATIVE FIRESTORE QUERIES.
 * ============================================================================
 * All calls below use sovereignDbAdapter.ts (Firebase SDK facade over MongoDB).
 * VALID PATH SIGNATURES ONLY:
 *   - doc(db, 'users', userId, subcol, docId)   → 4 segments [subcol collection]
 *   - collection(db, 'users', userId, subcol)   → 3 segments [subcol collection]
 * ANY OTHER DEPTH THROWS AN ERROR BY DESIGN.
 * ============================================================================
 */
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, orderBy } from './sovereignDbAdapter';
import { Timestamp } from './sovereignDbAdapter';
import { db } from './sovereignCore';
import { DaydreamStory } from '../types';

const USERS_COLLECTION = 'users';
const DAYDREAM_COLLECTION = 'daydream_stories';

export const saveDaydream = async (userId: string, story: DaydreamStory): Promise<void> => {
    if (!userId || !story) return;
    try {
        // [MONGODB] 4-segment doc → 'daydream_stories' subcollection, scoped by userId
        const storyRef = doc(db, USERS_COLLECTION, userId, DAYDREAM_COLLECTION, story.id);
        // Convert dates to Firestore timestamps
        const payload = {
            ...story,
            createdAt: Timestamp.fromDate(new Date(story.createdAt)),
            updatedAt: Timestamp.fromDate(new Date()) // Always update modified time
        };
        await setDoc(storyRef, payload, { merge: true });
    } catch (error) {
        console.error("Error saving daydream story:", error);
        throw error;
    }
};

export const getDaydreams = async (userId: string): Promise<DaydreamStory[]> => {
    if (!userId) return [];
    try {
        // [MONGODB] 3-segment collection → 'daydream_stories' subcollection, scoped by userId
        const storiesRef = collection(db, USERS_COLLECTION, userId, DAYDREAM_COLLECTION);
        const q = query(storiesRef, orderBy('updatedAt', 'desc'));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            
            const parseDate = (val: any): Date => {
                if (!val) return new Date();
                if (val.toDate) return val.toDate(); // Legacy Firestore Timestamp
                if (typeof val === 'string' || typeof val === 'number') return new Date(val); // Native MongoDB / JSON
                return val as Date;
            };

            return {
                ...data,
                id: doc.id,
                createdAt: parseDate(data.createdAt),
                updatedAt: parseDate(data.updatedAt)
            } as DaydreamStory;
        });
    } catch (error) {
        console.error("Error fetching daydreams:", error);
        return [];
    }
};

export const getDaydream = async (userId: string, storyId: string): Promise<DaydreamStory | null> => {
    if (!userId || !storyId) return null;
    try {
        // [MONGODB] 4-segment doc → 'daydream_stories' subcollection, scoped by userId
        const storyRef = doc(db, USERS_COLLECTION, userId, DAYDREAM_COLLECTION, storyId);
        const docSnap = await getDoc(storyRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            const parseDate = (val: any): Date => {
                if (!val) return new Date();
                if (val.toDate) return val.toDate(); // Legacy Firestore Timestamp
                if (typeof val === 'string' || typeof val === 'number') return new Date(val); // Native MongoDB / JSON
                return val as Date;
            };

            return {
                ...data,
                id: docSnap.id,
                createdAt: parseDate(data.createdAt),
                updatedAt: parseDate(data.updatedAt)
            } as DaydreamStory;
        }
        return null;
    } catch (error) {
        console.error("Error fetching daydream story:", error);
        return null;
    }
};

export const deleteDaydream = async (userId: string, storyId: string): Promise<void> => {
    if (!userId || !storyId) return;
    try {
        // [MONGODB] 4-segment doc → 'daydream_stories' subcollection, scoped by userId
        const storyRef = doc(db, USERS_COLLECTION, userId, DAYDREAM_COLLECTION, storyId);
        await deleteDoc(storyRef);
    } catch (error) {
        console.error("Error deleting daydream story:", error);
        throw error;
    }
};
