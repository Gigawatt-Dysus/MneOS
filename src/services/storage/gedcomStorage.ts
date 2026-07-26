import { GedcomData } from "../gedcom/types";

const DB_NAME = 'GIGI_DB';
const STORE_NAME = 'gedcom_store';
const DB_VERSION = 1;

interface StoredGedcom {
    id: 'current_gedcom'; // Singleton record
    data: GedcomData;
    filename: string;
    timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const GedcomStorage = {
    save: async (data: GedcomData, filename: string): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const record: StoredGedcom = {
                id: 'current_gedcom',
                data,
                filename,
                timestamp: Date.now()
            };

            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    load: async (): Promise<{ data: GedcomData; filename: string } | null> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('current_gedcom');

            request.onsuccess = () => {
                const result = request.result as StoredGedcom;
                if (result) {
                    resolve({ data: result.data, filename: result.filename });
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    },

    clear: async (): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete('current_gedcom');

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};
