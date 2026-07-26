import { httpsCallable } from './apiClient';
import { functions } from '../firebaseConfig';

export const TypesenseAdminService = {
    /**
     * [SAFETY NET] BACKUP BEFORE WRITE
     * Copies the current MongoDB state to a backup collection.
     */
    async backupRecord(userId: string, id: string) {
        const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
        const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');

        const snapResponse = await sovereignDbQuery({
            collectionName: 'chat_segments',
            userId,
            docId: id
        });
        const docData = snapResponse.data;

        if (docData) {
            const backupId = `${id}_${Date.now()}`;
            await sovereignDbWrite({
                collectionName: 'chat_segments_backups',
                userId,
                docId: backupId,
                operation: 'set',
                data: {
                    ...docData,
                    backup_timestamp: new Date().toISOString(),
                    original_id: id
                }
            });
            console.log(`%c[SAFETY] Backup created for ${id}`, "color: #00ff00; font-weight: bold;");
        }
    },

    async updateDocument(userId: string, id: string, partialDoc: any, isDryRun: boolean = false) {
        if (isDryRun) {
            console.log(`%c[DRY-RUN] Simulation for ${id}:`, "color: #ff9900; font-weight: bold;", partialDoc);
            return { success: "Simulated" };
        }

        // 1. CREATE SAFETY SNAPSHOT BEFORE ANY DESTRUCTIVE ACTION
        await this.backupRecord(userId, id);

        // 2. UPDATE MONGODB (The SSOT)
        const payload: any = {
            last_audited: new Date().toISOString()
        };

        if (partialDoc.content !== undefined) payload.content = partialDoc.content;
        if (partialDoc.model_id !== undefined) payload.model_id = partialDoc.model_id;
        if (partialDoc.sentiment !== undefined) payload.sentiment = partialDoc.sentiment;
        if (partialDoc.is_core !== undefined) payload.is_core = partialDoc.is_core;
        if (partialDoc.island_id !== undefined) payload.island_id = partialDoc.island_id;
        if (partialDoc.keywords !== undefined) payload.keywords = partialDoc.keywords;
        if (partialDoc.user_id !== undefined) payload.user_id = partialDoc.user_id;

        const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');
        await sovereignDbWrite({
            collectionName: 'chat_segments',
            userId,
            docId: id,
            operation: 'set',
            data: payload,
            options: { merge: true }
        });
        
        return { success: true };
    },

    async deleteDocument(userId: string, id: string) {
        console.log(`%c[SAFETY] Destructive Delete initiated for ${id}`, "color: #ff0000; font-weight: bold;");

        const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');
        await sovereignDbWrite({
            collectionName: 'chat_segments',
            userId,
            docId: id,
            operation: 'delete'
        });

        return { success: true };
    },

    async batchUpdateModel(userId: string, searchPhrase: string, targetModelId: string, isDryRun: boolean = false) {
        const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
        const qLower = searchPhrase.toLowerCase();
        
        // Native Pipeline for filtering matching phrase in MongoDB before pulling them down
        const response = await sovereignDbQuery({
            collectionName: 'chat_segments',
            userId,
            pipeline: [
                { $match: { content: { $regex: qLower, $options: "i" } } }
            ]
        });

        const candidates: any[] = response.data || [];
        if (candidates.length === 0) return 0;

        console.log(`%c[SAFETY] Batch targeting ${candidates.length} records.`, "color: #ff9900; font-weight: bold;");

        let updatedCount = 0;
        for (const docSnap of candidates) {
            await this.updateDocument(userId, docSnap.id, { model_id: targetModelId }, isDryRun);
            updatedCount++;
        }
        return updatedCount;
    },

    async listRecent(userId: string, limitCount: number = 20) {
        const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
        const response = await sovereignDbQuery({
            collectionName: 'chat_segments',
            userId,
            sort: { timestamp: -1 },
            limit: limitCount
        });

        const docs: any[] = response.data || [];
        const hits = docs.map(data => ({
            document: data
        }));

        return { hits, found: hits.length };
    },

    async searchIndex(userId: string, queryStr: string) {
        const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
        const qLower = queryStr.toLowerCase();
        
        let pipeline: any[] = [];
        if (qLower !== '*') {
            pipeline = [
                { $match: { 
                    $or: [
                        { content: { $regex: qLower, $options: "i" } },
                        { model_id: { $regex: qLower, $options: "i" } },
                        { role: { $regex: qLower, $options: "i" } }
                    ]
                }},
                { $limit: 100 }
            ];
        } else {
            pipeline = [{ $limit: 100 }];
        }

        const response = await sovereignDbQuery({
            collectionName: 'chat_segments',
            userId,
            pipeline
        });

        const matches: any[] = response.data || [];
        const hits = matches.map(data => ({
            document: data
        }));

        return { hits, found: hits.length };
    },

    /**
     * [SANITIZER] BATCH CONTENT REPLACEMENT
     * Finds occurrences of a phrase and replaces it with new text.
     * Enforces strict Javascript-side verification to prevent fuzzy-match accidents.
     */
    async batchSanitizeContent(userId: string, findPhrase: string, replaceWith: string, isDryRun: boolean = false) {
        const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
        
        const response = await sovereignDbQuery({
            collectionName: 'chat_segments',
            userId,
            pipeline: [
                { $match: { content: { $regex: findPhrase, $options: "i" } } }
            ]
        });

        const candidates: any[] = response.data || [];
        if (candidates.length === 0) return 0;

        // Strict verification
        const verifiedCandidates = candidates.filter(doc => (doc.content || '').includes(findPhrase));

        console.log(`[Sanitizer] Found ${verifiedCandidates.length} candidates for "${findPhrase}"`);

        let updatedCount = 0;
        for (const data of verifiedCandidates) {
            const currentContent = data.content || "";
            const newContent = currentContent.replaceAll(findPhrase, replaceWith);

            try {
                await this.updateDocument(userId, data.id, { content: newContent }, isDryRun);
                updatedCount++;
            } catch (err) {
                console.error(`[Sanitizer] Failed to update document ${data.id}:`, err);
                throw err;
            }
        }

        return updatedCount;
    },

    /**
     * [RESCUE MISSION] REVERSE SYNC
     * Typesense is decommissioned, native MongoDB Atlas is the absolute source of truth.
     */
    async rescueCloudData(userId: string, onProgress: (msg: string) => void) {
        onProgress("Rescue complete. All records already exist natively in MongoDB Atlas.");
        return 0;
    }
};