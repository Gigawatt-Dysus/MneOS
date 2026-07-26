import type { User } from '@/types';

const DB_NAME = 'GigiDB';
const DB_VERSION = 4; // Bump version to add new stores
const USER_STORE_NAME = 'users';
const EVENTS_STORE_NAME = 'events';
const TAGS_STORE_NAME = 'tags';
const MEDIA_STORE_NAME = 'media';
const CHAT_HISTORY_STORE_NAME = 'chatHistory';
const GIGI_JOURNAL_STORE_NAME = 'gigiJournal';


let db: IDBDatabase | undefined;

/**
 * Initializes the IndexedDB database.
 */
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', request.error);
      reject('Error opening database');
    };

    request.onsuccess = (event) => {
      db = request.result;
      
      // Handle unexpected connection closures to prevent "The database connection is closing" errors
      db.onversionchange = () => {
          console.warn('[dbService] Database version changed. Closing connection to prevent conflicts.');
          db?.close();
          db = undefined;
      };
      
      db.onclose = () => {
          console.warn('[dbService] Database connection closed unexpectedly.');
          db = undefined;
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(USER_STORE_NAME)) {
        db.createObjectStore(USER_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(EVENTS_STORE_NAME)) {
        db.createObjectStore(EVENTS_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(TAGS_STORE_NAME)) {
        db.createObjectStore(TAGS_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        db.createObjectStore(MEDIA_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHAT_HISTORY_STORE_NAME)) {
        db.createObjectStore(CHAT_HISTORY_STORE_NAME, { keyPath: 'userId' });
      }
      if (!db.objectStoreNames.contains(GIGI_JOURNAL_STORE_NAME)) {
        db.createObjectStore(GIGI_JOURNAL_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

/**
 * Closes the database connection, allowing it to be reopened cleanly.
 */
export const closeDB = (): void => {
    if (db) {
        console.log("[dbService] Closing DB connection.");
        db.close();
        db = undefined;
    }
};


/**
 * Retrieves a value from a given store by key.
 * @param storeName The name of the object store.
 * @param key The key of the item to retrieve.
 */
export const dbGet = async <T>(storeName: string, key: IDBValidKey): Promise<T | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => {
      console.error('Error getting data from DB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
};


/**
 * Retrieves all values from a given store.
 * @param storeName The name of the object store.
 */
export const dbGetAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => {
      console.error('Error getting all data from DB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result || []);
    };
  });
};


/**
 * Adds or updates a value in a given store.
 * @param storeName The name of the object store.
 * @param value The value to be stored. It must have a property that matches the store's keyPath.
 */
export const dbPut = async <T>(storeName: string, value: T): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      console.error('Error in transaction:', transaction.error);
      reject(transaction.error);
    };
    const store = transaction.objectStore(storeName);
    store.put(value);
  });
};

/**
 * Deletes a value from a given store by key.
 * @param storeName The name of the object store.
 * @param key The key of the item to delete.
 */
export const dbDelete = async (storeName: string, key: IDBValidKey): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onerror = () => {
      console.error('Error in transaction:', transaction.error);
      reject(transaction.error);
    };
    const store = transaction.objectStore(storeName);
    store.delete(key);
  });
};

/**
 * Clears all data from a specific object store.
 * @param storeName The name of the object store to clear.
 */
export const dbClearStore = async (storeName: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        transaction.oncomplete = () => {
            resolve();
        };
        transaction.onerror = (event) => {
            console.error(`Error clearing store ${storeName}:`, transaction.error);
            reject(transaction.error);
        };
        const store = transaction.objectStore(storeName);
        store.clear();
    });
};