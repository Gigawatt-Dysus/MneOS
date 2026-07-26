import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, AlertTriangle, Trash2, Brush, Sparkles, Scissors } from 'lucide-react';
// [ZEN SOVEREIGN] Firebase SDK fully excised from TheMatrix. Data flows via sovereignDbQuery.
import type { Media, Tag, User, Bucket } from '../../types';
import { getMediaType } from './MatrixShared';
import { db, collection, getDocs, query, where, updateDoc, doc, deleteField } from '../../services/sovereignDbAdapter';

// Logic & Hooks
import { useMatrixData } from './useMatrixData';
import { useMatrixLogic } from './useMatrixLogic';
import { useTypesense } from '../../hooks/useTypesense';
import { useGooglePhotos } from '../../hooks/useGooglePhotos';

// Components
import { MatrixToolbar } from './MatrixToolbar';
import { MatrixGrid } from './MatrixGrid';
import { QuickDateEditor } from './QuickDateEditor';
import { DocumentList } from './DocumentList';
import MatrixSelector from '../media/MatrixSelector';
import SelectionActionsBar from '../SelectionActionsBar';
import { ImportModal } from './ImportModal';
import { MatrixViewer } from './MatrixStudio';
import { MatrixSearchOverlay } from './MatrixSearchOverlay';
import { PromoteToVortexModal } from './PromoteToVortexModal';
import { TimeslidePortal } from './TimeslidePortal';

import { CitationModal } from './CitationModal';
import { MediaInspector } from './MediaInspector';
import { AccessioningGateway } from '../AccessioningGateway';
import { VaultManagerModal } from './VaultManagerModal';
import { RapidTagSelectorModal } from './RapidTagSelectorModal';
import { TensorAssignmentModal } from './TensorAssignmentModal'; // [ZEN] EmoDB Triage


// [ZEN EWO 005] Neural Re-Up Service
import { MediaEnrichmentService } from '../../services/ai/mediaEnrichment';

interface TheMatrixProps {
    user: User;
    tags: Tag[];
    onNavigate: (view: any, data?: any) => void;
    onDeleteMedia: (id: string, targetCollection?: string) => Promise<void>;
    onStageFiles: (files: File[]) => void;
    initialMediaId?: string | null;
    initialMediaObject?: Media | null;
    onDeepDive?: (target: any) => void;
    returnTo?: any;
    tagId?: string;
    onCreateTag?: (name: string, type: Tag['type'], metadata?: any) => Promise<Tag | null>;
    onShareMedia?: (ids: string[]) => void;
    onUpdateMedia?: (media: Media, targetCollection?: 'media' | 'pending_accessions') => Promise<void>;
    tetheredAnomalyId?: string | null;
    addToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
    initialShowShoebox?: boolean;
    // [ZEN BEAT COP] Optimistic healing pipeline — wired from root app shell
    healMediaViolator?: (media: Media) => Promise<Media>;
    setMedia?: (updater: (prev: Media[]) => Media[]) => void;
    isWallpaperMode?: boolean;
}

const TheMatrix: React.FC<TheMatrixProps> = ({
    user, tags = [], onNavigate, onDeleteMedia, onStageFiles,
    initialMediaId, initialMediaObject, onDeepDive, returnTo, tagId,
    onCreateTag, onShareMedia, onUpdateMedia, tetheredAnomalyId, addToast,
    initialShowShoebox = false, healMediaViolator, setMedia, isWallpaperMode
}) => {
    // 1. STATE
    const [searchQuery, setSearchQuery] = useState("");
    const [overlaySearchText, setOverlaySearchText] = useState("");
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'sm' | 'md' | 'lg' | 'dnd'>('md');
    const [activeTab, setActiveTab] = useState<'visuals' | 'documents'>('visuals');
    const [showShoebox, setShowShoebox] = useState(initialShowShoebox); // [ZEN] Initialize from prop
    const [showFictionalLore, setShowFictionalLore] = useState(false); // [ZEN] Fictional Media Segregation
    const [showRotationReviews, setShowRotationReviews] = useState(false); // [ZEN] Rotation Flag Filtering
    const [showRawDailies, setShowRawDailies] = useState(false); // [ZEN] Director's Cut / Physical Timeline Filtering
    const [aiProvenanceFilter, setAiProvenanceFilter] = useState<'all' | 'gemini-2.5-flash' | 'grok-test' | 'gemini-test' | 'blank-metadata' | 'ai-processed' | 'inferred-dates'>('all'); // [ZEN] Provenance Filtering
    const [editingDateAssets, setEditingDateAssets] = useState<Media[] | null>(null); // [ZEN] Hoisted for Selection Bar
    const [targetCollection, setTargetCollection] = useState<'media' | 'pending_accessions'>('media'); // [ZEN] Collection Targeting
    const [citingMedia, setCitingMedia] = useState<Media | null>(null); // [ZEN] Citation Modal State
    const [showVaultManager, setShowVaultManager] = useState(false); // [ZEN] Vaults
    const [buckets, setBuckets] = useState<Bucket[]>([]); // [ZEN] Vaults
    const [activeBucketId, setActiveBucketId] = useState<string | null>(null); // [ZEN] Vaults

    // 2. HOOKS
    const { assets, isLoading: isMatrixLoading, updateAsset, removeAsset, getInitialTab } = useMatrixData(user, initialMediaObject, targetCollection);
    const { matchingIds, isSearching, invalidateCache } = useTypesense(searchQuery, user.id, targetCollection);

    // 3. LOGIC
    const {
        debouncedQuery, isWaitingForResults,
        visualAssets, documentAssets, groupedVisuals, flatLightboxList,
        totalVisualCount, visibleCount, setVisibleCount, PAGE_SIZE
    } = useMatrixLogic({
        assets, matchingIds, isSearching, searchQuery, sortOrder, 
        initialMediaId: initialMediaId || initialMediaObject?.id,
        showShoebox, // [ZEN] Filter for Shoebox items
        showFictionalLore, // [ZEN] Filter for Fictional items
        showRotationReviews, // [ZEN] Filter for Flagged Rotations
        showRawDailies, // [ZEN] Switch sorting/grouping to Raw Exif/Added Date
        aiProvenanceFilter, // [ZEN] Filter for AI Provenance
        activeBucketId // [ZEN] Filter by Silo
    });

    const { isOpen: isImportModalOpen, step: importStep, errorMsg, startImport, launchPicker, cancelImport, handleConnect } = useGooglePhotos(onStageFiles, onNavigate);

    // 4. UI STATE
    const [currentViewerAssetId, setCurrentViewerAssetId] = useState<string | null>(null);
    const currentViewedItemIdRef = useRef<string | null>(null);
    const [hasHandledInitialLink, setHasHandledInitialLink] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isNeuralReUpRunning, setIsNeuralReUpRunning] = useState(false); // [ZEN EWO 005]
    const [showNarratives, setShowNarratives] = useState(false); // [ZEN EWO 006]
    const [showIdentity, setShowIdentity] = useState(false); // [ZEN EWO 008]
    const [isMatrixSelectorOpen, setIsMatrixSelectorOpen] = useState(false);
    const [autoEdit, setAutoEdit] = useState(false);
    const [localTags, setLocalTags] = useState<Tag[]>([]);
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [showTimeslidePortal, setShowTimeslidePortal] = useState(false);
    const [isMisting, setIsMisting] = useState(false);
    const [showRapidTagSelector, setShowRapidTagSelector] = useState(false);
    const [showTensorModal, setShowTensorModal] = useState(false); // [ZEN] EmoDB BAR Triage


    // Admin Tools State


    const [inspectorData, setInspectorData] = useState<Media | null>(null);
    const [inspectorMode, setInspectorMode] = useState<'meta' | 'tags'>('meta');

    const isTaskMode = !!returnTo;

    // Deduplicate Tags
    const activeTags = useMemo(() => {
        const uniqueTags = new Map<string, Tag>();
        tags.forEach(t => uniqueTags.set(t.id, t));
        localTags.forEach(t => uniqueTags.set(t.id, t));
        return Array.from(uniqueTags.values());
    }, [tags, localTags]);

    const observerTarget = useRef<HTMLDivElement>(null);

    // 5. INFINITE SCROLL & VAULT LOAD
    useEffect(() => {
        const loadBuckets = async () => {
            try {
                const q = query(collection(db, 'buckets'), where('userId', '==', user.id));
                const snap = await getDocs(q);
                const loaded: Bucket[] = [];
                snap.forEach(d => loaded.push({ id: d.id, ...d.data() } as Bucket));
                setBuckets(loaded.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (e) {
                console.error("Failed to load buckets", e);
            }
        };
        loadBuckets();
    }, [user.id]);

    useEffect(() => {
        let timeout1: NodeJS.Timeout;
        let timeout2: NodeJS.Timeout;
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting) {
                    setIsMisting(true);
                    
                    // Wait for mist to materialize, then inject new DOM nodes immediately
                    timeout1 = setTimeout(() => {
                        setVisibleCount((prev: number) => {
                            if (prev >= totalVisualCount) return prev;
                            return prev + PAGE_SIZE;
                        });
                        
                        // Give layout 800ms to stabilize, then lift the mist
                        timeout2 = setTimeout(() => {
                            setIsMisting(false);
                        }, 800);
                    }, 400);
                }
            }, { threshold: 0, rootMargin: '1500px' }
        );
        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => {
            clearTimeout(timeout1);
            clearTimeout(timeout2);
            observer.disconnect();
        };
    }, [totalVisualCount, setVisibleCount]);

    const handleToggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            if (newSet.size > 0) setIsSelectionMode(true);
            else setIsSelectionMode(false);
            return newSet;
        });
    }, []);

    const handleToggleSelectionList = useCallback((ids: string[]) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            // Check if all are already selected
            const allSelected = ids.every(id => newSet.has(id));
            
            ids.forEach(id => {
                if (allSelected) newSet.delete(id);
                else newSet.add(id);
            });
            
            if (newSet.size > 0) setIsSelectionMode(true);
            else setIsSelectionMode(false);
            return newSet;
        });
    }, []);


    const onAssetClick = (asset: Media) => {
        console.log(`[ZEN] onAssetClick Triggered! Received asset ID: ${asset.id} (${asset.title || asset.originalName})`);
        console.log(`[ZEN] Current flatLightboxList length: ${flatLightboxList.length}`);
        
        // [ZEN FORENSIC] Verify the asset exists in the flatLightboxList before opening
        const exists = flatLightboxList.some((a: Media) => a.id === asset.id);
        if (!exists) {
            console.error(`[ZEN] FATAL POINTER DESYNC: Attempted to open asset ${asset.id} which is NOT in the current flatLightboxList!`);
            // We should still open it, to see what happens, but this log is critical.
        }

        setCurrentViewerAssetId(asset.id);
        currentViewedItemIdRef.current = asset.id;
    };

    const openMediaStudio = (asset: Media) => {
        setAutoEdit(true);
        setCurrentViewerAssetId(asset.id);
        currentViewedItemIdRef.current = asset.id;
    };

    // [ZEN EWO 008] Dual-Layer HUD Logic
    const handleToggleNarratives = () => {
        setShowNarratives(prev => {
            const newState = !prev;
            if (newState) setShowIdentity(false); // Mutual exclusion
            return newState;
        });
    };

    const handleToggleIdentity = () => {
        setShowIdentity(prev => {
            const newState = !prev;
            if (newState) setShowNarratives(false); // Mutual exclusion
            return newState;
        });
    };

    useEffect(() => { if (initialMediaObject) setActiveTab(getInitialTab()); }, [initialMediaObject]);

    useEffect(() => {
        const targetId = initialMediaId || initialMediaObject?.id;
        if (targetId && !hasHandledInitialLink) {
            if (activeTab === 'visuals') {
                const targetIndex = flatLightboxList.findIndex((a: Media) => a.id === targetId);
                if (targetIndex !== -1) {
                    setCurrentViewerAssetId(targetId);
                    currentViewedItemIdRef.current = targetId;
                    setHasHandledInitialLink(true);
                }
            } else if (activeTab === 'documents') {
                // If it's a document, we just flag it as handled so the spinner clears.
                setHasHandledInitialLink(true);
            }
        }
    }, [initialMediaId, initialMediaObject, flatLightboxList, hasHandledInitialLink, activeTab]);

    // [ZEN] The useEffect for reconciling lightboxIndex is deleted as we use ID-based navigation directly.

    const executeDelete = async () => {
        setIsDeleting(true);
        try {
            for (const id of Array.from(selectedIds)) {
                await onDeleteMedia(id, targetCollection);
                removeAsset(id);
                if (setMedia) setMedia(prev => prev.filter(m => m.id !== id));
            }
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        }
    };

    const handleMoveToBucket = async (bucketId: string | null) => {
        try {
            for (const id of Array.from(selectedIds)) {
                await updateDoc(doc(db, 'users', user.id, targetCollection, id), { bucketId: bucketId || deleteField() });
                // Optimistic UI update
                const asset = assets.find(a => a.id === id);
                if (asset) {
                    const updated = { ...asset, bucketId: bucketId || undefined };
                    if (!bucketId) delete updated.bucketId;
                    updateAsset(updated);
                    if (setMedia) setMedia(prev => prev.map(m => m.id === id ? updated : m));
                }
            }
        } catch (e) {
            console.error("Failed to move to bucket", e);
            if (addToast) addToast("Failed to move items to Silo", "error");
        } finally {
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        }
    };

    // [ZEN EWO 005] Neural Re-Up Handler: Azure + Grok + Voyage pipeline
    const handleNeuralReUp = useCallback(async () => {
        if (selectedIds.size === 0 || isNeuralReUpRunning) return;

        setIsNeuralReUpRunning(true);
        console.log(`[Neural Re-Up] 🧠 Starting enrichment for ${selectedIds.size} items...`);

        try {
            // Find selected media items from assets
            const selectedMedia = assets.filter(a => selectedIds.has(a.id));
            const enrichItems = selectedMedia.map(m => ({
                id: m.id,
                imageUrl: m.url
            }));

            // Call MediaEnrichmentService.enrichBatch with rate limiting
            const result = await MediaEnrichmentService.enrichBatch(
                enrichItems,
                user.id,
                {
                    delayBetweenItems: selectedIds.size > 10 ? 1000 : 500, // Slower for large batches
                    onProgress: (processed, total, current) => {
                        console.log(`[Neural Re-Up] 📊 Progress: ${processed}/${total} (${current})`);
                    }
                }
            );

            console.log(`[Neural Re-Up] ✅ Complete: ${result.successful} succeeded, ${result.failed} failed`);

            // Trigger vectorization for enriched items
            if (result.successful > 0 && (window as any).vectorBackfill?.runEnriched) {
                console.log('[Neural Re-Up] 🔮 Starting vector enrichment...');
                await (window as any).vectorBackfill.runEnriched(user.id);
            }

            // Clear selection on success
            setSelectedIds(new Set());
            setIsSelectionMode(false);

        } catch (error: any) {
            console.error('[Neural Re-Up] ❌ Pipeline error:', error);
        } finally {
            setIsNeuralReUpRunning(false);
        }
    }, [selectedIds, assets, user.id, isNeuralReUpRunning]);

    const [isHealingThumbs, setIsHealingThumbs] = useState(false);
    
    const queryClient = useQueryClient();

    // [ZEN] Promote to Vortex logic
    const handlePromoteComplete = (eventId: string) => {
        setShowPromoteModal(false);
        setSelectedIds(new Set());
        setIsSelectionMode(false);
        if (addToast) addToast(`Successfully promoted ${selectedIds.size} artifacts to Vortex Scene!`, 'success');
    };

    const handleUpdateLocal = useCallback((updated: Media) => {
        updateAsset(updated);
        invalidateCache(); // [ZEN] Clear the local typesense memory cache to prevent silent vanishing of updated items
        if (onUpdateMedia) onUpdateMedia(updated, targetCollection);
        if (inspectorData?.id === updated.id) setInspectorData(updated);
        queryClient.invalidateQueries({ queryKey: ['matrix', 'media', user?.id, targetCollection] });
    }, [updateAsset, invalidateCache, inspectorData, onUpdateMedia, targetCollection, user?.id, queryClient]);

    const handleHealThumbnails = useCallback(async () => {
        if (selectedIds.size === 0 || isHealingThumbs) return;
        
        if (!healMediaViolator) {
            if (addToast) addToast(`Forensic healing pipeline is disconnected from root.`, 'error');
            return;
        }

        setIsHealingThumbs(true);
        if (addToast) addToast(`Healing ${selectedIds.size} thumbnails. Processing sequentially...`, 'info');
        
        let successCount = 0;
        let failCount = 0;

        try {
            const selectedAssets = assets.filter(a => selectedIds.has(a.id));
            
            for (const asset of selectedAssets) {
                try {
                    const healedAsset = await healMediaViolator(asset);
                    if (healedAsset) {
                        handleUpdateLocal(healedAsset);
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (e) {
                    console.error(`[Heal Thumbs] Failed to heal asset ${asset.id}:`, e);
                    failCount++;
                }
            }

            if (addToast) {
                if (failCount === 0) {
                    addToast(`Successfully healed all ${successCount} thumbnails.`, 'success');
                } else {
                    addToast(`Healing complete: ${successCount} succeeded, ${failCount} failed.`, 'info');
                }
            }
        } catch (error) {
            console.error('[Heal Thumbs] ❌ Pipeline error:', error);
            if (addToast) addToast(`Critical error during bulk heal operation.`, 'error');
        } finally {
            setIsHealingThumbs(false);
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        }
    }, [selectedIds, isHealingThumbs, assets, healMediaViolator, handleUpdateLocal, addToast]);

    // [ZEN] EmoDB BAR Triage Action
    const handleAssignTensor = async (personTagId: string, tensorKey: string, mediaUrls: string[]) => {
        try {
            const tagRef = doc(db, 'users', user.id, 'tags', personTagId);
            const tag = activeTags.find(t => t.id === personTagId);
            if (!tag) throw new Error("Tag not found in active cache");
            
            const updatedTensorMap = { ...(tag.tensorMap || {}) };
            updatedTensorMap[tensorKey] = mediaUrls; // Replace entire array for atomic Hero assignment
            
            await updateDoc(tagRef, { tensorMap: updatedTensorMap });
            if (addToast) addToast(`Successfully mapped ${mediaUrls.length} frame(s) to [${tensorKey}] tensor!`, 'success');
        } catch (e) {
            console.error("[EmoDB] Failed to assign tensor", e);
            if (addToast) addToast("Failed to assign EmoDB tensor frames", "error");
        } finally {
            setSelectedIds(new Set()); // Auto-clear selection
            setIsSelectionMode(false);
        }
    };

    // [ZEN] effectiveIndex removed. We rely on currentViewerAssetId directly.

    const slides = flatLightboxList.map((a: Media) => {
        if (getMediaType(a) === 'video') return { type: "video" as const, sources: [{ src: a.url, type: a.fileType || 'video/mp4' }] };
        return { src: a.url };
    });

    return (
        <div className={`h-full flex flex-col bg-transparent text-slate-200 overflow-hidden relative ${isWallpaperMode ? 'pointer-events-none' : ''}`}>
            {!isWallpaperMode && <MatrixSearchOverlay isVisible={isWaitingForResults} searchTerm={searchQuery} />}

            {!isTaskMode && !isWallpaperMode && (
                <MatrixToolbar
                    isSelectionMode={isSelectionMode} setIsSelectionMode={setIsSelectionMode}
                    selectedCount={selectedIds.size} onClearSelection={() => setSelectedIds(new Set())}
                    onDelete={() => setShowDeleteConfirm(true)} onStageFiles={onStageFiles} onImport={startImport}
                    sortOrder={sortOrder} setSortOrder={setSortOrder} viewMode={viewMode} setViewMode={setViewMode}
                    onSearch={(q: string, exact: boolean) => { setSearchQuery(q); }}
                    totalAssets={activeTab === 'visuals' ? visualAssets.length : documentAssets.length}
                    activeTab={activeTab} setActiveTab={setActiveTab} setIsSearching={() => { }} setOverlayText={setOverlaySearchText}
                    onNeuralReUp={handleNeuralReUp}
                    isNeuralReUpRunning={isNeuralReUpRunning}
                    showNarratives={showNarratives}
                    onToggleNarratives={handleToggleNarratives}
                    showIdentity={showIdentity}
                    onToggleIdentity={handleToggleIdentity}
                    showShoebox={showShoebox}
                    onToggleShoebox={() => setShowShoebox(!showShoebox)}
                    showFictionalLore={showFictionalLore}
                    onToggleFictionalLore={() => setShowFictionalLore(!showFictionalLore)}
                    showRotationReviews={showRotationReviews}
                    onToggleRotationReviews={() => setShowRotationReviews(!showRotationReviews)}
                    showRawDailies={showRawDailies}
                    onToggleRawDailies={() => setShowRawDailies(!showRawDailies)}
                    aiProvenanceFilter={aiProvenanceFilter}
                    onAiProvenanceFilterChange={setAiProvenanceFilter}
                    onOpenAirlock={() => onNavigate('staging')}
                    targetCollection={targetCollection}
                    onTargetCollectionChange={setTargetCollection}
                    buckets={buckets}
                    activeBucketId={activeBucketId}
                    onBucketChange={setActiveBucketId}
                    onMoveToBucket={handleMoveToBucket}
                    onManageBuckets={() => setShowVaultManager(true)}
                    onPromoteToVortex={() => setShowPromoteModal(true)}
                    showTimeslidePortal={showTimeslidePortal}
                    onToggleTimeslidePortal={() => setShowTimeslidePortal(!showTimeslidePortal)}
                    timeslidePortalNode={
                        showTimeslidePortal ? (
                            <TimeslidePortal 
                                user={user} 
                                media={assets} 
                                tags={tags} 
                                chatHistory={[]} 
                                onNavigate={onNavigate} 
                            />
                        ) : undefined
                    }
                />
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 -mt-2">
                {isWaitingForResults ? (
                   <div className="text-center py-20"><Loader2 className="w-10 h-10 mb-4 animate-spin text-cyan-500 mx-auto" /><p>FILTERING TEMPORAL CLUSTERS...</p></div>
                ) : (isMatrixLoading && assets.length === 0) ? (
                    <div className="text-center py-20"><Loader2 className="w-10 h-10 mb-4 animate-spin text-cyan-500 mx-auto" /><p>DECODING MATRIX...</p></div>
                ) : !isTaskMode ? (
                    activeTab === 'visuals' ? (
                        <>
                            <MatrixGrid
                                groupedAssets={groupedVisuals} viewMode={viewMode}
                                isSelectionMode={isSelectionMode} selectedIds={selectedIds}
                                onToggleSelection={handleToggleSelection}
                                onToggleSelectionList={handleToggleSelectionList}
                                loading={isWaitingForResults}
                                onMediaClick={(asset: Media) => { if (isSelectionMode) handleToggleSelection(asset.id); else onAssetClick(asset); }}
                                onEditAsset={(asset: Media) => { if (isSelectionMode) handleToggleSelection(asset.id); else openMediaStudio(asset); }}
                                showNarratives={showNarratives}
                                showIdentity={showIdentity}
                                showShoebox={showShoebox}
                                onToggleShoebox={() => setShowShoebox(!showShoebox)}
                                tags={activeTags}
                                userId={user.id}
                                healMediaViolator={healMediaViolator}
                                setMedia={setMedia}
                                updateAsset={updateAsset}
                                onCiteAsset={(asset: Media) => setCitingMedia(asset)}
                                targetCollection={targetCollection}
                                isWallpaperMode={isWallpaperMode}
                            />
                            {!isWaitingForResults && visualAssets.length < totalVisualCount && (
                                <div ref={observerTarget} className="h-20 flex items-center justify-center text-slate-600">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                            )}
                        </>
                    ) : (
                        <DocumentList
                            assets={documentAssets} selectedIds={selectedIds} isSelectionMode={isSelectionMode}
                            onToggleSelection={handleToggleSelection} onDeleteAsset={async (id: string) => { 
                                if (window.confirm("Delete?")) {
                                    await onDeleteMedia(id, targetCollection);
                                    removeAsset(id);
                                    if (setMedia) setMedia(prev => prev.filter(m => m.id !== id));
                                }
                            }}
                        />
                    )
                ) : (
                    <div className="h-full w-full flex items-center justify-center">
                        <div className="animate-pulse bg-slate-900/50 rounded-full w-32 h-32 blur-3xl"></div>
                    </div>
                )}
            </div>

            {/* [ZEN] "Mists of Time" Transition Shutter */}
            <div 
                className={`fixed bottom-0 left-0 right-0 h-[60vh] bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent backdrop-blur-[2px] z-[50] pointer-events-none transition-all duration-700 ease-in-out ${isMisting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`} 
            />


            {showVaultManager && (
                <VaultManagerModal
                    userId={user.id}
                    onClose={() => setShowVaultManager(false)}
                    onVaultsChanged={async () => {
                        const q = query(collection(db, 'buckets'), where('userId', '==', user.id));
                        const snap = await getDocs(q);
                        const loaded: Bucket[] = [];
                        snap.forEach(d => loaded.push({ id: d.id, ...d.data() } as Bucket));
                        setBuckets(loaded.sort((a, b) => a.name.localeCompare(b.name)));
                    }}
                />
            )}

            {citingMedia && (
                <CitationModal 
                    isOpen={true} 
                    onClose={() => setCitingMedia(null)} 
                    media={citingMedia} 
                    userId={user.id} 
                    healMediaViolator={healMediaViolator}
                    onTicketIssued={() => {
                        // Optionally refresh or remove from pending if needed
                        console.log("Citation Issued and Processed for", citingMedia.id);
                        setCitingMedia(null);
                    }}
                />
            )}

            <ImportModal isOpen={isImportModalOpen} step={importStep} errorMsg={errorMsg} onLaunch={launchPicker} onConnect={handleConnect} onCancel={cancelImport} />

            {currentViewerAssetId && (
                <MatrixViewer
                    currentAssetId={currentViewerAssetId} setCurrentAssetId={(id: string) => { setCurrentViewerAssetId(id); currentViewedItemIdRef.current = id; }}
                    assets={flatLightboxList} user={user} allTags={activeTags}
                    onClose={() => { 
                        if (returnTo === 'tags' && tagId) onNavigate('tags', { tagId });
                        else if (returnTo) onNavigate(returnTo); 
                        else { setCurrentViewerAssetId(null); currentViewedItemIdRef.current = null; setAutoEdit(false); } 
                    }}
                    onNavigateToTag={(id: string) => { setCurrentViewerAssetId(null); currentViewedItemIdRef.current = null; onNavigate('tags', { tagId: id }); }}
                    onUpdateAsset={handleUpdateLocal} onTagCreated={(t: Tag) => setLocalTags(prev => [...prev, t])}
                    onDeleteMedia={async (id: string) => {
                        await onDeleteMedia(id, targetCollection);
                        removeAsset(id);
                        if (setMedia) setMedia(prev => prev.filter(m => m.id !== id));
                    }}
                    autoEdit={autoEdit}
                    tetheredAnomalyId={tetheredAnomalyId}
                    onDeepDive={() => { if (onDeepDive) onDeepDive(flatLightboxList.filter((a: Media) => selectedIds.has(a.id))); }}
                    onDiscuss={(media: Media) => { onNavigate('interviews', { initialMessage: `Let's talk about this photo: ${media.title || media.originalName}` }); setCurrentViewerAssetId(null); }}
                    onCiteAsset={(asset: Media) => setCitingMedia(asset)}
                    targetCollection={targetCollection}
                />
            )}

            {isMatrixSelectorOpen && <MatrixSelector onClose={() => setIsMatrixSelectorOpen(false)} userId={user.id} onSelect={() => { }} />}
            {selectedIds.size > 0 && (
                <SelectionActionsBar
                    selectedCount={selectedIds.size}
                    onClearSelection={() => setSelectedIds(new Set())}
                    onDelete={() => setShowDeleteConfirm(true)}
                    onAlias={() => setShowRapidTagSelector(true)}
                    onDeepDive={() => { if (onDeepDive) onDeepDive(flatLightboxList.filter((a: Media) => selectedIds.has(a.id))); }}
                    onEditDate={() => {
                        const selectedAssets = flatLightboxList.filter(a => selectedIds.has(a.id));
                        if (selectedAssets.length > 0) setEditingDateAssets(selectedAssets);
                    }}
                    onPrint={() => { }}
                    onExportTxt={() => { }}
                    onShare={() => {
                        onShareMedia?.(Array.from(selectedIds));
                    }}
                    onHealThumbnails={handleHealThumbnails}
                    buckets={buckets}
                    onMoveToBucket={handleMoveToBucket}
                    onCreateBucket={() => setShowVaultManager(true)}
                    onPromoteToVortex={() => setShowPromoteModal(true)}
                    onAssignTensor={() => setShowTensorModal(true)} // [ZEN] Trigger EmoDB Triage
                />
            )}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-red-500/50 rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center gap-4 mb-4 text-red-500"><AlertTriangle size={32} /><h3 className="text-xl font-bold text-white">Delete Artifacts?</h3></div>
                        <p className="text-slate-300 mb-6 leading-relaxed">Permanently delete <strong className="text-white">{selectedIds.size}</strong> item(s)?</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting} className="px-5 py-2.5 rounded-lg font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">Cancel</button>
                            <button onClick={executeDelete} disabled={isDeleting} className="px-5 py-2.5 rounded-lg font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg hover:shadow-red-900/50 flex items-center gap-2">{isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 size={18} />}{isDeleting ? 'Deleting...' : 'Confirm Delete'}</button>
                        </div>
                    </div>
                </div>
            )}
            {editingDateAssets && (
                <QuickDateEditor 
                    assets={editingDateAssets} 
                    userId={user.id} 
                    onClose={() => {
                        setEditingDateAssets(null);
                        setSelectedIds(new Set()); // Auto-clear selection after batch edit
                    }} 
                    updateAsset={handleUpdateLocal} 
                    setMedia={setMedia} 
                />
            )}
            
            {showPromoteModal && (
                <PromoteToVortexModal
                    isOpen={showPromoteModal}
                    onClose={() => setShowPromoteModal(false)}
                    selectedAssets={assets.filter(a => selectedIds.has(a.id))}
                    userId={user.id}
                    onComplete={handlePromoteComplete}
                />
            )}

            {showRapidTagSelector && (
                <RapidTagSelectorModal
                    isOpen={showRapidTagSelector}
                    onClose={() => setShowRapidTagSelector(false)}
                    tags={activeTags}
                    selectedAssets={assets.filter(a => selectedIds.has(a.id))}
                    userId={user.id}
                    targetCollection={targetCollection}
                    onCreateTag={onCreateTag}
                    onTagCreated={(newTag) => setLocalTags(prev => [...prev, newTag])}
                    onComplete={(updatedAssets) => {
                        updatedAssets.forEach(handleUpdateLocal);
                        setSelectedIds(new Set()); // Auto-clear selection
                        setIsSelectionMode(false);
                    }}
                />
            )}

            {/* [ZEN] EmoDB BAR Triage Modal */}
            <TensorAssignmentModal
                isOpen={showTensorModal}
                onClose={() => setShowTensorModal(false)}
                selectedMedia={assets.filter(a => selectedIds.has(a.id))}
                tags={activeTags}
                onAssign={handleAssignTensor}
            />
        </div>
    );
};

export default TheMatrix;