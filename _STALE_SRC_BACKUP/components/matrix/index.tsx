import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, AlertTriangle, Trash2, Stethoscope, Brush } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import type { Media, Tag, User } from '@/types';
import { getMediaType } from './MatrixShared';

// Logic & Hooks
import { useMatrixData } from './useMatrixData';
import { useMatrixLogic } from './useMatrixLogic';
import { useTypesense } from '@/hooks/useTypesense';
import { useGooglePhotos } from '@/hooks/useGooglePhotos';

// Components
import { MatrixToolbar } from './MatrixToolbar';
import { MatrixGrid } from './MatrixGrid';
import { DocumentList } from './DocumentList';
import MatrixSelector from '../media/MatrixSelector';
import SelectionActionsBar from '../SelectionActionsBar';
import { ImportModal } from './ImportModal';
import { MatrixViewer } from './MatrixStudio';
import { MatrixSearchOverlay } from './MatrixSearchOverlay';
import { ChronoMedic } from '../admin/ChronoMedic';
import { AvatarJanitor } from '../admin/AvatarJanitor';
import { MediaInspector } from './MediaInspector';
import { StagingArea } from '../StagingArea';

interface TheMatrixProps {
    user: User;
    tags: Tag[];
    onNavigate: (view: any, data?: any) => void;
    onDeleteMedia: (id: string) => Promise<void>;
    onStageFiles: (files: File[]) => void;
    initialMediaId?: string | null;
    initialMediaObject?: Media | null;
    onDeepDive?: (target: any) => void;
    returnTo?: any;
}

const TheMatrix: React.FC<TheMatrixProps> = ({
    user, tags = [], onNavigate, onDeleteMedia, onStageFiles,
    initialMediaId, initialMediaObject, onDeepDive, returnTo
}) => {
    // 1. STATE
    const [searchQuery, setSearchQuery] = useState("");
    const [overlaySearchText, setOverlaySearchText] = useState("");
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'sm' | 'md' | 'lg'>('md');
    const [activeTab, setActiveTab] = useState<'visuals' | 'documents'>('visuals');

    // 2. HOOKS
    const { assets, isLoading: isMatrixLoading, updateAsset, getInitialTab } = useMatrixData(user, initialMediaObject);
    const { matchingIds, isSearching } = useTypesense(searchQuery);

    // 3. LOGIC
    const {
        debouncedQuery, isWaitingForResults,
        visualAssets, documentAssets, groupedVisuals, flatLightboxList,
        totalVisualCount, visibleCount, setVisibleCount, PAGE_SIZE
    } = useMatrixLogic({
        assets, matchingIds, isSearching, searchQuery, sortOrder
    });

    const { isOpen: isImportModalOpen, step: importStep, errorMsg, startImport, launchPicker, cancelImport } = useGooglePhotos(onStageFiles, onNavigate);

    // 4. UI STATE
    const [lightboxIndex, setLightboxIndex] = useState(-1);
    const currentViewedItemIdRef = useRef<string | null>(null);
    const [hasHandledInitialLink, setHasHandledInitialLink] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isMatrixSelectorOpen, setIsMatrixSelectorOpen] = useState(false);
    const [localTags, setLocalTags] = useState<Tag[]>([]);

    // Admin Tools State
    const [showChronoMedic, setShowChronoMedic] = useState(false);
    const [showAvatarJanitor, setShowAvatarJanitor] = useState(false);

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

    // 5. INFINITE SCROLL
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && visibleCount < totalVisualCount) {
                    setVisibleCount((prev: number) => prev + PAGE_SIZE);
                }
            }, { threshold: 0.5 }
        );
        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => observer.disconnect();
    }, [visibleCount, totalVisualCount, setVisibleCount]);

    // 6. HANDLERS
    const handleToggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
            return newSet;
        });
    }, []);

    const onAssetClick = (asset: Media) => {
        const idx = flatLightboxList.findIndex(a => a.id === asset.id);
        if (idx >= 0) {
            setLightboxIndex(idx);
            currentViewedItemIdRef.current = asset.id;
        }
    };

    const openInspector = (asset: Media, mode: 'meta' | 'tags' = 'meta') => {
        setInspectorData(asset);
        setInspectorMode(mode);
    };

    useEffect(() => { if (initialMediaObject) setActiveTab(getInitialTab()); }, [initialMediaObject]);

    useEffect(() => {
        const targetId = initialMediaId || initialMediaObject?.id;
        if (targetId && !hasHandledInitialLink && activeTab === 'visuals') {
            const targetIndex = flatLightboxList.findIndex((a: Media) => a.id === targetId);
            if (targetIndex !== -1) {
                setLightboxIndex(targetIndex);
                currentViewedItemIdRef.current = targetId;
                setHasHandledInitialLink(true);
            }
        }
    }, [initialMediaId, initialMediaObject, flatLightboxList, hasHandledInitialLink, activeTab]);

    useEffect(() => {
        if (lightboxIndex >= 0 && currentViewedItemIdRef.current) {
            const newIndex = flatLightboxList.findIndex((a: Media) => a.id === currentViewedItemIdRef.current);
            if (newIndex !== -1 && newIndex !== lightboxIndex) setLightboxIndex(newIndex);
        }
    }, [flatLightboxList, lightboxIndex]);

    const executeDelete = async () => {
        setIsDeleting(true);
        try {
            for (const id of Array.from(selectedIds)) await onDeleteMedia(id);
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        }
    };

    let effectiveIndex = lightboxIndex;
    if (lightboxIndex >= 0 && currentViewedItemIdRef.current) {
        const idx = flatLightboxList.findIndex((a: Media) => a.id === currentViewedItemIdRef.current);
        effectiveIndex = idx !== -1 ? idx : -1;
    }

    const isDeepLinkLoading = (initialMediaId || initialMediaObject) && !hasHandledInitialLink;

    const slides = flatLightboxList.map((a: Media) => {
        if (getMediaType(a) === 'video') return { type: "video" as const, sources: [{ src: a.url, type: a.fileType || 'video/mp4' }] };
        return { src: a.url };
    });

    const handleUpdateLocal = useCallback((updated: Media) => {
        updateAsset(updated);
        if (inspectorData?.id === updated.id) setInspectorData(updated);
    }, [updateAsset, inspectorData]);

    return (
        <div className="h-full flex flex-col bg-slate-950 text-slate-200 overflow-hidden relative">
            <MatrixSearchOverlay isVisible={isWaitingForResults} searchTerm={searchQuery} />

            {!isTaskMode && (
                <MatrixToolbar
                    isSelectionMode={isSelectionMode} setIsSelectionMode={setIsSelectionMode}
                    selectedCount={selectedIds.size} onClearSelection={() => setSelectedIds(new Set())}
                    onDelete={() => setShowDeleteConfirm(true)} onStageFiles={onStageFiles} onImport={startImport}
                    sortOrder={sortOrder} setSortOrder={setSortOrder} viewMode={viewMode} setViewMode={setViewMode}
                    onSearch={(q: string, exact: boolean) => { setSearchQuery(q); }}
                    totalAssets={activeTab === 'visuals' ? visualAssets.length : documentAssets.length}
                    activeTab={activeTab} setActiveTab={setActiveTab} setIsSearching={() => { }} setOverlayText={setOverlaySearchText}
                />
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 -mt-2">
                {isDeepLinkLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mb-2" />
                        <span className="text-xs font-mono tracking-widest">LOCATING ARTIFACT...</span>
                    </div>
                ) : (isMatrixLoading && assets.length === 0) ? (
                    <div className="text-center py-20"><Loader2 className="w-10 h-10 mb-4 animate-spin text-cyan-500 mx-auto" /><p>DECODING MATRIX...</p></div>
                ) : !isTaskMode ? (
                    activeTab === 'visuals' ? (
                        <>
                            <MatrixGrid
                                groupedAssets={groupedVisuals} viewMode={viewMode}
                                isSelectionMode={isSelectionMode} selectedIds={selectedIds}
                                onToggleSelection={handleToggleSelection}
                                loading={isWaitingForResults}
                                onMediaClick={(asset: Media) => { if (isSelectionMode) handleToggleSelection(asset.id); else onAssetClick(asset); }}
                                onEditAsset={(asset: Media) => { if (isSelectionMode) handleToggleSelection(asset.id); else openInspector(asset); }}
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
                            onToggleSelection={handleToggleSelection} onDeleteAsset={(id: string) => { if (window.confirm("Delete?")) onDeleteMedia(id); }}
                        />
                    )
                ) : (
                    <div className="h-full w-full flex items-center justify-center">
                        <div className="animate-pulse bg-slate-900/50 rounded-full w-32 h-32 blur-3xl"></div>
                    </div>
                )}
            </div>

            <div className="absolute bottom-6 right-6 z-[50] flex flex-col gap-3">
                <button
                    onClick={() => setShowAvatarJanitor(true)}
                    className="p-3 bg-amber-900/80 hover:bg-amber-600 text-white rounded-full shadow-[0_0_20px_rgba(245,158,11,0.5)] border border-amber-400/30 transition-all hover:scale-110 group"
                    title="Clean Up Avatars"
                >
                    <Brush size={20} className="group-hover:rotate-12 transition-transform" />
                </button>
                <button
                    onClick={() => setShowChronoMedic(true)}
                    className="p-4 bg-red-900/80 hover:bg-red-600 text-white rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] border border-red-400/30 transition-all hover:scale-110 group"
                    title="Open Chrono-Medic Console"
                >
                    <Stethoscope size={24} className="group-hover:animate-pulse" />
                </button>
            </div>

            {showChronoMedic && <div className="fixed inset-0 z-[100000] bg-black/95 backdrop-blur-xl p-8 flex flex-col animate-in fade-in zoom-in-95 duration-200"><ChronoMedic userId={user.id} onClose={() => setShowChronoMedic(false)} /></div>}
            {showAvatarJanitor && <AvatarJanitor userId={user.id} onClose={() => setShowAvatarJanitor(false)} />}

            <ImportModal isOpen={isImportModalOpen} step={importStep} errorMsg={errorMsg} onLaunch={launchPicker} onCancel={cancelImport} />

            {effectiveIndex >= 0 && (
                <MatrixViewer
                    index={effectiveIndex} setIndex={(newIndex: number) => { setLightboxIndex(newIndex); if (newIndex >= 0) currentViewedItemIdRef.current = flatLightboxList[newIndex].id; }}
                    slides={slides} assets={flatLightboxList} user={user} allTags={activeTags}
                    onClose={() => { if (returnTo) onNavigate(returnTo); else { setLightboxIndex(-1); currentViewedItemIdRef.current = null; } }}
                    onNavigateToTag={(id: string) => { setLightboxIndex(-1); currentViewedItemIdRef.current = null; onNavigate('tags', { tagId: id }); }}
                    onUpdateAsset={updateAsset} onTagCreated={(t: Tag) => setLocalTags(prev => [...prev, t])}
                    onDeepDive={() => { if (onDeepDive) onDeepDive(flatLightboxList.filter((a: Media) => selectedIds.has(a.id))); }}
                    onDiscuss={(media: Media) => { onNavigate('interviews', { initialMessage: `Let's talk about this photo: ${media.title || media.originalName}` }); setLightboxIndex(-1); }}
                />
            )}

            <AnimatePresence>
                {inspectorData && (
                    <div className="absolute inset-0 z-40 pointer-events-none flex justify-end">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setInspectorData(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" />
                        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="w-full max-w-md h-full bg-[#0f1219] shadow-2xl border-l border-white/10 pointer-events-auto flex flex-col">
                            <MediaInspector mode={inspectorMode} media={inspectorData} allTags={activeTags} user={user} onClose={() => setInspectorData(null)} onUpdateLocal={handleUpdateLocal} onTagCreated={(newTag: Tag) => setLocalTags(prev => [...prev, newTag])} />
                            <div className="flex border-t border-white/10 bg-black/20">
                                <button onClick={() => setInspectorMode('meta')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${inspectorMode === 'meta' ? 'text-cyan-400 bg-white/5' : 'text-slate-600 hover:text-slate-400'}`}>Metadata</button>
                                <button onClick={() => setInspectorMode('tags')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${inspectorMode === 'tags' ? 'text-emerald-400 bg-white/5' : 'text-slate-600 hover:text-slate-400'}`}>Entities</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {isMatrixSelectorOpen && <MatrixSelector onClose={() => setIsMatrixSelectorOpen(false)} userId={user.id} onSelect={() => { }} />}
            {selectedIds.size > 0 && <SelectionActionsBar selectedCount={selectedIds.size} onClearSelection={() => setSelectedIds(new Set())} onDelete={() => setShowDeleteConfirm(true)} onDeepDive={() => { if (onDeepDive) onDeepDive(flatLightboxList.filter((a: Media) => selectedIds.has(a.id))); }} onPrint={() => { }} onExportTxt={() => { }} />}
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
        </div>
    );
};

export default TheMatrix;