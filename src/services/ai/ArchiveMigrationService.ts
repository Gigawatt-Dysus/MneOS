import { db } from '../../firebaseConfig';
import { collection, getDocs, query, where, orderBy, writeBatch, doc } from '../sovereignDbAdapter';
import { callXAI, getEmbedding } from './providers';
import { typesenseService } from '../typesenseService';
import { sanitizeContent, isStructurallyFailed } from '../../utils/textUtils';

export interface MigrationCluster {
    id: string;
    startTime: number;
    endTime: number;
    messages: any[];
    proposedSession: 'workshop' | 'living_room' | 'studio' | 'sanctuary';
    summary: string;
    semanticTags: string[];
    confidence: number;
    structuralFailure?: boolean;
}

export class ArchiveMigrationService {
    private static AUDIT_MODEL = 'grok-4.3';

    /**
     * Helper to cast any date/timestamp format to ms
     */
    private static getMs(t: any): number {
        if (!t) return Date.now();
        if (typeof t.toMillis === 'function') return t.toMillis();
        if (typeof t.seconds === 'number') return t.seconds * 1000 + (t.nanoseconds || 0) / 1000000;
        if (t instanceof Date) return t.getTime();
        if (typeof t === 'number') return t;
        const parsed = new Date(t).getTime();
        return isNaN(parsed) ? Date.now() : parsed;
    }

    /**
     * Step 1: Cluster legacy messages into "Episodes" based on temporal gaps.
     */
    static async clusterLegacyMessages(userId: string): Promise<MigrationCluster[]> {
        console.log(`[Migration] Clustering legacy messages for ${userId}...`);
        const segmentsRef = collection(db, 'users', userId, 'chat_segments');
        const q = query(segmentsRef, orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);

        const segments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        let clusters: MigrationCluster[] = [];
        
        let currentCluster: any[] = [];
        const GAP_THRESHOLD = 4 * 60 * 60 * 1000; // 4 hours

        segments.forEach((seg: any) => {
            const segTime = this.getMs(seg.timestamp);
            if (currentCluster.length === 0) {
                currentCluster.push(seg);
            } else {
                const lastSeg = currentCluster[currentCluster.length - 1];
                const lastTime = this.getMs(lastSeg.timestamp);
                if (segTime - lastTime < GAP_THRESHOLD) {
                    currentCluster.push(seg);
                } else {
                    clusters.push(this.finalizeCluster(currentCluster));
                    currentCluster = [seg];
                }
            }
        });

        if (currentCluster.length > 0) {
            clusters.push(this.finalizeCluster(currentCluster));
        }

        // [ZEN PATCH] Singleton Prevention Pass
        return this.preventSingletons(clusters);
    }

    public static preventSingletons(clusters: MigrationCluster[]): MigrationCluster[] {
        if (clusters.length < 2) return clusters;
        const finalClusters: MigrationCluster[] = [];
        const MAX_AFFINITY_GAP = 24 * 60 * 60 * 1000; // 24 Hours

        for (let i = 0; i < clusters.length; i++) {
            const current = clusters[i];
            
            // If it's a singleton, try to merge it into the previous cluster
            if (current.messages.length === 1 && finalClusters.length > 0) {
                const prev = finalClusters[finalClusters.length - 1];
                const distPrev = current.startTime - prev.endTime;

                if (distPrev < MAX_AFFINITY_GAP) {
                    console.log(`[Migration] 🧠 Merging singleton into Episode ${finalClusters.length}`);
                    prev.messages.push(...current.messages);
                    prev.endTime = current.endTime;
                    continue;
                }
            }
            finalClusters.push(current);
        }

        return finalClusters;
    }

    private static finalizeCluster(messages: any[]): MigrationCluster {
        const start = this.getMs(messages[0].timestamp);
        const end = this.getMs(messages[messages.length - 1].timestamp);

        return {
            id: `cluster-${start}`,
            startTime: start,
            endTime: end,
            messages,
            proposedSession: 'living_room', // Default
            summary: '',
            semanticTags: [],
            confidence: 0
        };
    }

    /**
     * Step 2: Audit a cluster with AI to propose a room and generate a summary.
     */
    static async auditCluster(cluster: MigrationCluster): Promise<MigrationCluster> {
        console.log(`[Migration] Auditing cluster ${cluster.id} (${cluster.messages.length} msgs)...`);
        
        const transcript = cluster.messages
            .slice(0, 15)
            .map(m => `[${m.role.toUpperCase()}] [SOURCE: ${m.source || 'chat'}]: ${sanitizeContent(m.content).substring(0, 300)}`)
            .join('\n');

        const systemPrompt = `You are the Archive Sorcerer.
Analyze this conversation cluster. Determine which "Sovereign Pillar" it belongs to.

[PROTOCOL: DECONTAMINATION]
- Messages tagged with [SOURCE: EMAIL] are EXEMPT from "Structural Failure" penalties.
- These legacy records may lack [square bracket] or {curly brace} tags; this is NORMAL.

[PILLAR RUBRIC]:
- WORKSHOP: Coding, technical research, logic, data analysis, project management.
- LIVING_ROOM: Banter, daily life, general news, shared memories, casual bonding.
- STUDIO: Creative writing, Voidrifters plot, world-building, fictional character work.
- SANCTUARY: Intimate roleplay, high sensory detail, erotic metaphors, deep emotional surrender.

RETURN EXCLUSIVELY RAW VALID JSON:
{
  "pillar": "WORKSHOP|LIVING_ROOM|STUDIO|SANCTUARY",
  "summary": "Brief 1-sentence context",
  "tags": ["3-5 lowercase semantic tags"],
  "confidence": 0-100,
  "structuralFailure": boolean
}

If the cluster is mostly [SOURCE: CHAT] and lacks proper tagging, set structuralFailure to true. 
If it is mostly [SOURCE: EMAIL], structuralFailure should be false regardless of tagging.
`;

        try {
            const response = await callXAI(this.AUDIT_MODEL, [
                { role: 'user', parts: [{ text: `TRANSCRIPT:\n${transcript}` }] }
            ], systemPrompt, { 
                temperature: 0.1,
                maxOutputTokens: 1024 
            });

            const cleanJson = (response.text || "{}").replace(/```json\n?|```/g, '').trim();
            const result = JSON.parse(cleanJson);

            return {
                ...cluster,
                proposedSession: result.pillar.toLowerCase() as any,
                summary: result.summary,
                semanticTags: result.tags,
                confidence: result.confidence || 85,
                structuralFailure: result.structuralFailure || false
            };
        } catch (e) {
            console.error(`[Migration] Audit failed for cluster ${cluster.id}:`, e);
            return cluster;
        }
    }

    /**
     * Step 3: Vectorize the summary for a cluster.
     */
    static async vectorizeCluster(cluster: MigrationCluster): Promise<number[] | null> {
        if (!cluster.summary) return null;
        console.log(`[Migration] Vectorizing summary for ${cluster.id}...`);
        return await getEmbedding(cluster.summary);
    }

    /**
     * Step 4: Finalize the migration in batches.
     */
    static async executeMigration(userId: string, manifest: MigrationCluster[]) {
        console.log(`[Migration] Executing migration for ${manifest.length} clusters...`);
        const batch = writeBatch(db);

        for (const cluster of manifest) {
            const embedding = await this.vectorizeCluster(cluster);
            
            for (const msg of cluster.messages) {
                const msgRef = doc(db, 'users', userId, 'chat_segments', msg.id);
                const updateData: any = {
                    sessionId: cluster.proposedSession,
                    summary: cluster.summary,
                    semanticTags: cluster.semanticTags
                };
                if (embedding) updateData.embedding = embedding;

                batch.update(msgRef, updateData);

                // [ZEN FIX] Ensure timestamp is int64 for Typesense
                typesenseService.upsertDocument('chat_memory_v2_robust', {
                    id: msg.id,
                    content: msg.content,
                    role: msg.role,
                    timestamp: Math.floor(this.getMs(msg.timestamp)),
                    user_id: userId,
                    sessionId: cluster.proposedSession,
                    summary: cluster.summary,
                    semanticTags: cluster.semanticTags,
                    embedding: embedding
                }).catch(e => console.error(`[Migration] Typesense sync failed for ${msg.id}:`, e));
            }
        }

        await batch.commit();
        console.log(`[Migration] Migration complete.`);
    }
}
