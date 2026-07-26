import {
    doc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    onSnapshot
} from './sovereignDbAdapter';
import { db, getSubcollectionRef, cleanForFirestore, convertTimestampsToDates } from './sovereignCore';

export const USER_PRESETS_COLLECTION = 'user_presets';

export const getUserPresets = async (userId: string) => {
    const colRef = getSubcollectionRef(userId, USER_PRESETS_COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: any) => convertTimestampsToDates({ id: doc.id, ...doc.data() }));
};

export const subscribeToUserPresets = (userId: string, callback: (presets: any[]) => void) => {
    const colRef = getSubcollectionRef(userId, USER_PRESETS_COLLECTION);
    const q = query(colRef, orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot: any) => {
        const presets = snapshot.docs.map((doc: any) => convertTimestampsToDates({ id: doc.id, ...doc.data() }));
        callback(presets);
    });
};

export const saveUserPreset = async (userId: string, preset: any) => {
    const colRef = getSubcollectionRef(userId, USER_PRESETS_COLLECTION);
    const presetId = preset.id || doc(colRef).id;
    const docRef = doc(colRef, presetId);

    const data = {
        ...preset,
        updatedAt: serverTimestamp()
    };

    if (!preset.id) {
        data.createdAt = serverTimestamp();
        await setDoc(docRef, cleanForFirestore(data));
    } else {
        // [ZEN FIX] Use setDoc with merge to support "Create with Custom ID" (Upsert)
        // updateDoc fails if the document doesn't exist.
        await setDoc(docRef, cleanForFirestore(data), { merge: true });
    }
};

export const deleteUserPreset = async (userId: string, presetId: string) => {
    const colRef = getSubcollectionRef(userId, USER_PRESETS_COLLECTION);
    await deleteDoc(doc(colRef, presetId));
};
