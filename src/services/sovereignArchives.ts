import { db, cleanForFirestore } from './sovereignCore';
import { collection, doc, setDoc, deleteDoc, getDocs, query, orderBy } from './sovereignDbAdapter';

/**
 * [ZEN] Sovereign Communications Archives
 * Handles human-to-human archival transcripts, separate from AI reflections.
 */

export const getCommsArchives = async (userId: string): Promise<any[]> => {
    const colRef = collection(db, 'users', userId, 'communication_archives');
    const q = query(colRef, orderBy('creationDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const saveCommsArchiveEntry = async (userId: string, entry: any): Promise<void> => {
    const docRef = doc(db, 'users', userId, 'communication_archives', entry.id);
    await setDoc(docRef, cleanForFirestore(entry));
};

export const deleteCommsArchiveEntry = async (userId: string, entryId: string): Promise<void> => {
    const docRef = doc(db, 'users', userId, 'communication_archives', entryId);
    await deleteDoc(docRef);
};
