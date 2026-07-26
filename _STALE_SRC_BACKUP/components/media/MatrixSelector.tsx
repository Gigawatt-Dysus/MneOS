import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Image as ImageIcon, Video, Filter, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import type { Media, User } from '@/types';

// [ZEN] The "Real Thing" Architecture
// We import the same hooks that power the main Matrix
import { useMatrixData } from '../matrix/useMatrixData';
import { useMatrixLogic } from '../matrix/useMatrixLogic';
import { MatrixGrid } from '../matrix/MatrixGrid';
import { filterSystemAssets } from '../matrix/MatrixShared';
import { useTypesense } from '../../hooks/useTypesense';

interface MatrixSelectorProps {
    userId: string;
    onSelect: (media: Media) => void;
    onClose: () => void;
    title?: string;
    allowedType?: 'image' | 'video' | 'all';
}

export default function MatrixSelector({ userId, onSelect, onClose, title = "Select Media", allowedType = "all" }: MatrixSelectorProps) {
    // 1. Context Mocking (Since hooks expect a User object, we construct a minimal one)
    const userStub = useMemo(() => ({ id: userId } as User), [userId]);

    // 2. Data Hook (The same pipe as the main view)
    const { assets, isLoading: isDataLoading } = useMatrixData(userStub, null);

    // 3. Local UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>(allowedType);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Observer for Infinite Scroll
    const observerTarget = useRef<HTMLDivElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);

    // 4. Search Hook (Typesense)
    const { matchingIds, isSearching } = useTypesense(searchQuery);

    // 5. Pre-Process Assets (Apply Global Filters + Type Filter)
    const eligibleAssets = useMemo(() => {
        // A. Apply the "System Asset" filter (Removes Avatars/Blobs)
        const clean = filterSystemAssets(assets);

        // B. Apply Local Type Filter
        return clean.filter(asset => {
            if (filterType === 'all') return true;
            return asset.fileType?.startsWith(filterType);
        });
    }, [assets, filterType]);

    // 6. Logic Hook (The Brain: Sorts, Groups, Paginates)
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

    // 7. Infinite Scroll Observer
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

    return (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0f1219] border border-white/10 rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/20">
                    <div>
                        <h2 className="text-xl font-bold text-white">{title}</h2>
                        <p className="text-xs text-slate-400 mt-1">
                            {totalVisualCount} artifacts available
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            ref={uploadInputRef}
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    const reader = new FileReader();
                                    reader.onload = (re) => {
                                        if (re.target?.result) {
                                            onSelect({ url: re.target.result as string } as Media);
                                        }
                                    };
                                    reader.readAsDataURL(e.target.files[0]);
                                }
                            }}
                        />
                        <GlassButton
                            onClick={() => uploadInputRef.current?.click()}
                            variant="primary"
                            className="h-10 px-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-cyan-900/20"
                        >
                            <Upload size={16} /> Upload
                        </GlassButton>
                        <GlassButton onClick={onClose} variant="ghost" className="rounded-full h-10 w-10 p-0 flex items-center justify-center">
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
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-cyan-500 outline-none"
                        />
                    </div>
                    {allowedType === 'all' && (
                        <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`p-2 rounded-lg transition-colors ${filterType === 'all' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                title="All"
                            >
                                <Filter size={16} />
                            </button>
                            <button
                                onClick={() => setFilterType('image')}
                                className={`p-2 rounded-lg transition-colors ${filterType === 'image' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                title="Images"
                            >
                                <ImageIcon size={16} />
                            </button>
                            <button
                                onClick={() => setFilterType('video')}
                                className={`p-2 rounded-lg transition-colors ${filterType === 'video' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                title="Videos"
                            >
                                <Video size={16} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Grid Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/10">
                    {isDataLoading ? (
                        <div className="h-full flex items-center justify-center text-slate-500">
                            <Loader2 className="animate-spin mb-2 mr-2" /> Connecting...
                        </div>
                    ) : visualAssets.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <div className="p-4 bg-white/5 rounded-full mb-4">
                                <ImageIcon size={48} className="text-slate-600" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Library Empty</h3>
                            <p className="max-w-md text-slate-400 text-sm leading-relaxed">
                                To use a custom avatar, you must first upload media to your Matrix.
                                Click the <span className="text-cyan-400 font-bold">"Upload"</span> button above to add images from your device.
                            </p>
                        </div>
                    ) : (
                        <>
                            <MatrixGrid
                                groupedAssets={groupedVisuals}
                                viewMode="sm"
                                isSelectionMode={true}
                                selectedIds={new Set(selectedId ? [selectedId] : [])}
                                loading={isWaitingForResults} // [ZEN] Inherits the "Hard Cut" spinner logic
                                onToggleSelection={(id) => {
                                    setSelectedId(id);
                                    // Immediate selection confirmation
                                    const asset = assets.find(a => a.id === id);
                                    if (asset) onSelect(asset);
                                }}
                                onMediaClick={() => { }} // No lightbox in selector
                                onEditAsset={() => { }} // No edit in selector
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