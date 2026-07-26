import { db, USERS_COLLECTION, VERTEX_REQUESTS_COLLECTION, VERTEX_COLLECTION, getSubcollectionRef, cleanForFirestore, convertTimestampsToDates } from './sovereignCore';
import { doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, query, where, collection, limit } from './sovereignDbAdapter';
import { Timestamp, increment } from './sovereignDbAdapter';
import type { User, Vert, AirlockRequest, ValenceLevel, VertStatus, Tag, PersonTag, PeerChatSession } from '../types';
export type VertexRequest = AirlockRequest;
import { appDataService } from './serviceManager';
import { generateAgentResponse } from './ai/generators';

export const VertService = {
    /**
     * Sends a request to establish a link (Vertex) with another user.
     */
    async sendVertRequest(fromUser: User, toUserId: string, message?: string): Promise<void> {
        // ... (check blocked)
        const targetProfile = await appDataService.getUserProfile(toUserId);
        if (targetProfile?.blockedVerts?.[fromUser.id]) {
            throw new Error("Cannot send request: Blocked.");
        }

        const requestId = `${fromUser.id}_${toUserId}`;
        const requestDoc = doc(db, VERTEX_REQUESTS_COLLECTION, requestId);

        const newRequest: AirlockRequest = {
            requestId: requestId,
            fromUid: fromUser.id,
            toUid: toUserId,
            fromName: fromUser.displayName,
            timestamp: Date.now(),
            message: message,
            status: 'pending',
            type: 'link'
        };

        await setDoc(requestDoc, cleanForFirestore(newRequest));
    },

    /**
     * Sends a request to share media with another user.
     */
    async sendShareRequest(fromUser: User, toUserId: string, mediaIds: string[], message?: string): Promise<void> {
        const requestId = `share_${fromUser.id}_${toUserId}_${Date.now()}`;
        const requestDoc = doc(db, VERTEX_REQUESTS_COLLECTION, requestId);

        const newRequest: AirlockRequest = {
            requestId: requestId,
            fromUid: fromUser.id,
            toUid: toUserId,
            fromName: fromUser.displayName,
            timestamp: Date.now(),
            message: message || `Transmitting ${mediaIds.length} artifacts through secure bridge.`,
            status: 'pending',
            type: 'share',
            mediaIds: mediaIds
        };

        await setDoc(requestDoc, cleanForFirestore(newRequest));
    },

    /**
     * Accepts a pending link request.
     */
    async acceptVertRequest(requestId: string, currentUser: User, initialValence: ValenceLevel = 2, targetTagId?: string): Promise<void> {
        const reqRef = doc(db, VERTEX_REQUESTS_COLLECTION, requestId);
        const reqSnap = await getDoc(reqRef);

        if (!reqSnap.exists()) throw new Error("Request not found.");

        const request = reqSnap.data() as AirlockRequest;
        const otherUserId = request.fromUid;
        const otherUser = await appDataService.getUserProfile(otherUserId);

        if (!otherUser) throw new Error("Originating user no longer exists.");

        // 1. Create Vert for Current User (pointing to Other)
        const vertForCurrent: Vert = {
            uid: otherUserId,
            displayName: otherUser.displayName,
            profilePictureUrl: otherUser.profilePictureUrl, // [ZEN FIX]
            valence: initialValence,
            status: 'linked',
            publicKey: '', // Placeholder for now
            linkedAt: Date.now(),
            lastPing: Date.now(),
            associatedTagId: targetTagId || otherUser.personTagId || ''
        };

        // 2. Create Vert for Other User (pointing to Current)
        const vertForOther: Vert = {
            uid: currentUser.id,
            displayName: currentUser.displayName,
            profilePictureUrl: currentUser.profilePictureUrl, // [ZEN FIX]
            valence: initialValence,
            status: 'linked',
            publicKey: '', // Placeholder for now
            linkedAt: Date.now(),
            lastPing: Date.now(),
            associatedTagId: currentUser.personTagId || ''
        };

        // Save to subcollections
        const currentVertsRef = doc(getSubcollectionRef(currentUser.id, VERTEX_COLLECTION), otherUserId);
        const otherVertsRef = doc(getSubcollectionRef(otherUserId, VERTEX_COLLECTION), currentUser.id);

        await setDoc(currentVertsRef, cleanForFirestore(vertForCurrent));
        await setDoc(otherVertsRef, cleanForFirestore(vertForOther));

        // 3. Update Link Counts
        await appDataService.updateUserProfile(currentUser.id, { vertCount: (currentUser.vertCount || 0) + 1 } as any);
        await appDataService.updateUserProfile(otherUserId, { vertCount: (otherUser.vertCount || 0) + 1 } as any);

        // 4. Cleanup request
        await deleteDoc(reqRef);

        // 5. Social Architecture: Exchange Person Tags
        // If current user is set to auto-share, push their Person Tag to the other user's vault.
        if (currentUser.privacy?.autoShareTag && currentUser.personTagId) {
            try {
                const myTag = await appDataService.getTag(currentUser.id, currentUser.personTagId);
                if (myTag) {
                    await appDataService.saveTag(otherUserId, myTag);
                }
            } catch (e) { console.error("Identity push failed:", e); }
        }

        // vice versa: If other user shares, grab it for the current user.
        if (otherUser.privacy?.autoShareTag && otherUser.personTagId) {
            try {
                const theirTag = await appDataService.getTag(otherUserId, otherUser.personTagId);
                if (theirTag) {
                    await appDataService.saveTag(currentUser.id, theirTag);
                }
            } catch (e) { console.error("Identity pull failed:", e); }
        }
    },

    /**
     * Rejects a pending link request.
     */
    async rejectVertRequest(requestId: string, reason?: string): Promise<void> {
        const reqRef = doc(db, VERTEX_REQUESTS_COLLECTION, requestId);
        await deleteDoc(reqRef);
    },

    /**
     * Breaks a link (prunes the vertex).
     */
    async pruneVert(userId: string, targetVertId: string): Promise<void> {
        const currentVertRef = doc(getSubcollectionRef(userId, VERTEX_COLLECTION), targetVertId);
        const otherVertRef = doc(getSubcollectionRef(targetVertId, VERTEX_COLLECTION), userId);

        await deleteDoc(currentVertRef);
        await deleteDoc(otherVertRef);

        // Update counts (decrement)
        await updateDoc(doc(db, USERS_COLLECTION, userId), { vertCount: increment(-1) });
        await updateDoc(doc(db, USERS_COLLECTION, targetVertId), { vertCount: increment(-1) });
    },

    /**
     * Set a block level for a specific UID.
     * Level 1: Block Requests
     * Level 2: Total Blackout (Invisibility)
     */
    async setBlockLevel(userId: string, targetUid: string, level: number): Promise<void> {
        const userRef = doc(db, USERS_COLLECTION, userId);
        const updateField = `blockedVerts.${targetUid}`;

        if (level === 0) {
            // Unblock
            await updateDoc(userRef, { [`blockedVerts.${targetUid}`]: null }); // Might need more careful cleanup depending on Firestore structure
        } else {
            await updateDoc(userRef, { [updateField]: level });

            // If Level 2, also prune any existing Vert link
            if (level === 2) {
                await this.pruneVert(userId, targetUid).catch(() => { }); // Swallow error if no link existed
            }
        }
    },

    /**
     * Fetches all established Verts for a user.
     */
    async getVerts(userId: string): Promise<Vert[]> {
        const querySnapshot = await getDocs(getSubcollectionRef(userId, VERTEX_COLLECTION));
        return querySnapshot.docs.map(doc => convertTimestampsToDates(doc.data()) as Vert);
    },

    /**
     * Fetches all pending Vert requests for a user.
     */
    async getPendingRequests(userId: string): Promise<AirlockRequest[]> {
        const q = query(
            collection(db, VERTEX_REQUESTS_COLLECTION),
            where('toId', '==', userId),
            where('status', '==', 'pending')
        );
        const snap = await getDocs(q);
        return snap.docs.map(doc => convertTimestampsToDates(doc.data()) as AirlockRequest);
    },

    /**
     * Initializes a peer chat session between two users.
     */
    async createPeerSession(uid1: string, uid2: string): Promise<string> {
        const sessionId = [uid1, uid2].sort().join('_');
        const sessionRef = doc(db, 'peer_chat_sessions', sessionId);
        const sessionSnap = await getDoc(sessionRef);

        if (!sessionSnap.exists()) {
            const newSession: PeerChatSession = {
                sessionId: sessionId,
                participants: [uid1, uid2],
                lastMessage: 'Bridge established.',
                lastTimestamp: Date.now()
            };
            await setDoc(sessionRef, cleanForFirestore(newSession));
        }

        return sessionId;
    },

    /**
     * Search for other Archivists by email or display name.
     * Respects visibility settings (stealth users won't appear).
     */
    /**
     * Search for other Archivists by email or display name.
     * Respects visibility settings (stealth users won't appear).
     */
    async searchUsers(currentUserId: string, searchTerm: string): Promise<User[]> {
        const cleanTerm = searchTerm.replace(/['"]+/g, '').trim();
        const term = cleanTerm.toLowerCase();
        console.log(`[VertService] 🔎 Discovery Scan Initialized: "${term}" (orig: "${searchTerm}")`);

        const results: User[] = [];
        const seenIds = new Set<string>();

        const addResult = (u: User) => {
            if (u.id === currentUserId) return;
            if (seenIds.has(u.id)) return;

            const visibility = u.privacy?.visibility || 'public';

            // [ZEN CENSUS] Log fields to detect schema mismatches
            console.log(`[VertService] 👤 Candidate found: ${u.id}`);
            console.log(`[VertService] 📝 Fields: [${Object.keys(u).join(', ')}]`);
            console.log(`[VertService] 📝 Identity: "${u.displayName}" <${u.email}> | Visibility: ${visibility}`);

            if (visibility === 'stealth') {
                console.log(`[VertService] 🚫 Skipping: Stealth mode.`);
                return;
            }

            if (visibility === 'verts_only') {
                // EXTREMELY STRICT: Must be an exact email match OR a direct UID probe
                if (u.email?.toLowerCase() === term || term.startsWith('uid:')) {
                    console.log(`[VertService] ✅ Access Granted: ${term.startsWith('uid:') ? 'Direct UID Probe' : 'Verts_Only Exact Email Match'}.`);
                    seenIds.add(u.id);
                    results.push(u);
                } else {
                    console.log(`[VertService] 🚫 Skipping: Verts_Only requires exact email.`);
                }
                return;
            }

            // Public / Default logic
            const nameMatch = u.displayName?.toLowerCase().includes(term) ||
                u.firstName?.toLowerCase().includes(term) ||
                u.lastName?.toLowerCase().includes(term);
            const emailMatch = u.email?.toLowerCase().includes(term);

            if (nameMatch || emailMatch || term.startsWith('uid:')) {
                console.log(`[VertService] ✅ Access Granted: ${term.startsWith('uid:') ? 'Direct UID Probe' : 'Public Match'}.`);
                seenIds.add(u.id);
                results.push(u);
            } else {
                console.log(`[VertService] 🚫 Skipping: Secondary filter rejected.`);
            }
        };

        try {
            // DIAGNOSTIC 0: Collection Census
            const allDocs = await getDocs(collection(db, USERS_COLLECTION));
            console.log(`[VertService] 📊 COLLECTION CENSUS: ${allDocs.size} documents found in "${USERS_COLLECTION}".`);

            // [ZEN NEW] Small Collection Detail: Print every user's Handle/Email for debugging
            if (allDocs.size > 0 && allDocs.size < 10) {
                console.log("[VertService] 🔎 SMALL COLLECTION DETAIL (Full Census):");
                allDocs.forEach(d => {
                    const data = d.data() as User;
                    console.log(`  > [${d.id}]: "${data.displayName || 'No DisplayName'}" <${data.email || 'NO_EMAIL_FIELD'}>`);
                });
            } else if (allDocs.size > 0) {
                console.log(`[VertService] 📊 Samples: [${allDocs.docs.slice(0, 3).map(d => d.id).join(', ')}]`);
            }

            // ADVANCED PROBE: Direct UID Lookup
            if (term.startsWith('uid:')) {
                const targetUid = cleanTerm.split(':')[1]?.trim();
                console.log(`[VertService] 🛰️ EXECUTING DIRECT UID PROBE: "${targetUid}"`);
                const docRef = doc(db, USERS_COLLECTION, targetUid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    console.log(`[VertService] 🎯 UID PROBE SUCCESS: Document exists for ${targetUid}`);
                    addResult(convertTimestampsToDates(docSnap.data()) as User);
                } else {
                    console.warn(`[VertService] 💀 UID PROBE FAILED: No document found for ${targetUid}`);
                }
                return results; // Return early for UID probes
            }

            if (!term || term.length < 3) return [];

            const searchQueries = [
                // Query 1 & 2: Email (Both cases)
                query(collection(db, USERS_COLLECTION), where('email', '==', term)),
                query(collection(db, USERS_COLLECTION), where('email', '==', cleanTerm)),
                // Query 3 & 4: DisplayName (Both cases)
                query(collection(db, USERS_COLLECTION), where('displayName', '==', term)),
                query(collection(db, USERS_COLLECTION), where('displayName', '==', cleanTerm)),
                // Query 5 & 6: First/Last Names (Normalized)
                query(collection(db, USERS_COLLECTION), where('firstName', '==', term)),
                query(collection(db, USERS_COLLECTION), where('lastName', '==', term))
            ];

            // Handle email prefixes: if searching "user@gmail.com", also probe displayName for "user"
            if (term.includes('@')) {
                const prefix = term.split('@')[0];
                console.log(`[VertService] 📡 Email detected. probing displayName for prefix: "${prefix}"`);
                searchQueries.push(query(collection(db, USERS_COLLECTION), where('displayName', '==', prefix)));
            }

            // Handle multi-word names (e.g., "Eric Cornett")
            const parts = cleanTerm.split(/\s+/).filter(p => p.length > 0);
            const lowerParts = term.split(/\s+/).filter(p => p.length > 0);
            if (parts.length > 1) {
                console.log(`[VertService] 📡 Multi-word detected. querying parts...`);
                // Try First Name (Original Case & Lower)
                searchQueries.push(query(collection(db, USERS_COLLECTION), where('firstName', '==', parts[0])));
                searchQueries.push(query(collection(db, USERS_COLLECTION), where('firstName', '==', lowerParts[0])));
                // Try Last Name (Original Case & Lower)
                searchQueries.push(query(collection(db, USERS_COLLECTION), where('lastName', '==', parts[parts.length - 1])));
                searchQueries.push(query(collection(db, USERS_COLLECTION), where('lastName', '==', lowerParts[lowerParts.length - 1])));
            }

            // Execute all queries in parallel
            console.log(`[VertService] 📡 Dispatching ${searchQueries.length} surgical probes...`);
            const snapshots = await Promise.all(searchQueries.map(q => getDocs(q)));

            snapshots.forEach((snap, i) => {
                if (!snap.empty) {
                    console.log(`[VertService] 🎯 Probe #${i} returned ${snap.size} hits.`);
                    snap.forEach(doc => addResult(convertTimestampsToDates(doc.data()) as User));
                }
            });

            // Fallback: Prefix search (Public only)
            if (results.length === 0 && term.length >= 3) {
                console.log(`[VertService] 📡 No surgical hits. Deploying prefix sweep for "${term}"...`);

                // Sweep 1: DisplayName
                const qName = query(
                    collection(db, USERS_COLLECTION),
                    where('displayName', '>=', cleanTerm),
                    where('displayName', '<=', cleanTerm + '\uf8ff'),
                    limit(10)
                );

                // Sweep 2: Email (Captures "dysus" matching "dysus@gigiwatt.com")
                const qEmail = query(
                    collection(db, USERS_COLLECTION),
                    where('email', '>=', term),
                    where('email', '<=', term + '\uf8ff'),
                    limit(10)
                );

                const [snapName, snapEmail] = await Promise.all([getDocs(qName), getDocs(qEmail)]);
                console.log(`[VertService] 🏁 Sweep Results: Name(${snapName.size}), Email(${snapEmail.size})`);

                snapName.forEach(doc => addResult(convertTimestampsToDates(doc.data()) as User));
                snapEmail.forEach(doc => addResult(convertTimestampsToDates(doc.data()) as User));
            }

        } catch (e) {
            console.error("[VertService] ❌ Search Protocol Failure:", e);
        }

        console.log(`[VertService] 🏁 Discovery Scan Complete. Returned ${results.length} results.`);
        return results;
    },

    /**
     * AI IDENTITY RESOLUTION: Uses the Primary AI Companion to fuzzy match
     * an incoming Airlock request with existing Person Tags.
     */
    async performAIFuzzyMatch(user: User, request: AirlockRequest, existingTags: Tag[]): Promise<any> {
        const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
        const personTags = existingTags.filter((t): t is PersonTag => t.type === 'person');

        const tagsSummary = personTags.map(t => {
            const meta = t.metadata;
            return `ID: ${t.id}, Name: ${t.name}, Description: ${t.description}, Birthday: ${meta?.dates?.birth || 'Unknown'}, Gender: ${meta?.gender}, Relationships: ${meta?.relationships?.map(r => r.type).join(', ') || 'None'}`;
        }).join('\n---\n');

        const prompt = `
        SOCIAL IDENTITY RESOLUTION PROTOCOL (GIGI ALPHA)
        
        INCOMING REQUEST:
        - Name: ${request.fromName}
        - Message: ${request.message || "No message provided."}
        
        EXISTING PERSON TAGS IN USER MATRIX:
        ${tagsSummary}
        
        TASK:
        You are ${companion.name}, the user's personal archivist. Compare the incoming identity with the existing tags.
        1. Are there any clear matches (Fuzzy Matching on names, descriptions, or implied context)?
        2. Are there any partial matches (e.g., nicknames like "Sam" vs full names like "Samantha")?
        
        RESPONSE FORMAT (JSON ONLY - No markdown):
        {
            "matches": [
                {
                    "tagId": "string",
                    "confidence": number, // 0.0 to 1.0
                    "reasoning": "string",
                    "suggestion": "string" // Conversational: "Is Sam Cornett actually your daughter, Samantha?"
                }
            ]
        }
        `;

        try {
            const response = await generateAgentResponse(companion, [{ role: 'user', parts: [{ text: prompt }] }], [], "IDENTITY_RESOLUTION", [], user, []);
            const text = response.text || "{}";
            // Strip any occasional markdown the AI might wrap around JSON
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("[VertService] AI Fuzzy match failed:", error);
            return { matches: [] };
        }
    }
};
