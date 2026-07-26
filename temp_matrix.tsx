import React, { memo } from 'react';
import PhotoAlbum, { RenderPhotoProps } from 'react-photo-album';
import { Circle, CheckCircle2, Film, Music, FileText, File, Play, Edit2, History, Sparkles, Zap, Archive, HelpCircle, RotateCw, CalendarDays, X } from 'lucide-react';
import type { Media } from '../../types';
import { getMediaType } from './MatrixShared';
import { GlassButton } from '../GlassButton';
import { NarrativeEditor } from './NarrativeEditor';
import { FaceOverlay } from './FaceOverlay';
import { ParticleWireframe } from './ParticleWireframe';
// [ZEN SOVEREIGN] No Firebase imports. Tags/healing injected via props from TheMatrix parent.

interface MatrixGridProps {
    groupedAssets: { title: string; dateKey: number; assets: Media[] }[];
    viewMode: 'sm' | 'md' | 'lg';
    isSelectionMode: boolean;
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    onMediaClick: (asset: Media) => void;
    onEditAsset: (asset: Media) => void;
    loading?: boolean; // [ZEN] Added for search responsiveness
    // [ZEN EWO 006] Neural Glass narrative overlay
    showNarratives?: boolean;
    // [ZEN EWO 008] Identity & Curation HUD
    showIdentity?: boolean;
    userId?: string; // Optional, can fallback to auth
    showShoebox?: boolean;
    onToggleShoebox?: () => void;
    tags?: any[]; // Tag[] passed from parent ΓÇö optional, defaults to []
    healMediaViolator?: (media: Media) => Promise<Media>;
    setMedia?: (updater: (prev: Media[]) => Media[]) => void;
    updateAsset?: (asset: Media) => void;
}

export const QuickDateEditor = ({ assets, userId, onClose, updateAsset, setMedia }: { assets: Media[], userId: string, onClose: () => void, updateAsset?: any, setMedia?: any }) => {
    const asset = assets[0]; // Reference for initial values
    const getSafeDate = (val: any): Date => {
        if (!val) return new Date();
        if (val instanceof Date) return val;
        if (typeof val.toDate === 'function') return val.toDate();
        if (typeof val === 'string') {
             const d = new Date(val);
             return isNaN(d.getTime()) ? new Date() : d;
        }
        return new Date();
    };

    const getInputValue = (date: Date, precision: string): string => {
        const pad = (num: number) => num.toString().padStart(2, '0');
        const year = date.getFullYear().toString().padStart(4, '0');
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        
        if (['year', 'circa', 'decade'].includes(precision)) return year;
        if (precision === 'month') return `${year}-${month}`;
        if (precision === 'day') return `${year}-${month}-${day}`;
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const [datePrecision, setDatePrecision] = React.useState<'exact' | 'day' | 'month' | 'year' | 'unknown' | 'circa' | 'decade'>(asset.datePrecision || 'exact');
    const [dateInput, setDateInput] = React.useState(getInputValue(getSafeDate(asset.logicalDate), asset.datePrecision || 'exact'));
    const [isSaving, setIsSaving] = React.useState(false);

    const getFullIsoStr = (input: string, precision: string) => {
        if (!input) return new Date().toISOString();
        if (['year', 'circa', 'decade'].includes(precision)) {
            return `${String(input).padStart(4, '0')}-01-01T00:00:00.000Z`;
        } else if (precision === 'month') {
            const parts = input.split('-');
            return `${(parts[0]||'0000').padStart(4, '0')}-${parts[1]||'01'}-01T00:00:00.000Z`;
        } else if (precision === 'day') {
            const parts = input.split('-');
            return `${(parts[0]||'0000').padStart(4, '0')}-${parts[1]||'01'}-${parts[2]||'01'}T00:00:00.000Z`;
        } else {
            // datetime-local
            const parts = input.split('T');
            const dateParts = (parts[0]||'').split('-');
            return `${(dateParts[0]||'0000').padStart(4, '0')}-${dateParts[1]||'01'}-${dateParts[2]||'01'}T${parts[1]||'00:00'}:00.000Z`;
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const finalDate = new Date(getFullIsoStr(dateInput, datePrecision));
            let finalLogicalDate = asset.logicalDate;
            let finalYear = asset.year;
            
            if (!isNaN(finalDate.getTime())) {
                finalLogicalDate = finalDate.toISOString();
                finalYear = finalDate.getFullYear();
            }

            const updatedAssets = assets.map(a => ({ 
                ...a, 
                logicalDate: datePrecision === 'unknown' ? a.logicalDate : finalLogicalDate, 
                year: datePrecision === 'unknown' ? a.year : finalYear,
                datePrecision 
            } as Media));

            if (updateAsset) {
                updatedAssets.forEach(a => updateAsset(a));
            } else if (setMedia) {
                setMedia((prev: Media[]) => {
                    const updatedIds = new Set(updatedAssets.map(a => a.id));
                    return prev.map(m => {
                        const newM = updatedAssets.find(a => a.id === m.id);
                        return newM ? newM : m;
                    });
                });
            }

            const { appDataService } = await import('../../services/serviceManager');
            if (userId) {
                await Promise.all(updatedAssets.map(a => appDataService.saveMedia(userId, a)));
            }
            onClose();
        } catch(err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md" 
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-[#0f1219] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <CalendarDays size={16} className="text-cyan-400" /> Temporal Shift
                    </h3>
                    <button onClick={onClose} title="Cancel and close temporal editor" className="text-slate-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Precision Level</label>
                        <select 
                            value={datePrecision} 
                            onChange={(e) => {
                                const newPrecision = e.target.value as any;
                                setDatePrecision(newPrecision);
                                const d = new Date(getFullIsoStr(dateInput, datePrecision));
                                if (!isNaN(d.getTime())) {
                                    setDateInput(getInputValue(d, newPrecision));
                                }
                            }}
                            title="Select the precision level of the date (e.g., if you only know the year)"
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none uppercase tracking-wider text-[10px] font-bold"
                        >
                            <option value="exact">Exact Time</option>
                            <option value="day">Date Only</option>
                            <option value="month">Month & Year</option>
                            <option value="year">Year Only</option>
                            <option value="circa">Circa (Approx Year)</option>
                            <option value="decade">Decade / Epoch</option>
                            <option value="unknown">Unknown (Shoebox)</option>
                        </select>
                    </div>

                    {datePrecision !== 'unknown' && (
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">Temporal Coordinate</label>
                            <input 
                                type={['year', 'circa', 'decade'].includes(datePrecision) ? 'number' : datePrecision === 'month' ? 'month' : datePrecision === 'day' ? 'date' : 'datetime-local'}
                                value={dateInput}
                                onChange={e => setDateInput(e.target.value)}
                                title="Enter the fuzzy or exact temporal coordinate"
                                className="w-full bg-[#1a1d26] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none font-mono shadow-inner uppercase tracking-wider [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
                            />
                        </div>
                    )}
                    
                    <button 
                        type="button"
                        onClick={handleSave} 
                        disabled={isSaving}
                        title="Commit the updated temporal coordinates to the Sovereign Matrix database"
                        className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 mt-4"
                    >
                        {isSaving ? 'Syncing...' : `Lock Coordinates for ${assets.length} Item${assets.length !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

// [ZEN] The "Pulse" Skeleton to prevent main-thread freeze
const MatrixSkeleton: React.FC<{ viewMode: 'sm' | 'md' | 'lg' }> = ({ viewMode }) => {
    // Match the approximate density of the view mode
    const items = Array.from({ length: viewMode === 'sm' ? 40 : 20 });
    return (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 animate-in fade-in duration-200">
            {items.map((_, i) => (
                <div
                    key={i}
                    className="aspect-square bg-white/5 rounded-lg animate-pulse border border-white/5"
                    style={{ animationDelay: `${i * 20}ms` }}
                />
            ))}
        </div>
    );
};

const MatrixGridComponent: React.FC<MatrixGridProps> = ({
    groupedAssets, viewMode, isSelectionMode, selectedIds, onToggleSelection, onMediaClick, onEditAsset, loading = false, showNarratives = false, showIdentity = false, userId, showShoebox = false, onToggleShoebox, healMediaViolator, setMedia, updateAsset, tags = []
}) => {
    // [ZEN EWO 008] Track which narrative is being edited inline
    const [editingNarrativeId, setEditingNarrativeId] = React.useState<string | null>(null);
    const [editingDateAsset, setEditingDateAsset] = React.useState<Media | null>(null);
    const healingRef = React.useRef<Set<string>>(new Set());

    // Fallback userId ΓÇö must be supplied via prop in the sovereign architecture
    const currentUserId = userId || '';

    // [ZEN] 1. Hard Cut: Immediate Skeleton Return
    if (loading) {
        return <MatrixSkeleton viewMode={viewMode} />;
    }

    if (groupedAssets.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-20 px-4">
                <div className="relative group">
                    <div className={`absolute inset-0 blur-3xl animate-pulse rounded-full opacity-20 ${showShoebox ? 'bg-amber-500' : 'bg-slate-700'}`}></div>
                    <div className="bg-slate-900/40 p-10 rounded-[2.5rem] border border-white/5 backdrop-blur-2xl relative flex flex-col items-center max-w-sm w-full text-center shadow-2xl">
                        <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/10 group-hover:scale-110 transition-transform duration-500 relative">
                            <Archive size={48} className={showShoebox ? 'text-amber-500' : 'text-slate-500'} />
                            <div className={`absolute -top-2 -right-2 bg-slate-950 rounded-full p-1.5 border-2 ${showShoebox ? 'border-amber-500 text-amber-500' : 'border-slate-700 text-slate-500'}`}>
                                <HelpCircle size={16} />
                            </div>
                        </div>
                        <h2 className="text-xl font-black tracking-tight text-white mb-3 uppercase">
                            {showShoebox ? "Shoebox is Empty" : "No Chronological Matches"}
                        </h2>
                        <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                            {showShoebox 
                                ? "There are no undated artifacts in your archival vault. Everything is currently slotted into the timeline."
                                : "No items found for this date range. They might be waiting in the Shoebox."
                            }
                        </p>
                        
                        {!showShoebox && onToggleShoebox && (
                            <GlassButton 
                                onClick={onToggleShoebox}
                                variant="primary"
                                className="w-full py-4 bg-amber-600/20 hover:bg-amber-600/40 text-amber-500 shadow-[0_0_40px_rgba(217,119,6,0.15)] group/btn border-amber-500/30"
                            >
                                <Archive size={18} className="mr-3 group-hover/btn:rotate-12 transition-transform" />
                                OPEN THE SHOEBOX
                            </GlassButton>
                        )}

                        {showShoebox && onToggleShoebox && (
                            <GlassButton 
                                onClick={onToggleShoebox}
                                variant="secondary"
                                className="w-full py-4 bg-slate-800/40 hover:bg-slate-800/60 text-slate-300 border-white/10"
                            >
                                <History size={18} className="mr-3" />
                                RETURN TO TIMELINE
                            </GlassButton>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const targetRowHeight = viewMode === 'sm' ? 120 : viewMode === 'md' ? 220 : 400;

    // [ZEN RESTORED] The "Singleton Row" Fix
    // This prevents a single image from stretching 100% width
    const getContainerConstraint = (count: number) => {
        if (count === 1) {
            if (viewMode === 'sm') return { maxWidth: '250px' };
            if (viewMode === 'md') return { maxWidth: '400px' };
            if (viewMode === 'lg') return { maxWidth: '600px' };
        }
        return {};
    };

    const renderPhoto = ({ photo, imageProps, wrapperStyle, layout }: RenderPhotoProps<any>) => {
        // Safe Cast
        const asset = photo as unknown as Media;
        const isSelected = selectedIds.has(asset.id);
        const type = getMediaType(asset);

        const altText = asset.title || asset.caption || asset.originalName || "";
        
        // [ZEN] Check if the asset has a valid image thumbnail
        const hasRealThumbnail = asset.thumbnailUrls && 
            Object.keys(asset.thumbnailUrls).length > 0 &&
            Object.values(asset.thumbnailUrls).some(t => typeof t === 'string' && !t.endsWith('.mp4') && !t.endsWith('.mov') && !t.endsWith('.avi'));
        
        const imgSrc = hasRealThumbnail 
            ? (asset.thumbnailUrls?.medium || asset.thumbnailUrls?.small || asset.url || imageProps.src)
            : (type === 'image' ? (asset.url || imageProps.src) : undefined);

        const isWireframe = imgSrc === 'WIREFRAME_PLACEHOLDER';
        
        // Grab tag type ΓÇö tagIds is an array, use first tag as the primary
        const assetTag = tags.find(t => t.id === (asset.tagIds?.[0] || (asset as any).tagId));
        const tagType = assetTag ? assetTag.type : 'unknown';

        const rotation = (asset as any).rotation || 0;
        const isSideways = rotation === 90 || rotation === 270;

        // [ZEN] Optimistic Healing Trigger ΓÇö only runs if parent wired up the pipeline
        if (isWireframe && healMediaViolator && setMedia && !healingRef.current.has(asset.id)) {
            healingRef.current.add(asset.id);
            healMediaViolator(asset)
                .then((healedMedia) => {
                    console.log(`[MatrixGrid] ≡ƒÜö Beat Cop healed violator ${healedMedia.id}. Triggering optimistic render.`);
                    setMedia(prev => prev.map(m => m.id === healedMedia.id ? healedMedia : m));
                    healingRef.current.delete(asset.id);
                })
                .catch(err => {
                    console.error(`[MatrixGrid] Γ¥î Beat Cop failed on ${asset.id}:`, err);
                    healingRef.current.delete(asset.id);
                });
        }

        return (
            <div style={{ ...wrapperStyle, padding: 0 }} className="flex items-center justify-center relative">
                <div
                    className={`relative overflow-hidden rounded-lg bg-slate-900 transition-all duration-300 group w-full h-full ${isSelected ? 'ring-4 ring-cyan-500 scale-95 z-10' : ''}`}
                >
                    {/* Media Render */}
                    {type === 'image' || type === 'video' ? (
                        <div
                            className="relative w-full h-full"
                            onClick={(e) => {
                                if (isSelectionMode) {
                                    e.stopPropagation();
                                    onToggleSelection(asset.id);
                                } else {
                                    onMediaClick(asset);
                                }
                            }}
                        >
                            {/* [ZEN] Static placeholder to save CPU */}
                            <div className="absolute inset-0 bg-slate-800/50 pointer-events-none" />

                            {isWireframe ? (
                                <ParticleWireframe tagType={tagType} />
                            ) : type === 'video' && !imgSrc ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <video
                                        src={asset.url}
                                        preload="metadata"
                                        muted
                                        playsInline
                                        style={{ 
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            width: isSideways ? layout.height : '100%', 
                                            height: isSideways ? layout.width : '100%', 
                                            objectFit: 'cover',
                                            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                                            transformOrigin: 'center center'
                                        }}
                                        className="relative z-10"
                                    />
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <img
                                        {...imageProps}
                                        src={imgSrc || imageProps.src}
                                        alt={altText}
                                        loading="lazy"
                                        decoding="async"
                                        style={{ 
                                            ...imageProps.style, 
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            width: isSideways ? layout.height : '100%', 
                                            height: isSideways ? layout.width : '100%', 
                                            objectFit: 'cover',
                                            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                                            transformOrigin: 'center center'
                                        }}
                                        className={`transition-transform duration-500 relative z-10 ${!isSelectionMode ? 'hover:brightness-110 cursor-pointer' : 'cursor-pointer'}`}
                                    />
                                </div>
                            )}

                            {type === 'video' && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                    <div className="bg-black/50 rounded-full p-3 border border-white/20 backdrop-blur-sm shadow-lg group-hover:scale-110 transition-transform">
                                        <Play size={24} className="text-white fill-white ml-1" />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div
                            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors cursor-pointer border border-slate-700"
                            onClick={(e) => {
                                if (isSelectionMode) {
                                    e.stopPropagation();
                                    onToggleSelection(asset.id);
                                } else {
                                    onMediaClick(asset);
                                }
                            }}
                        >
                            {type === 'audio' && <Music size={48} className="mb-2 text-purple-500" />}
                            {type === 'pdf' && <FileText size={48} className="mb-2 text-red-500" />}
                            {type === 'unknown' && <File size={48} className="mb-2 text-slate-500" />}
                            <span className="text-[10px] uppercase tracking-widest font-bold opacity-70 px-2 text-center truncate w-full">{type}</span>
                        </div>
                    )}

                    {/* Selection & Edit Controls Overlay */}
                    <div className="absolute inset-0 pointer-events-none z-30">
                        {/* Selection Checkbox */}
                        <div
                            onClick={(e) => { e.stopPropagation(); onToggleSelection(asset.id); }}
                            className={`absolute top-2 left-2 pointer-events-auto cursor-pointer transition-all duration-200 ${isSelectionMode || isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                            {isSelected ?
                                <div className="bg-cyan-500 text-white rounded-full p-1 shadow-lg border border-cyan-400"><CheckCircle2 size={18} className="text-white" /></div> :
                                <div className="bg-black/40 hover:bg-black/60 text-white/70 hover:text-white rounded-full p-1 border-2 border-white/50 hover:border-white backdrop-blur-sm transition-all"><Circle size={18} /></div>
                            }
                        </div>

                        {/* Action Buttons */}
                        <div className="absolute bottom-2 right-2 flex items-center gap-2 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            {(type === 'image') && (
                                <GlassButton
                                    onClick={async (e) => { 
                                        e.stopPropagation(); 
                                        const currentRotation = (asset as any).rotation || 0;
                                        const newRotation = (currentRotation + 90) % 360;
                                        
                                        // Optimistic UI update
                                        const updatedAsset = { ...asset, rotation: newRotation } as Media;
                                        if (updateAsset) updateAsset(updatedAsset);
                                        else if (setMedia) {
                                            setMedia(prev => prev.map(m => m.id === asset.id ? updatedAsset : m));
                                        }
                                        
                                        // Background save
                                        try {
                                            const { appDataService } = await import('../../services/serviceManager');
                                            if (currentUserId) {
                                                await appDataService.saveMedia(currentUserId, { ...asset, rotation: newRotation } as Media);
                                                console.log(`[MatrixGrid] Manual rotation saved for ${asset.id}: ${newRotation}┬░`);
                                            } else {
                                                console.warn("[MatrixGrid] Missing currentUserId, cannot save rotation.");
                                            }
                                        } catch (err) {
                                            console.error("[MatrixGrid] Failed to save rotation:", err);
                                        }
                                    }}
                                    variant="ghost"
                                    className="h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-violet-500 hover:text-white border border-white/20"
                                    title="Rotate 90┬░ Clockwise"
                                >
                                    <RotateCw size={14} />
                                </GlassButton>
                            )}
                            <GlassButton
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setEditingDateAsset(asset);
                                }}
                                variant="ghost"
                                className="h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-emerald-500 hover:text-white border border-white/20"
                                title="Quick Edit Date"
                            >
                                <CalendarDays size={14} />
                            </GlassButton>
                            <GlassButton
                                onClick={(e) => { e.stopPropagation(); onEditAsset(asset); }}
                                variant="ghost"
                                className="h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-cyan-500 hover:text-white border border-white/20"
                                title="Edit metadata"
                            >
                                <Edit2 size={14} />
                            </GlassButton>
                        </div>

                        {/* [ZEN] Memorial Airlock Badge */}
                        {asset.contributionStatus && (
                            <div className={`absolute top-2 right-2 pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-lg border backdrop-blur-md shadow-xl text-[9px] font-black uppercase tracking-tighter transition-all group-hover:scale-105 ${
                                asset.contributionStatus === 'verified' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                                asset.contributionStatus === 'rejected' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                                'bg-amber-500/20 border-amber-500/50 text-amber-400'
                            }`} title={`Contributed by ${asset.contributorName || 'Anonymous'}`}>
                                {asset.contributionStatus === 'verified' ? <CheckCircle2 size={10} /> : <Archive size={10} />}
                                {asset.contributionStatus}
                            </div>
                        )}
                    </div>

                    {/* [ZEN EWO 006 & 008] Neural Glass Narrative Overlay & Editor **/}
                    {showNarratives && (type === 'image' || type === 'video') && (
                        <div className="absolute inset-0 z-40 flex flex-col justify-end pointer-events-none">
                            {/* Editor Mode */}
                            {editingNarrativeId === asset.id ? (
                                <div className="pointer-events-auto h-full">
                                    <NarrativeEditor
                                        asset={asset}
                                        userId={currentUserId}
                                        onClose={() => setEditingNarrativeId(null)}
                                    />
                                </div>
                            ) : (
                                /* Display Mode */
                                <>
                                    {/* Vibe Badge - Top Left */}
                                    {(asset as any).azureVibe && (
                                        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10 pointer-events-auto" title="Azure Vibe Metadata">
                                            {(asset as any).azureVibe.dominantEmotion === 'happiness' && <span>≡ƒÿè</span>}
                                            {(asset as any).azureVibe.dominantEmotion === 'surprise' && <span>≡ƒÿ«</span>}
                                            {(asset as any).azureVibe.dominantEmotion === 'sadness' && <span>≡ƒÿó</span>}
                                            {(asset as any).azureVibe.dominantEmotion === 'neutral' && <span>≡ƒÿÉ</span>}
                                            {!(asset as any).azureVibe.dominantEmotion && <span>≡ƒºá</span>}
                                            {(asset as any).azureVibe.smileScore !== undefined && (
                                                <span className="text-[9px] font-bold text-white/80">
                                                    {Math.round((asset as any).azureVibe.smileScore * 100)}%
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Narrative Teaser - Bottom (Click to Edit) */}
                                    {(asset as any).narrative ? (
                                        <div
                                            className="bg-gradient-to-t from-slate-900/95 via-slate-900/70 to-transparent backdrop-blur-[2px] p-3 transform transition-all duration-300 pointer-events-auto cursor-text hover:bg-slate-900/40"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingNarrativeId(asset.id);
                                            }}
                                            title="Click to Edit Narrative"
                                        >
                                            <p className="text-[11px] leading-relaxed text-slate-200/90 line-clamp-3 font-light">
                                                {(asset as any).narrative}
                                            </p>
                                        </div>
                                    ) : (asset as any).aiEnriched === false || !(asset as any).aiEnriched ? (
                                        <div className="bg-gradient-to-t from-slate-900/80 to-transparent p-2 flex items-center justify-center">
                                            <span className="text-[9px] uppercase tracking-widest text-slate-600 font-mono">
                                                ┬╖ Unprocessed ┬╖
                                            </span>
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                    )}

                    {/* [ZEN EWO 008] Identity HUD Overlay */}
                    {showIdentity && (type === 'image' || type === 'video') && (
                        <div className="absolute inset-0 z-20 pointer-events-none">
                            <FaceOverlay asset={asset} userId={currentUserId} />
                        </div>
                    )}

                    {isSelected && <div className="absolute inset-0 bg-cyan-900/20 pointer-events-none z-10" />}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-[1800px] mx-auto pb-20">
            {groupedAssets.map((group) => {
                const groupKey = `${group.title}-${group.assets.length}`;
                const groupId = `matrix-group-${group.dateKey}`;

                return (
                    <div key={groupKey} id={groupId} className="animate-in fade-in duration-500 scroll-mt-28 mb-8">
                        <div className="z-20 bg-[#0f1219] backdrop-blur-xl py-2 px-4 border-b border-white/10 flex items-baseline gap-3 sticky top-0 shadow-lg">
                            <h3 className="text-lg font-bold text-slate-200 tracking-wide">{group.title}</h3>
                            <span className="text-[10px] font-mono text-slate-500 bg-[#1a1d26] px-2 py-0.5 rounded-full border border-white/5">{group.assets.length}</span>
                        </div>
                        {/* [ZEN RESTORED] Application of the Singleton Constraint */}
                        <div className="pt-4 px-4" style={getContainerConstraint(group.assets.length)}>
                            <PhotoAlbum
                                layout="rows"
                                photos={group.assets.map(a => {
                                    const rot = (a as any).rotation || 0;
                                    const isSideways = rot === 90 || rot === 270;
                                    const baseW = a.width && a.width > 0 ? a.width : 800;
                                    const baseH = a.height && a.height > 0 ? a.height : 600;
                                    return {
                                        ...a,
                                        src: a.thumbnailUrls?.medium || a.thumbnailUrls?.small || a.url,
                                        width: isSideways ? baseH : baseW,
                                        height: isSideways ? baseW : baseH,
                                        key: `${a.id}-${rot}`
                                    };
                                })}
                                targetRowHeight={targetRowHeight}
                                renderPhoto={renderPhoto}
                                onClick={({ photo }) => {
                                    if (isSelectionMode) {
                                        onToggleSelection((photo as any).id);
                                    } else {
                                        onMediaClick(photo as unknown as Media);
                                    }
                                }}
                                spacing={12}
                            />
                        </div>
                    </div>
                );
            })}

            {editingDateAsset && (
                <QuickDateEditor 
                    assets={[editingDateAsset]} 
                    userId={currentUserId} 
                    onClose={() => setEditingDateAsset(null)} 
                    updateAsset={updateAsset} 
                    setMedia={setMedia} 
                />
            )}
        </div>
    );
};

export const MatrixGrid = memo(MatrixGridComponent);
