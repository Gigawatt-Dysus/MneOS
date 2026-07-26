/**
 * [GEO SCRUB SERVICE] — Data Health Monitor for Spatial Archives
 *
 * This service detects, surfaces, and (with user approval) corrects corrupted address
 * data in the MongoDB Atlas collections (tags, media, anomalies).
 *
 * DESIGN PRINCIPLE: Human-in-the-Loop.
 * GIGI detects anomalies and proposes fixes. It NEVER auto-applies corrections.
 * All repairs require explicit user approval via the DataHealthBanner UI.
 */

import { httpsCallable } from './apiClient';
import { functions } from '../firebaseConfig';
import { geocodingService } from './geocodingService';
import { runNarrativeAudit } from './SovereignNarrativeService';
import { isProtectedStyle } from './SovereignStyleService';

// --- Utilities ---

/**
 * Strips 'undefined' values from an object recursively to satisfy database validation.
 */
const sanitizeForMongoDB = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForMongoDB);
    
    const sanitized: any = {};
    Object.keys(obj).forEach(key => {
        const val = obj[key];
        if (val !== undefined) {
            sanitized[key] = sanitizeForMongoDB(val);
        }
    });
    return sanitized;
};

// --- Types ---

export type AnomalyStatus = 'pending' | 'approved' | 'dismissed';
export type AnomalySource = 'locations_v1' | 'places_v1' | 'media_v1' | 'firestore_tag';
export type AnomalyType = 'corrupted_address' | 'formatting_issue' | 'placeholder_detected' | 'style_learning' | 'incomplete_person';

export interface DataAnomalyAlert {
    id: string;
    type: AnomalyType;
    severity: 'low' | 'medium' | 'high';
    sourceCollection: AnomalySource;
    sourceId: string;
    /** The corrupted string as it exists in the index */
    corruptedValue: string;
    /** GIGI's suggested replacement, or null if unknown */
    suggestedFix: string | null;
    suggestedCoords?: { lat: number; lng: number };
    previewUrl?: string;
    status: AnomalyStatus;
    detectedAt: string;
    targetField?: 'title' | 'description' | 'narrative'; // [ZEN] Precision targeting
}

// --- Address Corruption Heuristics ---
const isAddressCorrupted = (address: string | null | undefined): boolean => {
    if (!address) return false;
    if (address.includes('[object Object]')) return true;
    
    const tokens = address.split(/\s+/);
    const singleCharCount = tokens.filter(t => t.length === 1).length;
    if (tokens.length > 4 && (singleCharCount / tokens.length) > 0.6) return true;
    
    return false;
};

// --- Corruption Severity Heuristic ---
const getSeverity = (corrupted: string): 'low' | 'medium' | 'high' => {
    if (corrupted.includes('[object Object]')) return 'high';
    // Character-split: more chars means more data lost
    const charSplitTokens = corrupted.match(/\b\w\b/g) || [];
    if (charSplitTokens.length >= 6) return 'high';
    if (charSplitTokens.length >= 3) return 'medium';
    return 'low';
};

/**
 * Attempts a reverse geocode to suggest what the address SHOULD be.
 */
const suggestFix = async (lat: number, lng: number, locationIqToken?: string): Promise<string | null> => {
    if (!lat || !lng || lat === 0 || lng === 0) return null;
    
    try {
        const result = await geocodingService.reverse(lat, lng, locationIqToken);
        if (result?.display_name) return result.display_name;
    } catch (e) {
        console.warn('[GeoScrub] Reverse geocode for suggestion failed:', e);
    }
    return null;
};

/**
 * [ZEN] Automated Repair Heuristic
 * Fixes character-split addresses: "M a i n   S t" -> "Main St"
 */
const attemptAutoFix = (corrupted: string): string | null => {
    if (!corrupted) return null;
    if (corrupted.includes('[object Object]')) return null;

    if (corrupted.includes('  ')) {
        return corrupted
            .split('  ')
            .map(word => word.replace(/\s/g, ''))
            .join(' ')
            .trim();
    }
    return corrupted.replace(/\s+/g, ' ').trim();
};


// --- Core Audit Functions ---

// --- Audit State & Throttling ---
let isAuditRunning = false;
let isAuditPaused = false;
let lastAuditTime = 0;
const AUDIT_COOLDOWN = 1000 * 60 * 60; // 1 Hour cooldown

/**
 * [PRIMARY EXPORT] Pauses/Resumes background audits.
 * Used to prevent UI shifts while the user is reviewing anomalies.
 */
export const setAuditPause = (paused: boolean) => {
    isAuditPaused = paused;
    if (paused) console.log('[SovereignHealth] 🛑 Audits paused (User reviewing)');
    else console.log('[SovereignHealth] ▶️ Audits resumed');
};

/**
 * [PRIMARY EXPORT] Run a full geo health audit for the current user.
 */
export const runGeoAudit = async (userId: string, locationIqToken?: string, force = false): Promise<void> => {
    if (!userId || isAuditRunning || isAuditPaused) return;
    
    const now = Date.now();
    if (!force && (now - lastAuditTime < AUDIT_COOLDOWN)) {
        console.log('[SovereignHealth] 🛡️ Audit suppressed (Cooldown active)');
        return;
    }

    if (force) console.log('[SovereignHealth] ⚡ Forced audit triggered by user.');
    isAuditRunning = true;
    console.log('[SovereignHealth] 🩺 Starting geo health audit for user:', userId);

    const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
    const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');
    const anomalies: DataAnomalyAlert[] = [];

    // --- 1. Scan Place Tags (tags collection where type == 'place') ---
    try {
        const response = await sovereignDbQuery({
            collectionName: 'tags',
            userId,
            where: { type: 'place' }
        });

        const placeTags: any[] = response.data || [];
        for (const tag of placeTags) {
            const meta = tag.metadata || {};
            const addrObj = meta.address;
            const addrStr = typeof addrObj === 'string' ? addrObj : addrObj?.streetAddress || '';

            if (isAddressCorrupted(addrStr)) {
                const coords = meta.coordinates || { lat: meta.lat || 0, lng: meta.lng || 0 };
                const fix = await suggestFix(coords.lat, coords.lng, locationIqToken);
                anomalies.push({
                    id: `geo-anomaly-tag-${tag.id}-${Date.now()}`,
                    type: 'corrupted_address',
                    severity: getSeverity(addrStr),
                    sourceCollection: 'firestore_tag',
                    sourceId: tag.id,
                    corruptedValue: addrStr,
                    suggestedFix: fix,
                    suggestedCoords: coords,
                    status: 'pending',
                    detectedAt: new Date().toISOString()
                });
            }
        }
    } catch (e) {
        console.warn('[GeoScrub] Place Tag scan failed:', e);
    }

    // --- 2. Scan Media Locations (media collection) ---
    try {
        const response = await sovereignDbQuery({
            collectionName: 'media',
            userId
        });
        const medias: any[] = response.data || [];

        for (const media of medias) {
            const meta = media.location || {};
            const addrStr = typeof meta === 'string' ? meta : meta.streetAddress || meta.addressLocality || '';

            if (isAddressCorrupted(addrStr)) {
                const coords = meta.coordinates || { lat: meta.lat || 0, lng: meta.lng || 0 };
                const fix = await suggestFix(coords.lat, coords.lng, locationIqToken);
                anomalies.push({
                    id: `geo-anomaly-media-${media.id}-${Date.now()}`,
                    type: 'corrupted_address',
                    severity: getSeverity(addrStr),
                    sourceCollection: 'media_v1',
                    sourceId: media.id,
                    corruptedValue: addrStr,
                    suggestedFix: fix,
                    suggestedCoords: coords,
                    status: 'pending',
                    detectedAt: new Date().toISOString()
                });
            }
        }
    } catch (e) {
        console.warn('[GeoScrub] Media location scan failed:', e);
    }

    // --- 3. Write anomalies to dataAnomalies (skip duplicates by corruptedValue+source) ---
    if (anomalies.length === 0) {
        console.log('[GeoScrub] ✅ No address anomalies detected.');
        isAuditRunning = false;
        return;
    }

    const response = await sovereignDbQuery({
        collectionName: 'dataAnomalies',
        userId
    });
    const existingAnomalies: any[] = response.data || [];
    const existingKeys = new Set(
        existingAnomalies.map(d => `${d.sourceCollection}:${d.sourceId}:${d.corruptedValue}`)
    );

    let newCount = 0;
    for (const anomaly of anomalies) {
        const key = `${anomaly.sourceCollection}:${anomaly.sourceId}:${anomaly.corruptedValue}`;
        if (existingKeys.has(key)) continue; // Already known, don't duplicate

        await sovereignDbWrite({
            collectionName: 'dataAnomalies',
            userId,
            docId: anomaly.id,
            operation: 'set',
            data: sanitizeForMongoDB(anomaly)
        });
        newCount++;
    }

    if (newCount > 0) {
        console.log(`[GeoScrub] ⚠️ Surfaced ${newCount} new geo anomalies for user review.`);
    }

    // Chain narrative audit
    await runNarrativeAudit(userId);

    lastAuditTime = Date.now();
    isAuditRunning = false;
};

/**
 * [PRIMARY EXPORT] Fetches pending anomalies.
 */
export const getPendingAnomalies = async (userId: string): Promise<DataAnomalyAlert[]> => {
    if (!userId) return [];
    try {
        const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
        const response = await sovereignDbQuery({
            collectionName: 'dataAnomalies',
            userId,
            where: { status: 'pending' }
        });
        return response.data || [];
    } catch (e) {
        console.error('[GeoScrub] Failed to fetch anomalies:', e);
        return [];
    }
};

/**
 * [PRIMARY EXPORT] Resolves a geo anomaly by patching the source collection.
 */
export const resolveAnomaly = async (userId: string, anomalyId: string, fixData: any): Promise<void> => {
    const sovereignDbQuery = httpsCallable(functions, 'sovereignDbQuery');
    const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');

    const anomalyResponse = await sovereignDbQuery({
        collectionName: 'dataAnomalies',
        userId,
        docId: anomalyId
    });
    const anomaly = anomalyResponse.data as DataAnomalyAlert;
    
    if (!anomaly) throw new Error("Anomaly not found");

    if (anomaly.sourceCollection === 'firestore_tag') {
        const tagResponse = await sovereignDbQuery({
            collectionName: 'tags',
            userId,
            docId: anomaly.sourceId
        });
        const tag = tagResponse.data;

        if (tag) {
            const meta = tag.metadata || {};
            // Address can be object or string. Just patch it.
            if (typeof meta.address === 'object') {
                meta.address = { ...meta.address, streetAddress: fixData.address, fullAddress: fixData.address };
            } else {
                meta.address = fixData.address;
            }
            if (fixData.lat && fixData.lng) {
                meta.coordinates = { lat: fixData.lat, lng: fixData.lng };
            }

            await sovereignDbWrite({
                collectionName: 'tags',
                userId,
                docId: anomaly.sourceId,
                operation: 'set',
                data: { metadata: meta },
                options: { merge: true }
            });
        }
    } else if (anomaly.sourceCollection === 'media_v1') {
        const mediaResponse = await sovereignDbQuery({
            collectionName: 'media',
            userId,
            docId: anomaly.sourceId
        });
        const media = mediaResponse.data;

        if (media) {
            const loc = media.location || {};
            if (typeof loc === 'object') {
                loc.streetAddress = fixData.address;
                loc.addressLocality = fixData.address; // Fallback
            } else {
                media.location = fixData.address;
            }

            if (fixData.lat && fixData.lng) {
                if (typeof media.location === 'object') {
                    media.location.coordinates = { lat: fixData.lat, lng: fixData.lng };
                }
            }
            
            await sovereignDbWrite({
                collectionName: 'media',
                userId,
                docId: anomaly.sourceId,
                operation: 'set',
                data: { location: media.location },
                options: { merge: true }
            });
        }
    } else if (['locations_v1', 'places_v1'].includes(anomaly.sourceCollection)) {
        console.warn(`[GeoScrub] Cannot resolve anomaly for deprecated Typesense collection: ${anomaly.sourceCollection}`);
    }

    // Mark anomaly as approved
    await sovereignDbWrite({
        collectionName: 'dataAnomalies',
        userId,
        docId: anomalyId,
        operation: 'set',
        data: { status: 'approved', resolvedAt: new Date().toISOString() },
        options: { merge: true }
    });
};

/**
 * [PRIMARY EXPORT] Dismisses an anomaly without applying changes.
 */
export const dismissAnomaly = async (userId: string, anomalyId: string): Promise<void> => {
    const sovereignDbWrite = httpsCallable(functions, 'sovereignDbWrite');
    await sovereignDbWrite({
        collectionName: 'dataAnomalies',
        userId,
        docId: anomalyId,
        operation: 'set',
        data: { status: 'dismissed', resolvedAt: new Date().toISOString() },
        options: { merge: true }
    });
};

export const runHousekeepingAudit = async (userId: string): Promise<any> => {};
export const dismissGeoAnomaly = dismissAnomaly;

