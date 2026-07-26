// services/ai/SovereignHealthService.ts
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    updateDoc,
    query,
    where,
    limit,
    setDoc
} from '../sovereignDbAdapter';

export type AnomalyStatus = 'pending' | 'approved' | 'dismissed';
export type AnomalySource = 'locations_v1' | 'places_v1' | 'media_v1' | 'firestore_tag';
export type AnomalyType = 'corrupted_address' | 'formatting_issue' | 'placeholder_detected' | 'incomplete_person';

export interface DataAnomalyAlert {
    id: string;
    type: AnomalyType;
    severity: 'low' | 'medium' | 'high';
    sourceCollection: AnomalySource;
    sourceId: string;
    corruptedValue: string;
    suggestedFix: string | null;
    suggestedCoords?: { lat: number; lng: number };
    previewUrl?: string;
    status: AnomalyStatus;
    detectedAt: string;
    targetField?: string;
}

/**
 * [SOVEREIGN HEALTH SERVICE] — Data Integrity & Anomaly Management
 */
export class SovereignHealthService {

    /**
     * Returns active health alerts formatted for RAG injection
     */
    static async getActiveAlertsForRAG(userId: string, currentQuery: string): Promise<string[]> {
        try {
            const db = getFirestore();
            const anomaliesRef = collection(db, 'users', userId, 'dataAnomalies');
            
            const q = query(anomaliesRef, where('status', '==', 'pending'), limit(6));
            const snapshot = await getDocs(q);

            if (snapshot.empty) return [];

            return snapshot.docs.map(doc => {
                const a = doc.data() as DataAnomalyAlert;
                return `⚠️ [DATA ANOMALY] ${a.type.replace(/_/g, ' ')} in ${a.sourceCollection}: "${a.corruptedValue}" → Suggested: "${a.suggestedFix || 'Manual review needed'}"`;
            });
        } catch (e) {
            console.warn("[SovereignHealth] Failed to fetch alerts:", e);
            return [];
        }
    }

    /**
     * Runs full geo health audit and registers anomalies
     */
    static async runGeoAudit(userId: string, force = false): Promise<number> {
        console.log(`%c[SovereignHealth] 🩺 Running Geo Audit for ${userId}`, 'color: #3498db; font-weight: bold;');
        
        let anomalyCount = 0;
        const db = getFirestore();

        try {
            // 1. Audit 'tags' collection where type == 'place'
            const tagsRef = collection(db, 'users', userId, 'tags');
            const placeTagsQuery = query(tagsRef, where('type', '==', 'place'));
            const tagsSnapshot = await getDocs(placeTagsQuery);

            for (const tagDoc of tagsSnapshot.docs) {
                const tag = tagDoc.data() as any;
                const meta = tag.metadata || {};
                const addrObj = meta.address;
                const addrStr = typeof addrObj === 'string' ? addrObj : addrObj?.streetAddress || '';

                if (this.isAddressCorrupted(addrStr)) {
                    await this.registerAnomaly(userId, {
                        type: 'corrupted_address',
                        severity: 'medium',
                        sourceCollection: 'firestore_tag',
                        sourceId: tagDoc.id,
                        corruptedValue: addrStr,
                        suggestedFix: this.attemptAutoFix(addrStr)
                    });
                    anomalyCount++;
                }
            }

            // 2. Audit 'media' collection
            const mediaRef = collection(db, 'users', userId, 'media');
            const mediaSnapshot = await getDocs(mediaRef);

            for (const mediaDoc of mediaSnapshot.docs) {
                const media = mediaDoc.data() as any;
                const meta = media.location || {};
                const addrStr = typeof meta === 'string' ? meta : meta.streetAddress || meta.addressLocality || '';

                if (this.isAddressCorrupted(addrStr)) {
                    await this.registerAnomaly(userId, {
                        type: 'corrupted_address',
                        severity: 'medium',
                        sourceCollection: 'media_v1',
                        sourceId: mediaDoc.id,
                        corruptedValue: addrStr,
                        suggestedFix: this.attemptAutoFix(addrStr)
                    });
                    anomalyCount++;
                }
            }

            console.log(`[SovereignHealth] ✅ Audit complete. Detected ${anomalyCount} issues.`);
            return anomalyCount;
        } catch (e: any) {
            console.error("[SovereignHealth] Audit failed:", e);
            return 0;
        }
    }

    /**
     * Helper to detect corruption patterns
     */
    private static isAddressCorrupted(address: string | null | undefined): boolean {
        if (!address) return false;
        if (address.includes('[object Object]')) return true;
        
        const tokens = address.split(/\s+/);
        const singleCharCount = tokens.filter(t => t.length === 1).length;
        if (tokens.length > 4 && singleCharCount / tokens.length > 0.6) return true;
        
        return false;
    }

    /**
     * Attempts to automatically repair character-split or malformed addresses
     */
    private static attemptAutoFix(corrupted: string): string | null {
        if (!corrupted) return null;
        if (corrupted.includes('[object Object]')) return null;

        // Fix character-split: "M a i n   S t" -> "Main St"
        if (corrupted.includes('  ')) {
            return corrupted
                .split('  ')
                .map(word => word.replace(/\s/g, ''))
                .join(' ')
                .trim();
        }

        return corrupted.replace(/\s+/g, ' ').trim();
    }

    /**
     * Registers a detected anomaly in Firestore/MongoDB
     */
    private static async registerAnomaly(userId: string, data: Partial<DataAnomalyAlert>) {
        const db = getFirestore();
        const id = `anomaly_${data.sourceCollection}_${data.sourceId}`;
        const anomalyRef = doc(db, 'users', userId, 'dataAnomalies', id);

        await setDoc(anomalyRef, {
            id,
            status: 'pending',
            detectedAt: new Date().toISOString(),
            ...data
        }, { merge: true });
    }

    /**
     * Applies user-approved fix
     */
    static async applyGeoFix(userId: string, anomaly: DataAnomalyAlert, approvedFix: string): Promise<boolean> {
        if (!approvedFix) return false;

        const db = getFirestore();

        try {
            // Update Firestore/MongoDB Media
            if (anomaly.sourceCollection === 'media_v1') {
                const mediaRef = doc(db, 'users', userId, 'media', anomaly.sourceId);
                const updatePayload: any = {};
                if (anomaly.targetField) {
                    updatePayload[anomaly.targetField] = approvedFix;
                } else {
                    updatePayload.location = approvedFix;
                }
                await updateDoc(mediaRef, updatePayload);
            }

            // Update Firestore/MongoDB Tag
            if (anomaly.sourceCollection === 'firestore_tag') {
                await updateDoc(doc(db, 'users', userId, 'tags', anomaly.sourceId), {
                    'metadata.address': approvedFix
                });
            }

            // Mark resolved
            await updateDoc(doc(db, 'users', userId, 'dataAnomalies', anomaly.id), {
                status: 'approved',
                resolvedAt: new Date().toISOString(),
                appliedFix: approvedFix
            });

            console.log(`[SovereignHealth] ✅ Fix applied: ${anomaly.id}`);
            return true;
        } catch (e) {
            console.error("[SovereignHealth] Fix failed:", e);
            return false;
        }
    }
}
