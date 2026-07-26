import { db } from '../firebaseConfig';
import { doc, getDoc, collection, writeBatch, Timestamp } from 'firebase/firestore';

// Helper to ensure clean data for Firestore (Recursive sanitization)
const cleanForMigration = (data: any): any => {
    if (data === undefined) return null;
    if (data === null) return null;
    if (data instanceof Date) return data;
    if (data instanceof Timestamp) return data; // Keep timestamps
    
    if (Array.isArray(data)) {
        return data.map(cleanForMigration).filter(item => item !== undefined);
    }
    
    if (typeof data === 'object') {
        // Handle complex objects / prototypes that Firestore rejects
        if (data.constructor && data.constructor.name !== 'Object' && data.constructor.name !== 'Date' && data.constructor.name !== 'Timestamp') {
            try {
                return JSON.parse(JSON.stringify(data));
            } catch (e) {
                return null; 
            }
        }
        const newObj: any = {};
        Object.keys(data).forEach(key => {
            const value = cleanForMigration(data[key]);
            if (value !== undefined) {
                newObj[key] = value;
            }
        });
        return newObj;
    }
    return data;
};

// Critical Migration Script
export const migrateChatHistory = async (userId: string) => {
    console.log(`[Migration] 📦 Starting Chat History Migration for ${userId}...`);
    
    // Legacy Location
    const legacyDocRef = doc(db, 'users', userId, 'chatHistory', 'history');
    // New Scalable Collection
    const segmentsRef = collection(db, 'users', userId, 'chat_segments');
    
    try {
        const docSnap = await getDoc(legacyDocRef);
        
        if (!docSnap.exists()) {
            console.warn("[Migration] No legacy chat history found.");
            return { success: false, message: "No legacy history found." };
        }

        const data = docSnap.data();
        const history = data?.history || [];

        if (!Array.isArray(history) || history.length === 0) {
            console.warn("[Migration] Legacy history is empty or invalid.");
            return { success: false, message: "Legacy history is empty." };
        }

        console.log(`[Migration] Found ${history.length} messages to migrate.`);
        
        let batch = writeBatch(db);
        let operationCount = 0;
        let totalMigrated = 0;

        for (const msg of history) {
            // Create a valid timestamp for ID generation (and sorting)
            let ts = msg.timestamp;
            // Handle Firestore Timestamp vs Date vs String
            if (ts && typeof ts.toDate === 'function') ts = ts.toDate();
            else if (typeof ts === 'string') ts = new Date(ts);
            
            if (!ts) ts = new Date(); // Fallback

            // Generate a sortable ID: timestamp-random
            const newId = `msg-${ts.getTime()}-${Math.random().toString(36).substr(2, 9)}`;
            const newDocRef = doc(segmentsRef, newId);

            // Clean the message to fix "invalid nested entity" errors
            const cleanMsg = cleanForMigration(msg);
            // Ensure timestamp is a Date or Timestamp compatible format
            cleanMsg.timestamp = ts;

            batch.set(newDocRef, cleanMsg);
            operationCount++;
            totalMigrated++;

            // Commit batches of 400 (limit is 500)
            if (operationCount >= 400) {
                console.log(`[Migration] Committing batch of ${operationCount} messages...`);
                await batch.commit();
                batch = writeBatch(db);
                operationCount = 0;
            }
        }

        // Final commit
        if (operationCount > 0) {
            await batch.commit();
        }

        console.log(`[Migration] ✅ SUCCESS. Migrated ${totalMigrated} messages.`);
        return { success: true, count: totalMigrated };

    } catch (error: any) {
        console.error("[Migration] ❌ CRITICAL FAILURE:", error);
        throw error;
    }
};