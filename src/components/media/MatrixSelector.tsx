import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Image as ImageIcon, Video, Filter, CheckCircle2, Loader2 } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import type { Media, User } from '../../types';

// [ZEN] The "Real Thing" Architecture
// We import the same hooks that power the main Matrix
import { useMatrixData } from '../matrix/useMatrixData';
import { useMatrixLogic } from '../matrix/useMatrixLogic';
import { MatrixGrid } from '../matrix/MatrixGrid';
import { filterSystemAssets } from '../matrix/MatrixShared';
import { useTypesense } from '../../hooks/useTypesense';

interface MatrixSelectorProps {
    userId: string;
    onSelect: (media: Media[]) => void;
    onClose: () => void;
    title?: string;
    initialSelectedIds?: string[];
}

export default function MatrixSelector({ userId, onSelect, onClose, title = "Select Media", initialSelectedIds = [] }: MatrixSelectorProps) {
    // 1. Context Mocking
    const userStub = useMemo(() => ({ id: userId } as User), [userId]);

    // 2. Data Hook
    const { assets, isLoading: isDataLoading } = useMatrixData(userStub, null);

    // 3. Local UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    // [ZEN] Track both IDs and Objects to ensure no loss during pagination/search
    const [selectedMap, setSelectedMap] = useState<Map<string, Media>>(new Map());
    const [isInitialized, setIsInitialized] = useState(false);
    
    // Observer for Infinite Scroll
    const observerTarget = useRef<HTMLDivElement>(null);

    // 4. Search Hook
    const { matchingIds, isSearching } = useTypesense(searchQuery, userId);

    // 5. Pre-Process Assets
    const eligibleAssets = useMemo(() => {
        const clean = filterSystemAssets(assets);
        return clean.filter(asset => {
            if (filterType === 'all') return true;
            return asset.fileType?.startsWith(filterType);
        });
    }, [assets, filterType]);

    // 6. Sync initial selection (Reactive)
    useEffect(() => {
        if (!isDataLoading && assets.length > 0) {
            setSelectedMap(prev => {
                const next = new Map(prev);
                let changed = false;
                initialSelectedIds.forEach(id => {
                    if (!next.has(id)) {
                        const found = assets.find(a => a.id === id);
                        if (found) {
                            next.set(id, found);
                            changed = true;
                        }
                    }
                });
                return changed ? next : prev;
            });
            setIsInitialized(true);
        }
    }, [assets, isDataLoading, initialSelectedIds]);

    // 7. Logic Hook
    const { 
        groupedVisuals, 
        visualAssets, 
        totalVisualCount, 
        visibleCount, 
        setVisibleCount, 
        PAGE_SIZE,
        isWaitingForResults 
    } = useMatrixLogic({
        assets: eligibleAssets,
        matchingIds,
        isSearching,
        searchQuery,
        sortOrder
    });

    // 8. Infinite Scroll Observer
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

    const handleConfirm = () => {
        onSelect(Array.from(selectedMap.values()));
    };

    const selectedIds = useMemo(() => new Set(selectedMap.keys()), [selectedMap]);

    return (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0f1219] border border-white/10 rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight uppercase">{title}</h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                            {totalVisualCount} artifacts available • {selectedMap.size} selected
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleConfirm}
                            disabled={selectedMap.size === 0}
                            title="Finalize selection and return to editor"
                            className="px-6 py-2 bg-cyan-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-cyan-400 transition-all disabled:opacity-20 active:scale-95"
                        >
                            Confirm Selection
                        </button>
                        <GlassButton onClick={onClose} variant="ghost" title="Cancel and close selector" className="rounded-full h-10 w-10 p-0 flex items-center justify-center">
                            <X size={20} />
                        </GlassButton>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-white/5 flex gap-4 items-center bg-white/[0.02]">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search..."
                            title="Search by content, text, or location"
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-cyan-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                        <button title="Show All Media" onClick={() => setFilterType('all')} className={`p-2 rounded-lg transition-colors ${filterType === 'all' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Filter size={16} /></button>
                        <button title="Show Images Only" onClick={() => setFilterType('image')} className={`p-2 rounded-lg transition-colors ${filterType === 'image' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}><ImageIcon size={16} /></button>
                        <button title="Show Videos Only" onClick={() => setFilterType('video')} className={`p-2 rounded-lg transition-colors ${filterType === 'video' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}><Video size={16} /></button>
                    </div>
                </div>

                {/* Grid Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/10">
                    {isDataLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                            <Loader2 className="animate-spin w-8 h-8 text-cyan-500" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Sovereign Matrix Syncing...</span>
                        </div>
                    ) : (
                        <>
                            <MatrixGrid 
                                groupedAssets={groupedVisuals}
                                viewMode="sm"
                                isSelectionMode={true}
                                selectedIds={selectedIds}
                                loading={isWaitingForResults}
                                onToggleSelection={(id) => {
                                    setSelectedMap(prev => {
                                        const next = new Map(prev);
                                        if (next.has(id)) {
                                            next.delete(id);
                                        } else {
                                            const asset = assets.find(a => a.id === id);
                                            if (asset) next.set(id, asset);
                                        }
                                        return next;
                                    });
                                }}
                                onMediaClick={() => {}} 
                                onEditAsset={() => {}}
                            />
                            
                            {/* Infinite Scroll Sentinel */}
                            {!isWaitingForResults && visualAssets.length < totalVisualCount && (
                                <div ref={observerTarget} className="h-20 flex items-center justify-center text-slate-600">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
