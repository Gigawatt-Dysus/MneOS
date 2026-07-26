import { getFirestore, collection, Firestore } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

export let db: Firestore;

export const initializeFirestore = () => {
    db = getFirestore();
};

export const USERS_COLLECTION = 'users';
export const EVENTS_COLLECTION = 'events';
export const TAGS_COLLECTION = 'tags';
export const MEDIA_COLLECTION = 'media';
export const CHAT_HISTORY_COLLECTION = 'chatHistory';
export const CHAT_SEGMENTS_COLLECTION = 'chat_segments';

export const getSubcollectionRef = (userId: string, subcollection: string) => 
    collection(db, USERS_COLLECTION, userId, subcollection);

// Robust Deep Cleaner for Firestore
export const cleanForFirestore = (data: any): any => {
    if (data === undefined) return null;
    if (data === null) return null;
    if (data instanceof Date) return data;
    
    if (Array.isArray(data)) {
        return data.map(cleanForFirestore).filter(item => item !== undefined);
    }
    
    if (typeof data === 'object') {
        if (data.constructor && data.constructor.name !== 'Object' && data.constructor.name !== 'Date') {
            try {
                return JSON.parse(JSON.stringify(data));
            } catch (e) {
                return null; 
            }
        }

        const newObj: any = {};
        Object.keys(data).forEach(key => {
            const value = cleanForFirestore(data[key]);
            if (value !== undefined) {
                newObj[key] = value;
            }
        });
        return newObj;
    }
    return data;
};

export const convertTimestampsToDates = (obj: any): any => {
    if (!obj) return obj;
    if (obj instanceof Timestamp || (typeof obj.toDate === 'function')) return obj.toDate();
    
    if (typeof obj === 'object' && 'seconds' in obj && 'nanoseconds' in obj) {
        return new Timestamp(obj.seconds, obj.nanoseconds).toDate();
    }
    
    if (typeof obj === 'string') {
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
            const d = new Date(obj);
            if (!isNaN(d.getTime())) return d;
        }
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => convertTimestampsToDates(item));
    }
    
    if (typeof obj === 'object') {
        if (obj instanceof Date) return obj;
        const newObj: any = {};
        for (const key in obj) {
            newObj[key] = convertTimestampsToDates(obj[key]);
        }
        return newObj;
    }
    return obj;
};