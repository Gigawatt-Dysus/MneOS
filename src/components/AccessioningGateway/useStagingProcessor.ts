import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, deleteDoc, doc, addDoc, updateDoc, Timestamp, getDocs, limit, orderBy, writeBatch } from '../../services/sovereignDbAdapter';
import { db } from '../../firebaseConfig';
import { processIncomingFile } from '../../utils/imageProcessor';
import { saveToMatrix } from '../../services/MatrixService'; 
import { uploadFile } from '../../services/storageService';
import type { StagedAsset } from './types'; 
import { generateContentHash } from '../../utils/hasher';
import { parseLegacyData, processGenieArchive, FB_NOISE_PATTERNS } from '../../services/importer';
import { stageLegacyData } from '../../services/sovereignBackup';
import { appDataService } from '../../services/serviceManager';

export const useStagingProcessor = (
    stagedFiles: File[], 
    rawUserId: string, 
    onClear: () => void
) => {
    const userId = rawUserId?.trim();
    const [stagedAssets, setStagedAssets] = useState<StagedAsset[]>([]);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); 
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [processingMessage, setProcessingMessage] = useState<string | null>(null);
    const processedRef = useRef<Set<string>>(new Set());
    const inFlightRef = useRef<Set<string>>(new Set());
    const genieTriggeredRef = useRef<boolean>(false);

    // --- Robust Media URL Normalizer ---
    // Fixes malformed URIs coming from Google Photos Picker / sideload flows
    // (e.g. accidental spaces in path construction like "users / uid /uploads/...")
    // This ensures previews always load and we don't store or display broken URLs.
    // Signed URLs (with query params) have their path cleaned but query string preserved intact.
    const normalizeMediaUrl = (url: string | undefined | null): string | undefined => {
        if (!url || typeof url !== 'string') return url || undefined;
        
        let cleaned = url.trim();
        
        // [ZEN NUCLEAR FIX] The Global Undoubler. 
        // We use a regex with the 'g' flag to strip away MULTIPLE layers of encoding 
        // (e.g. %25252F -> %2F) in one pass.
        if (cleaned.includes('%25')) {
            cleaned = cleaned.replace(/%252F/g, '%2F');
            // Second pass for triple-encoding if it exists
            cleaned = cleaned.replace(/%252F/g, '%2F'); 
        }

        // [ZEN HEALING] Direct Domain Restore
        // If the URL has been saved in the direct, un-resolvable .firebasestorage.app format:
        // e.g. https://gigi-time-machine.firebasestorage.app/o/users%2F...
        // We instantly restore it to the correct Firebase REST API endpoint so DNS resolves!
        if (cleaned.includes('.firebasestorage.app/o/') && !cleaned.includes('firebasestorage.googleapis.com')) {
            cleaned = cleaned.replace(
                /https:\/\/([^/]+)\.firebasestorage\.app\/o\/(.+)/,
                'https://firebasestorage.googleapis.com/v0/b/$1.firebasestorage.app/o/$2?alt=media'
            );
            console.log(`[ZenHealing] Restored broken direct firebasestorage.app URL to API format: ${cleaned}`);
        }

        // [ZEN HEALING] Redirect Legacy GCS URLs
        // If a record has the old storage.googleapis.com URL, it will 403 because of PAP.
        // We redirect it to the secure firebasestorage v0 endpoint.
        if (cleaned.includes('storage.googleapis.com') && !cleaned.includes('firebasestorage.googleapis.com')) {
            try {
                const urlObj = new URL(cleaned);
                const pathSegments = urlObj.pathname.split('/').filter(Boolean);
                if (pathSegments.length >= 2) {
                    const bucket = pathSegments[0]; // e.g. "gigi-time-machine.firebasestorage.app" or "gigi-time-machine.appspot.com"
                    const filePath = pathSegments.slice(1).join('/'); // e.g. "users/9MPVGVTxE8dXvkCrl1XrWHQZCl23/uploads/VID_20260518_081941.mp4"
                    const encodedPath = encodeURIComponent(filePath).replace(/%2F/g, '%2F'); // Keep slashes as %2F
                    cleaned = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
                    console.log(`[ZenHealing] Redirected legacy GCS URL: ${cleaned.substring(0, 80)}...`);
                }
            } catch (e) {
                // Fall through if URL parsing fails
            }
        }

        // [ZEN FIX] If the URL is already a signed/tokened Firebase URL, DO NOT TOUCH IT.
        if (cleaned.includes('alt=media') && cleaned.includes('token=')) {
            return cleaned;
        }

        // Remove all whitespace
        cleaned = cleaned.replace(/\s+/g, '');
        
        // Fix common path corruption patterns
        cleaned = cleaned
            .replace(/%20\//g, '/')
            .replace(/\/%20/g, '/')
            .replace(/%20%2F/g, '/')
            .replace(/users\/%20/g, 'users/')
            .replace(/\/%20uploads/g, '/uploads')
            .replace(/\/%20/g, '/');
        
        // Final safety check for Firebase v0 URLs
        if (cleaned.includes('firebasestorage')) {
            try {
                // If it already contains an encoded slash but no token, it might be an old 
                // sideload that needs a token. For now, we just ensure it's not double-encoded.
                if (cleaned.includes('%2F')) {
                    const parts = cleaned.split('/o/');
                    if (parts.length === 2) {
                        const pathPart = parts[1].split('?')[0];
                        const cleanPath = decodeURIComponent(pathPart);
                        const reEncoded = encodeURIComponent(cleanPath);
                        cleaned = `${parts[0]}/o/${reEncoded}?alt=media`;
                    }
                }
            } catch (e) {}
        }
        return cleaned;
    };

    // --- Persistent Staging Pipeline ---
    // We listen to the "pending_accessions" collection. This is now the ONLY source of truth.
    // Whether it came from a local drop, an email, or Google Photos, it lives here until accessioned.
    const subLogRef = useRef<string | null>(null);

    useEffect(() => {
        if (!userId) return;

        const subKey = `${userId}-${sortOrder}`;
        if (subLogRef.current !== subKey) {
            console.log(`[Gateway] Subscribing to persistent triage for ${userId} (Sort: ${sortOrder})...`);
            subLogRef.current = subKey;
        }

        const q = query(
            collection(db, 'users', userId, 'pending_accessions'),
            orderBy('createdAt', sortOrder)
        );

        const unsub = onSnapshot(q, (snapshot: any) => {
            const assets: StagedAsset[] = snapshot.docs
                .filter((snap: any) => snap.data().status === 'pending')
                .map((snap: any) => {
                    const data = snap.data();
            
                    // [ZEN FIX] Universal Temporal Resolution
                    // Handles Live Timestamps, POJO Timestamps, ISO Strings, and Unix Numbers
                    const rawDate = data.logicalDate;
                    let logicalDate: Date;

                    if (rawDate && typeof rawDate.toDate === 'function') {
                        logicalDate = rawDate.toDate();
                    } else if (rawDate && typeof rawDate.seconds === 'number') {
                        logicalDate = new Date(rawDate.seconds * 1000);
                    } else if (rawDate) {
                        logicalDate = new Date(rawDate);
                    } else {
                        logicalDate = new Date();
                    }

                    // Final safety check to prevent "Invalid Date" crashes in toISOString or toLocaleDateString
                    if (isNaN(logicalDate.getTime())) {
                        console.warn(`[Gateway] Asset ${snap.id} has invalid date, reverting to current.`, rawDate);
                        logicalDate = new Date();
                    }

                    // [ZEN FIX] Always normalize mediaUrl/preview on read to guarantee working previews
                    // Also fallback to legacy `url` which is used by forge_sync.js
                    const normalizedUrl = normalizeMediaUrl(data.mediaUrl || data.url);

                    return {
                        ...data,
                        id: snap.id,
                        type: data.type === 'IMAGE' ? 'media' : (data.type || 'media'), 
                        mediaUrl: normalizedUrl,
                        objectKey: data.objectKey,
                        preview: normalizedUrl || (data.thumbnailUrls ? data.thumbnailUrls.medium || data.thumbnailUrls.small : undefined), 
                        logicalDate,
                        metadata: {
                            width: 800, 
                            height: 600,
                            aspectRatio: 1.33,
                            ...data.triage
                        },
                        thumbnails: data.thumbnails || data.thumbnailUrls || {},
                        datePrecision: data.datePrecision || 'exact',
                        aiStatus: data.aiStatus || 'completed',
                        status: data.status || 'ready',
                        tagIds: (data.tagIds && data.tagIds.length > 0) ? data.tagIds : (data.triage?.suggestedTags || []),
                        detectedFaces: data.detectedFaces || [],
                        title: data.title || data.triage?.title || '',
                        description: data.description || data.triage?.summary || '',
                        caption: data.caption || '',
                        preset: data.preset || 'original',
                        adjustmentStack: data.adjustmentStack || {},
                        polishLayers: data.polishLayers || [],
                        editHistory: data.editHistory || [],
                        source: data.source || 'cloud',
                        fileType: data.fileType,
                        fileName: data.fileName,
                        fileSize: data.fileSize,
                        mediaIds: data.mediaIds || [],
                        narrative: data.narrative || ''
                    };
                });
            setStagedAssets(assets);
        });

        return () => unsub();
    }, [userId, sortOrder]);

    // --- Handoff to Persistent Triage ---
    useEffect(() => {
        const handleIncomingQueue = async () => {
            if (!stagedFiles || stagedFiles.length === 0 || !userId) {
                genieTriggeredRef.current = false;
                return;
            }

            const distinctItems = stagedFiles.filter(item => {
                const key = (item instanceof File) 
                    ? `file-${item.name}-${item.size}-${item.lastModified}`
                    : `cloud-${(item as any).id}`;
                if (processedRef.current.has(key) || inFlightRef.current.has(key)) return false;
                inFlightRef.current.add(key);
                return true;
            });

            if (distinctItems.length === 0) return;

            setIsProcessing(true);
            setProcessingMessage(`Importing ${distinctItems.length} new artifacts...`);

            try {
                for (const item of distinctItems) {
                    const key = (item instanceof File) 
                        ? `file-${item.name}-${item.size}-${item.lastModified}`
                        : `cloud-${(item as any).id}`;
                    
                    if (item instanceof File) {
                        const file = item;
                        
                        // 1. Generate local hash
                        const contentHash = await generateContentHash(file);
                        
                        // 2. Check if already in production or persistent staging to prevent double-uploading
                        const duplicateQuery = query(
                            collection(db, 'users', userId, 'media'),
                            where('contentHash', '==', contentHash),
                            limit(1)
                        );
                        const dupSnap = await getDocs(duplicateQuery);
                        const existingAsset = !dupSnap.empty ? dupSnap.docs[0] : null;

                        const stagingQuery = query(
                            collection(db, 'users', userId, 'pending_accessions'),
                            where('contentHash', '==', contentHash),
                            limit(1)
                        );
                        const stagingSnap = await getDocs(stagingQuery);
                        if (!stagingSnap.empty) {
                            console.warn(`[Gateway] Local file already in staging pipeline: ${file.name}`);
                            continue;
                        }

                        // 3. Process File Locally
                        const processed = await processIncomingFile(file);

                        // 4. Upload to Cloud (B2) immediately to ensure persistence
                        let url = '';
                        if (!existingAsset) {
                            const uploadResult = await uploadFile(file, userId);
                            url = uploadResult.url;
                        } else {
                            console.warn(`[Gateway] Duplicate detected for: ${file.name} (Original ID: ${existingAsset.id})`);
                            url = (existingAsset.data() as any).url;
                        }
                        
                        if (url || existingAsset) {
                            // 5. Register in Persistent Triage (Firestore)
                            const payload = {
                                mediaUrl: url,
                                logicalDate: Timestamp.fromDate(processed?.logicalDate || new Date()),
                                status: 'pending',
                                source: 'local',
                                title: file.name,
                                description: '',
                                tagIds: [],
                                fileType: file.type,
                                fileName: file.name,
                                fileSize: file.size,
                                contentHash,
                                isDuplicate: !!existingAsset,
                                duplicateOf: existingAsset?.id || null,
                                triage: {
                                    title: file.name,
                                    width: processed?.metadata?.width || 800,
                                    height: processed?.metadata?.height || 600,
                                    aspectRatio: processed?.metadata?.aspectRatio || 1.33,
                                    contentHash
                                },
                                createdAt: Timestamp.now()
                            };

                            await addDoc(collection(db, 'users', userId, 'pending_accessions'), payload);
                            console.log(`[Gateway] ✅ Persistent Triage complete for: ${file.name}`);
                        }
                    }
                    
                    processedRef.current.add(key);
                    inFlightRef.current.delete(key);
                }
                
                onClear();
            } catch (error) {
                console.error("[Gateway] Triage handoff failed:", error);
            } finally {
                setIsProcessing(false);
                setProcessingMessage(null);
            }
        };
        handleIncomingQueue();
    }, [stagedFiles, userId]);

    // --- Actions ---

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            for (const asset of stagedAssets) {
                await saveToMatrix(asset as any, userId);
                await deleteDoc(doc(db, 'users', userId, 'pending_accessions', asset.id));
            }
            onClear();
        } catch (error) {
            console.error("Accession failed", error);
            alert("Failed to accession some artifacts.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemove = async (id: string) => {
        await deleteDoc(doc(db, 'users', userId, 'pending_accessions', id));
    };

    const handleUpdateAsset = async (id: string, updates: Partial<StagedAsset>) => {
        const docRef = doc(db, 'users', userId, 'pending_accessions', id);
        
        const firestoreUpdates: any = {};
        if (updates.title !== undefined) {
            firestoreUpdates.title = updates.title;
            firestoreUpdates['triage.title'] = updates.title;
        }
        if (updates.description !== undefined) {
            firestoreUpdates.description = updates.description;
            firestoreUpdates['triage.summary'] = updates.description;
        }
        if (updates.logicalDate !== undefined) {
            firestoreUpdates.logicalDate = Timestamp.fromDate(updates.logicalDate);
        }
        if (updates.tagIds !== undefined) {
            firestoreUpdates.tagIds = updates.tagIds;
            firestoreUpdates['triage.suggestedTags'] = updates.tagIds;
        }
        if (updates.mediaIds !== undefined) firestoreUpdates.mediaIds = updates.mediaIds;
        if (updates.narrative !== undefined) firestoreUpdates.narrative = updates.narrative;
        if (updates.location !== undefined) firestoreUpdates.location = updates.location;
        if (updates.isPurist !== undefined) firestoreUpdates.isPurist = updates.isPurist;
        if (updates.polishLayers !== undefined) firestoreUpdates.polishLayers = updates.polishLayers;
        if (updates.preset !== undefined) firestoreUpdates.preset = updates.preset;
        if (updates.adjustmentStack !== undefined) firestoreUpdates.adjustmentStack = updates.adjustmentStack;
        if (updates.editHistory !== undefined) firestoreUpdates.editHistory = updates.editHistory;
        if (updates.url !== undefined) firestoreUpdates.mediaUrl = updates.url; 

        // [ZEN] CASCADING NEURAL MERGE
        if ((updates as any).matchedToId) {
            const targetId = (updates as any).matchedToId;
            console.log(`[Gateway] Neural Merge: Re-tethering all assets from ${id} to ${targetId}`);
            
            const batch = writeBatch(db);
            
            const q = query(collection(db, 'users', userId, 'pending_accessions'), where('status', '==', 'pending'));
            const snap = await getDocs(q);
            
            snap.docs.forEach(d => {
                const data = d.data();
                if (d.id !== id && data.tagIds?.includes(id)) {
                    const nextTagIds = data.tagIds.map((t: string) => t === id ? targetId : t);
                    batch.update(doc(db, 'users', userId, 'pending_accessions', d.id), { tagIds: nextTagIds });
                }
            });
            
            firestoreUpdates.status = 'merged';
            firestoreUpdates.matchedToId = targetId;
            await batch.commit();
        }

        await updateDoc(docRef, firestoreUpdates);
    };

    const clearAll = async () => {
        if (window.confirm("Are you sure you want to REJECT and delete all staged artifacts in this pipeline?")) {
            const q = query(collection(db, 'users', userId, 'pending_accessions'), where('status', '==', 'pending'));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => {
                batch.delete(doc(db, 'users', userId, 'pending_accessions', d.id));
            });
            await batch.commit();
            onClear();
        }
    };

    const purgeNoise = async () => {
        if (window.confirm("Purge system/UI noise files (e.g. spacers, borders, standard system icons)?")) {
            const q = query(collection(db, 'users', userId, 'pending_accessions'), where('status', '==', 'pending'));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            let count = 0;
            snap.docs.forEach(d => {
                const name = d.data().fileName || '';
                const size = d.data().fileSize || 0;
                const isNoise = FB_NOISE_PATTERNS.some(p => p.test(name)) || size < 2000;
                if (isNoise) {
                    batch.delete(doc(db, 'users', userId, 'pending_accessions', d.id));
                    count++;
                }
            });
            await batch.commit();
            alert(`Successfully purged ${count} noise assets.`);
        }
    };

    // [ZEN] Sovereign Stitching Import Engine Integration
    const handleGenieArchive = async (jsonFiles: File[], htmlFiles: File[]) => {
        setIsProcessing(true);
        setProcessingMessage("Initiating Sovereign Stitching pipeline...");
        try {
            const result = await processGenieArchive(
                [...jsonFiles, ...htmlFiles],
                userId,
                (curr, tot, msg) => setProcessingMessage(`${msg} (${curr}/${tot})`),
                [],
                htmlFiles
            );
            
            setProcessingMessage("Staging archival memories and media elements...");
            await stageLegacyData(userId, {
                events: result.events || [],
                tags: result.tags || [],
                media: result.media || [],
                journal: result.journal || []
            });
            const uploadCount = (result.events?.length || 0) + (result.media?.length || 0) + (result.tags?.length || 0);
            alert(`Sovereign Stitching Complete: Staged ${uploadCount} archival elements!`);
        } catch (e) {
            console.error("Genie archive ingestion failed:", e);
            alert("Stitching fail: Ingestion aborted due to structural format failure.");
        } finally {
            setIsProcessing(false);
            setProcessingMessage(null);
        }
    };

    return {
        stagedAssets,
        isProcessing,
        isSaving,
        sortOrder,
        setSortOrder,
        handleSaveAll,
        handleRemove,
        handleUpdateAsset,
        clearAll,
        purgeNoise,
        processingMessage,
        handleGenieArchive
    };
};