/**
 * ============================================================================
 * 🛑 MONGODB BACKEND — NOT FIREBASE. DO NOT WRITE NATIVE FIRESTORE QUERIES.
 * ============================================================================
 * All `doc`, `collection`, `setDoc`, `getDocs`, etc. calls below are routed
 * through `sovereignDbAdapter.ts`, a Facade that mimics the Firebase SDK syntax
 * but internally dispatches to MongoDB via `httpsCallable` API endpoints.
 *
 * ADAPTER ROUTING RULES (as of 2026-06-01):
 *   - doc(db, 'users', userId)                            → users collection  [2 segments]
 *   - doc(db, 'users', userId, subcol, docId)             → subcol collection [4 segments]
 *   - collection(db, 'users', userId, subcol)             → subcol collection [3 segments]
 *   - ANY OTHER SEGMENT COUNT → throws an Error immediately (by design)
 *
 * ⚠️  Do NOT introduce new nested path depths without updating the adapter routing
 *     signatures in sovereignDbAdapter.ts AND sovereignDbWrite.ts (backend).
 * ============================================================================
 */
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, writeBatch, addDoc } from './sovereignDbAdapter';
import { db, USERS_COLLECTION, EVENTS_COLLECTION, TAGS_COLLECTION, getSubcollectionRef, cleanForFirestore, convertTimestampsToDates } from './sovereignCore';
import { sanitizeAllEvents, sanitizeAllTags } from './dataValidator';
import type { User, LifeEvent, Tag, PersonTag, GigiJournalEntry } from '../types';

// --- USERS ---
export const sanitizeUserProfileUrls = (user: User | null): User | null => {
    if (!user) return null;
    const sanitized = { ...user };
    if (sanitized.profilePictureUrl && 
        (sanitized.profilePictureUrl.includes('eric-headshot.png') || 
         sanitized.profilePictureUrl.includes('eric-headshot-polished.png') ||
         sanitized.profilePictureUrl.includes('gigiwatt.com/assets/'))) {
        sanitized.profilePictureUrl = '/assets/eric-headshot.png';
    }
    if (sanitized.atsDemographics && typeof sanitized.atsDemographics === 'object') {
        const ats = { ...sanitized.atsDemographics } as any;
        if (ats.proxyAvatarUrl && 
            (ats.proxyAvatarUrl.includes('eric-headshot.png') || 
             ats.proxyAvatarUrl.includes('eric-headshot-polished.png') ||
             ats.proxyAvatarUrl.includes('gigiwatt.com/assets/'))) {
            ats.proxyAvatarUrl = '/assets/eric-headshot.png';
        }
        sanitized.atsDemographics = ats;
    }
    if (Array.isArray(sanitized.aiCompanions)) {
        sanitized.aiCompanions = sanitized.aiCompanions.map(companion => {
            if (companion.avatarUrl && 
                (companion.avatarUrl.includes('eric-headshot.png') || 
                 companion.avatarUrl.includes('gigiwatt.com/assets/'))) {
                return { ...companion, avatarUrl: '/assets/eric-headshot.png' };
            }
            return companion;
        });
    }
    return sanitized;
};

// -------------------------------------------------------------------
// In-memory profile cache — avoids repeated network hits for the same
// session. Survives Vite HMR by attaching to window. Invalidated on write.
// -------------------------------------------------------------------
const getCache = (): Map<string, User> => {
    if (!(window as any).__zenProfileCache) {
        (window as any).__zenProfileCache = new Map<string, User>();
    }
    return (window as any).__zenProfileCache;
};

export const invalidateProfileCache = (userId: string) => {
    getCache().delete(userId);
    console.log(`[getUserProfile] 🗑️ Cache invalidated (HMR-safe) for ${userId}`);
};

export const getUserProfile = async (userId: string, retries = 5): Promise<User | null> => {
    // Serve from cache if available — avoids Clerk JWT expiry race conditions
    const cache = getCache();
    if (cache.has(userId)) {
        console.log(`[getUserProfile] ⚡ Cache HIT (HMR-safe) for ${userId}`);
        return cache.get(userId) as User;
    }

    // [MONGODB] Signature B: doc(db, 'users', userId) → reads from root 'users' collection
    const docRef = doc(db, USERS_COLLECTION, userId);

    let attempt = 0;
    while (attempt < retries) {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("SovereignDB getDoc timed out after 30s")), 30000)
        );

        try {
            const docSnap: any = await Promise.race([getDoc(docRef), timeoutPromise]);
            const rawData = docSnap.data();
            // [CLEARED]
            if (docSnap.exists()) {
                const profile = sanitizeUserProfileUrls(convertTimestampsToDates(rawData as User)) as User;
                cache.set(userId, profile); // Cache the result
                return profile;
            }
            return null;
        } catch (error: any) {
            attempt++;
            console.warn(`[SovereignDB] 📡 Packet loss detected over Chesapeake (Attempt ${attempt}/${retries}). Retrying in ${attempt * 3}s...`);
            if (attempt >= retries) {
                console.error("[SovereignDB] Error fetching user profile after max retries:", error);
                throw error;
            }
            // Wait before next attempt (exponential backoff)
            await new Promise(res => setTimeout(res, 3000 * attempt));
        }
    }
    return null;
};

export const getAllUserProfiles = async (): Promise<User[]> => {
    try {
        const querySnapshot = await getDocs(collection(db, USERS_COLLECTION));
        return querySnapshot.docs.map(doc => {
            const data = doc.data() as object;
            const user = convertTimestampsToDates({ ...data, id: doc.id } as User);
            return sanitizeUserProfileUrls(user) as User;
        });
    } catch (error) {
        console.error("[SovereignDB] Error fetching all user profiles:", error);
        return [];
    }
};

export const checkSlugAvailability = async (slug: string, requestingUserId: string): Promise<boolean> => {
    const slugSnap = await getDoc(doc(db, 'public_slugs', slug));
    if (!slugSnap.exists()) return true;
    return slugSnap.data().targetUserId === requestingUserId;
};

export const generateSlugAlternatives = async (slug: string): Promise<string[]> => {
    const alternatives: string[] = [];
    let counter = 1;
    // Cap at 20 iterations to prevent infinite loops in dense name spaces
    while (alternatives.length < 3 && counter <= 20) {
        const alt = `${slug}-${Math.floor(Math.random() * 900) + 100}`; // Random 3 digit suffix
        const snap = await getDoc(doc(db, 'public_slugs', alt));
        if (!snap.exists()) {
            alternatives.push(alt);
        }
        counter++;
    }
    return alternatives;
};

export const updateUserProfile = async (userId: string, data: Partial<User>): Promise<void> => {
    // [MONGODB] Signature B: doc(db, 'users', userId) → writes to root 'users' collection (backend forces merge)
    const docRef = doc(db, USERS_COLLECTION, userId);

    // [ZEN NEW] Admin Vetting Gateway for Vanity Slugs
    if (data.publicSlug && data.publicSlug !== '') {
        const cleanSlug = data.publicSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

        // Ensure data explicitly reflects the sanitized string
        data.publicSlug = cleanSlug;

        const clearance = data.securityClearance || 0;
        if (clearance >= 10) {
            // High Clearance: Force dual-write bypass
            const slugRef = doc(db, 'public_slugs', cleanSlug);
            await setDoc(slugRef, { targetUserId: userId });
            data.publicSlugStatus = 'active';
        } else {
            // Low Clearance: Submit to queue
            const reqRef = doc(collection(db, 'slug_requests'));
            await setDoc(reqRef, {
                targetUserId: userId,
                requestedSlug: cleanSlug,
                timestamp: new Date().toISOString(),
                status: 'pending'
            });
            data.publicSlugStatus = 'pending';
        }
    }

    await setDoc(docRef, cleanForFirestore({ ...data, id: userId, updatedAt: new Date() }), { merge: true });
    
    // Optimistically update cache instead of invalidating to prevent network timeouts
    const cache = getCache();
    if (cache.has(userId)) {
        const existing = cache.get(userId);
        cache.set(userId, { ...existing, ...data } as User);
        console.log(`[updateUserProfile] ⚡ Cache optimistically merged for ${userId}`);
    }
};

export const deleteUserProfile = async (userId: string): Promise<void> => {
    // [MONGODB] Signature B: doc(db, 'users', userId) → deletes from root 'users' collection
    const docRef = doc(db, USERS_COLLECTION, userId);
    await deleteDoc(docRef);
};

// --- EVENTS ---
export const saveEvent = async (userId: string, event: LifeEvent): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, EVENTS_COLLECTION), event.id);
    await setDoc(docRef, cleanForFirestore({ ...event, updatedAt: new Date() }));
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
    // [ZEN] Strict Schema Enforcement Layer
    if (tag.type === 'person') {
        const pTag = tag as PersonTag;
        if (!pTag.metadata) {
            console.error(`[Schema Enforcement] CRITICAL: Rejected saveTag operation for PersonTag ${tag.id}. Missing metadata block.`);
            throw new Error(`Data Integrity Guardrail: Cannot save PersonTag '${tag.name}' without a valid metadata block. Attempt blocked.`);
        }
    }

    const docRef = doc(getSubcollectionRef(userId, TAGS_COLLECTION), tag.id);
    await setDoc(docRef, cleanForFirestore({ ...tag, updatedAt: new Date() }));
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

// [ZEN V32] Vantablack Shutter Protocol (Batch Updates)
export const updateTagsExposureModeBulk = async (userId: string, tagIds: string[], mode: 'white' | 'grey' | 'black'): Promise<void> => {
    // Firestore limits batches to 500 ops. We should chunk it if needed, 
    // but practically the user won't select >500 at once often.
    // For robust safety, we'll chunk at 450.
    const CHUNK_SIZE = 450;
    const chunks = [];
    for (let i = 0; i < tagIds.length; i += CHUNK_SIZE) {
        chunks.push(tagIds.slice(i, i + CHUNK_SIZE));
    }

    const tagsRef = getSubcollectionRef(userId, TAGS_COLLECTION);

    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(id => {
            const ref = doc(tagsRef, id);
            batch.update(ref, { exposure_mode: mode });
        });
        await batch.commit();
    }
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
    await setDoc(docRef, cleanForFirestore({ ...entry, updatedAt: new Date() }));
};

export const deleteGigiJournalEntry = async (userId: string, entryId: string): Promise<void> => {
    const docRef = doc(getSubcollectionRef(userId, 'gigiJournal'), entryId);
    await deleteDoc(docRef);
};

export async function getTag(userId: string, tagId: string): Promise<any | null> {
    const tagRef = doc(getSubcollectionRef(userId, 'tags'), tagId);
    const snap = await getDoc(tagRef);
    return snap.exists() ? convertTimestampsToDates(snap.data()) : null;
}

/**
 * [ZEN] SHOEBOX STAGING: Direct Ingestion
 * Reroutes high-velocity jots or external artifacts to the Accessioning Gateway (pending_accessions).
 */
export const stageArtifact = async (userId: string, artifact: any): Promise<void> => {
    // [MONGODB] 3-segment collection: routes to 'pending_accessions' subcollection, scoped by userId
    const collRef = collection(db, USERS_COLLECTION, userId, 'pending_accessions');
    await addDoc(collRef, cleanForFirestore({
        ...artifact,
        status: artifact.status || 'pending',
        logicalDate: artifact.logicalDate || new Date(),
        createdAt: new Date()
    }));
};

/**
 * [ZEN] SOVEREIGN MODEL GATEWAY: Registry Management
 * Manages the dynamic mapping of AI roles to specific model IDs.
 */
export const getAIModelRegistry = async (userId: string): Promise<any | null> => {
    // [MONGODB] 4-segment doc: routes to 'config' subcollection, document 'ai_models', scoped by userId
    const docRef = doc(db, USERS_COLLECTION, userId, 'config', 'ai_models');
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : null;
};

export const updateAIModelRegistry = async (userId: string, registry: any): Promise<void> => {
    // [MONGODB] 4-segment doc: routes to 'config' subcollection, document 'ai_models', scoped by userId
    const docRef = doc(db, USERS_COLLECTION, userId, 'config', 'ai_models');
    await setDoc(docRef, { ...registry, updatedAt: new Date() }, { merge: true });
};