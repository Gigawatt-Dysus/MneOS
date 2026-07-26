import React, { memo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import PhotoAlbum, { RenderPhotoProps } from 'react-photo-album';
import { Circle, CheckCircle2, Film, Music, FileText, File, Play, Edit2, History, Sparkles, Zap, Archive, HelpCircle, RotateCw, CalendarDays, X, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { Media } from '../../types';
import { getMediaType } from './MatrixShared';
import { GlassButton } from '../GlassButton';
import { NarrativeEditor } from './NarrativeEditor';
import { FaceOverlay } from './FaceOverlay';
import { ParticleWireframe } from './ParticleWireframe';
import BorderGlow from '../shared/BorderGlow';
import { LightTable } from './LightTable';
import { QuickDateEditor } from './QuickDateEditor';
import { WikiText } from '../shared/WikiText';
// [ZEN SOVEREIGN] No Firebase imports. Tags/healing injected via props from TheMatrix parent.

interface MatrixGridProps {
    groupedAssets: { title: string; dateKey: number; assets: Media[] }[];
    viewMode: 'sm' | 'md' | 'lg' | 'dnd';
    isSelectionMode: boolean;
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    onToggleSelectionList?: (ids: string[]) => void;
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
    tags?: any[]; // Tag[] passed from parent — optional, defaults to []
    healMediaViolator?: (media: Media) => Promise<Media>;
    setMedia?: (updater: (prev: Media[]) => Media[]) => void;
    updateAsset?: (asset: Media) => void;
    onCiteAsset?: (asset: Media) => void;
    targetCollection?: string;
    isWallpaperMode?: boolean;
}



// [ZEN] The "Pulse" Skeleton to prevent main-thread freeze
const MatrixSkeleton: React.FC<{ viewMode: 'sm' | 'md' | 'lg' | 'dnd' }> = ({ viewMode }) => {
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

// [ZEN] Stylistic lookup for the Date Pills with Neon Hover Glow
const getPillStyle = (type?: string) => {
    switch (type) {
        case 'year':
            return { bg: 'bg-[#221061]/80 backdrop-blur-md', text: 'text-[#e2d5ff]', textGlow: '[text-shadow:0_0_6px_rgba(192,132,252,0.8)]' };
        case 'month':
            return { bg: 'bg-[#104361]/80 backdrop-blur-md', text: 'text-[#d5f4ff]', textGlow: '[text-shadow:0_0_6px_rgba(56,189,248,0.8)]' };
        case 'day':
            return { bg: 'bg-[#105861]/80 backdrop-blur-md', text: 'text-[#d5fffc]', textGlow: '[text-shadow:0_0_6px_rgba(45,212,191,0.8)]' };
        case 'shoebox':
            return { bg: 'bg-amber-900/80 backdrop-blur-md', text: 'text-amber-200', textGlow: '[text-shadow:0_0_6px_rgba(251,191,36,0.8)]' };
        default:
            return { bg: 'bg-slate-800/80 backdrop-blur-md', text: 'text-slate-300', textGlow: '[text-shadow:0_0_6px_rgba(148,163,184,0.8)]' };
    }
};

const MatrixGridComponent: React.FC<MatrixGridProps> = ({
    groupedAssets, viewMode, isSelectionMode, selectedIds, onToggleSelection, onToggleSelectionList, onMediaClick, onEditAsset, loading = false, showNarratives = false, showIdentity = false, userId, showShoebox = false, onToggleShoebox, healMediaViolator, setMedia, updateAsset, onCiteAsset, targetCollection, tags = [], isWallpaperMode = false
}) => {
    const queryClient = useQueryClient();
    // [ZEN EWO 008] Track which narrative is being edited inline
    const [editingNarrativeId, setEditingNarrativeId] = React.useState<string | null>(null);
    const [intrinsicDimensions, setIntrinsicDimensions] = React.useState<Record<string, { w: number, h: number }>>({});
    const [editingDateAsset, setEditingDateAsset] = React.useState<Media | null>(null);
    const [showFilenameId, setShowFilenameId] = React.useState<string | null>(null);
    const healingRef = React.useRef<Set<string>>(new Set());
    const [collapsedGroups, setCollapsedGroups] = React.useState<Set<number>>(new Set());
    const [pendingRotations, setPendingRotations] = React.useState<Set<string>>(new Set());
    const [showRotationMenu, setShowRotationMenu] = React.useState<string | null>(null);

    // Fallback userId — must be supplied via prop in the sovereign architecture
    const currentUserId = userId || '';

    // Vortex Engine 1D Array Generation
    const vortexItems = React.useMemo(() => {
        const items: any[] = [];
        let lastYear: number | null = null;

        groupedAssets.forEach(group => {
            const d = new Date(group.dateKey);
            const groupYear = d.getFullYear();
            
            // Determine pill text and type from the group title
            const pillText = group.title;
            let pillType = 'day';
            if (/^\d{4}$/.test(pillText)) pillType = 'year';
            else if (/^\d{2}\.\d{4}$/.test(pillText)) pillType = 'month';
            if (pillText === 'Sovereign Shoebox (Unsorted)') pillType = 'shoebox';

            let isYearBreak = false;
            if (pillType !== 'shoebox' && groupYear !== lastYear) {
                if (pillText !== `${groupYear}`) {
                    isYearBreak = true;
                }
                lastYear = groupYear;
            }

            if (collapsedGroups.has(group.dateKey)) {
                items.push({
                    id: `matrix-group-${group.dateKey}-collapsed`,
                    isCollapsedPill: true,
                    groupPillType: pillType,
                    groupPillText: pillText,
                    groupCount: group.assets.length,
                    dateKey: group.dateKey,
                    isYearBreak: isYearBreak,
                    yearText: groupYear
                });
            } else {
                group.assets.forEach((asset, index) => {
                    items.push({
                        ...asset,
                        isFirstInGroup: index === 0,
                        isYearBreak: index === 0 ? isYearBreak : false,
                        yearText: index === 0 ? groupYear : undefined,
                        groupPillType: index === 0 ? pillType : undefined,
                        groupPillText: index === 0 ? pillText : undefined,
                        dateKey: group.dateKey
                    });
                });
            }
        });
        return items;
    }, [groupedAssets, collapsedGroups]);

    // [ZEN FORENSIC FIX] Shield vortexItems against stale closures in 3rd-party callbacks
    const vortexItemsRef = React.useRef(vortexItems);
    React.useEffect(() => {
        vortexItemsRef.current = vortexItems;
    }, [vortexItems]);

    // [ZEN FORENSIC FIX] Shield onMediaClick against stale closures
    const onMediaClickRef = React.useRef(onMediaClick);
    React.useEffect(() => {
        onMediaClickRef.current = onMediaClick;
    }, [onMediaClick]);

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

    const handleForceRebake = async (assetId: string, forceAngle: 'auto' | number) => {
        setPendingRotations(prev => new Set(prev).add(assetId));
        setShowRotationMenu(null);
        try {
            const { httpsCallable } = await import('../../services/apiClient');
            
            // Invoke the Vercel API endpoint
            const rebake = httpsCallable(null, 'media/forceRebakeOrientation');
            const result = await rebake({ mediaId: assetId, forceAngle });
            console.log('[MatrixGrid] Pattern buffer successful:', result.data);
            
            // [ZEN] Dynamically inject the new physical dimensions back into the masonry layout
            // so the bounding box updates to portrait instead of staying landscape.
            const newWidth = result.data.width;
            const newHeight = result.data.height;
            const currentAsset = vortexItemsRef.current.find(a => a.id === assetId);
            
            if (currentAsset && newWidth && newHeight) {
                const ts = Date.now();
                const updatedAsset = {
                    ...currentAsset,
                    width: newWidth,
                    height: newHeight,
                    physicalWidth: newWidth,
                    physicalHeight: newHeight,
                    url: result.data.url || currentAsset.url,
                    thumbnailUrls: result.data.thumbnailUrls || currentAsset.thumbnailUrls
                };
                updateAsset?.(updatedAsset);
            }
            
            // Clear pending overlay after a brief delay to allow the new image to fetch
            setTimeout(() => {
                setPendingRotations(prev => {
                    const next = new Set(prev);
                    next.delete(assetId);
                    return next;
                });
            }, 1000);
            
        } catch (err) {
            console.error('[MatrixGrid] Pattern buffer error:', err);
            setPendingRotations(prev => {
                const next = new Set(prev);
                next.delete(assetId);
                return next;
            });
            alert('Failed to rebake orientation. Please try again or check console logs.');
        }
    };

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

    if (viewMode === 'dnd') {
        return (
            <div className="h-full w-full bg-slate-950/50 backdrop-blur-3xl rounded-xl overflow-hidden shadow-2xl border border-white/5 relative z-10 p-2">
                <LightTable 
                    vortexItems={vortexItems.filter(i => !i.isCollapsedPill)} 
                    userId={currentUserId} 
                    updateAsset={updateAsset} 
                    setMedia={setMedia} 
                />
            </div>
        );
    }

    const renderPhoto = ({ photo, imageProps, wrapperStyle, layout }: RenderPhotoProps<any>) => {
        // Safe Cast
        const uiAsset = photo as unknown as any;
        // [ZEN FORENSIC FIX] Retrieve the pure, unmutated asset from the source array. 
        // react-photo-album mutates the `photo` object (e.g., stripping title/alt, swapping w/h)
        // Passing the mutated object to updateAsset corrupts the local optimistic cache and DB!
        // We use the Ref to absolutely guarantee we never pull from a stale closure if the masonry engine caches this function
        const asset = vortexItemsRef.current.find(a => a.id === uiAsset.id) || uiAsset;

        if (asset.isCollapsedPill) {
            const gapWidth = layout.height * 0.06;
            const pillStyle = getPillStyle(asset.groupPillType);
            const mainFontSize = Math.max(12, layout.height * 0.07);
            const countFontSize = Math.max(9, mainFontSize * 0.65);
            return (
                <div style={{ ...wrapperStyle, padding: 0 }} className="flex justify-center items-stretch cursor-pointer hover:scale-95 transition-transform" onClick={() => {
                    setCollapsedGroups(prev => {
                        const next = new Set(prev);
                        next.delete(asset.dateKey);
                        return next;
                    });
                }}>
                    <div className={`h-full flex flex-col items-center justify-center rounded-lg border border-white/10 ${pillStyle.bg} shadow-lg shadow-black/50`} style={{ width: layout.width - gapWidth }}>
                        <span className={`font-black -rotate-90 whitespace-nowrap uppercase flex items-center gap-2 ${pillStyle.text} ${pillStyle.textGlow} tracking-[0.1em]`} style={{ fontSize: mainFontSize }}>
                            <span>{asset.groupPillText}</span>
                            <span className="font-mono tracking-normal px-1.5 py-0.5 rounded-sm bg-black/30 border border-white/10" style={{ fontSize: countFontSize }}>{asset.groupCount}</span>
                        </span>
                    </div>
                </div>
            );
        }

        const isSelected = selectedIds.has(asset.id);
        const type = getMediaType(asset as Media);
        
        // CRITICAL: Use correct dimensions for PhotoAlbum grid layout
        const intrinsic = intrinsicDimensions[asset.id];
        const baseW = intrinsic?.w || Number(asset.width) || 800;
        const baseH = intrinsic?.h || Number(asset.height) || 600;
        
        let logicalW = baseW;
        let logicalH = baseH;

        if (asset.forceLandscape) {
            logicalW = Math.max(baseW, baseH);
            logicalH = Math.min(baseW, baseH);
        }
        
        const isUntrusted = asset.aiModel === 'gemini-2.5-flash';
        const isGrokTest = asset.aiModel === 'grok-test' || asset.aiModel === 'grok-4.1-fast-test';
        const isGeminiTest = asset.aiModel === 'gemini-test';

        const altText = asset.title || asset.caption || asset.originalName || "";
        
        // [ZEN] Check if the asset has a valid image thumbnail
        const hasRealThumbnail = asset.thumbnailUrls && 
            Object.keys(asset.thumbnailUrls).length > 0 &&
            Object.values(asset.thumbnailUrls).some((t: any) => typeof t === 'string' && !t.endsWith('.mp4') && !t.endsWith('.mov') && !t.endsWith('.avi'));
        
        const imgSrc = hasRealThumbnail 
            ? (asset.thumbnailUrls?.medium || asset.thumbnailUrls?.small || asset.url || imageProps.src)
            : (type === 'image' ? (asset.url || imageProps.src) : undefined);

        const isWireframe = imgSrc === 'WIREFRAME_PLACEHOLDER';
        
        // Grab tag type — tagIds is an array, use first tag as the primary
        const assetTag = tags.find(t => t.id === (asset.tagIds?.[0] || asset.tagId));
        const tagType = assetTag ? assetTag.type : 'unknown';

        // [ZEN] Optimistic Healing Trigger
        if (isWireframe && healMediaViolator && setMedia && !healingRef.current.has(asset.id)) {
            healingRef.current.add(asset.id);
            healMediaViolator(asset as Media)
                .then((healedMedia) => {
                    console.log(`[MatrixGrid] 🚔 Beat Cop healed violator ${healedMedia.id}. Triggering optimistic render.`);
                    setMedia(prev => prev.map(m => m.id === healedMedia.id ? healedMedia : m));
                    healingRef.current.delete(asset.id);
                })
                .catch(err => {
                    console.error(`[MatrixGrid] ❌ Beat Cop failed on ${asset.id}:`, err);
                    healingRef.current.delete(asset.id);
                });
        }

        // tooltipText removed to prevent massive native tooltip block

        // Dynamic glow styling based on asset state
        const isCyan = isSelected;
        const isRed = isUntrusted && !isSelected;
        const isGreen = (isGrokTest || isGeminiTest) && !isSelected;
        
        let glowColor = '40 80 80'; // default neutral
        let borderColors = ['#c084fc', '#f472b6', '#38bdf8'];
        let intensity = 1.0;
        let ringClass = '';
        
        if (isCyan) {
            glowColor = '190 100 50';
            borderColors = ['#06b6d4', '#3b82f6', '#8b5cf6'];
            intensity = 2.0;
            ringClass = 'ring-2 ring-cyan-500 scale-95 z-10';
        } else if (isRed) {
            glowColor = '0 100 60';
            borderColors = ['#ef4444', '#f87171', '#fca5a5'];
            intensity = 1.5;
            ringClass = 'ring-1 ring-red-500/50';
        } else if (isGreen) {
            glowColor = '150 100 40';
            borderColors = ['#10b981', '#34d399', '#6ee7b7'];
            intensity = 1.5;
            ringClass = 'ring-1 ring-emerald-500/50';
        }

        const innerMediaContent = (
            <BorderGlow
                className={`relative group w-full h-full transition-all duration-300 ${ringClass}`}
                backgroundColor="#040b16"
                glowColor={glowColor}
                colors={borderColors}
                animated={false}
                glowRadius={isCyan ? 30 : 20}
                glowIntensity={intensity}
                borderRadius={8}
                fillOpacity={0}
            >
                <div className="absolute inset-[1px] bg-[#040b16]/50 rounded-lg overflow-hidden flex flex-col justify-center items-center z-10">
                    {/* Media Render */}
                    {type === 'image' || type === 'video' ? (
                        <div
                            className="relative w-full h-full"
                            onClick={(e) => {
                                // [ZEN FORENSIC] Stop propagation so the react-photo-album wrapper onClick doesn't fire with a stale photo object!
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // [ZEN FORENSIC STATE CHECK]
                                const thumbMed = asset.thumbnailUrls?.medium;
                                const mainUrl = asset.url;
                                const srcCollection = (asset as any)._collectionSource || 'unknown';
                                
                                console.log(`[ZEN] Forensic Click: Target ID ${uiAsset.id} -> Resolved ID ${asset.id}`);
                                console.log(`[ZEN] 🕵️ DATABASE STATE CHECK:`);
                                console.log(`      Collection Source: ${srcCollection}`);
                                console.log(`      Thumbnail URL: ${thumbMed ? thumbMed.substring(0, 80) + '...' : 'NONE'}`);
                                console.log(`      Main Media URL: ${mainUrl ? mainUrl.substring(0, 80) + '...' : 'NONE'}`);
                                
                                if (thumbMed && mainUrl && thumbMed !== mainUrl && !thumbMed.includes('thumb_')) {
                                    // [ZEN] Ignore perfectly valid Backblaze URLs that just have divergent timestamp tags from extraction
                                    const isB2Mismatch = thumbMed.includes('f005.backblazeb2.com') && mainUrl.includes('f005.backblazeb2.com');
                                    if (!isB2Mismatch) {
                                        console.warn(`[ZEN WARNING] Thumbnail URL does not match Main URL! This may be database corruption!`);
                                    }
                                }
                                
                                if (isSelectionMode) {
                                    onToggleSelection(asset.id);
                                } else {
                                    onMediaClick(asset);
                                }
                            }}
                        >
                            {/* [ZEN] Static placeholder to save CPU */}
                            <div className="absolute inset-0 bg-transparent pointer-events-none" />

                            {/* [ZEN] FORENSIC Diagnostic Overlay (Removed per user request) */}

                            {isWireframe ? (
                                <ParticleWireframe tagType={tagType} />
                            ) : (
                                <div className="absolute inset-0 z-10">
                                    <img
                                        src={imgSrc || imageProps.src}
                                        alt={altText}
                                        loading="lazy"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        className={`${!isSelectionMode ? 'hover:brightness-110 cursor-pointer' : 'cursor-pointer'}`}
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
                            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800/40 backdrop-blur-sm text-slate-300 hover:bg-slate-700/60 transition-colors cursor-pointer border border-white/10"
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


                    {/* [ZEN EWO 006 & 008] Neural Glass Narrative Overlay & Editor **/}
                    {(type === 'image' || type === 'video') && (
                        <div className={`absolute inset-0 z-40 flex flex-col justify-end pointer-events-none transition-opacity duration-300 ${showNarratives ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
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
                                    {/* Debug Overlays Excised */}
                                    
                                    {/* Vibe Badge */}
                                    {(asset as any).azureVibe && (
                                        <div className="absolute top-14 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10 pointer-events-auto" title="Azure Vibe Metadata">
                                            {(asset as any).azureVibe.dominantEmotion === 'happiness' && <span>😊</span>}
                                            {(asset as any).azureVibe.dominantEmotion === 'surprise' && <span>😮</span>}
                                            {(asset as any).azureVibe.dominantEmotion === 'sadness' && <span>😢</span>}
                                            {(asset as any).azureVibe.dominantEmotion === 'neutral' && <span>😐</span>}
                                            {!(asset as any).azureVibe.dominantEmotion && <span>🧠</span>}
                                            {(asset as any).azureVibe.smileScore !== undefined && (
                                                <span className="text-[9px] font-bold text-white/80">
                                                    {Math.round((asset as any).azureVibe.smileScore * 100)}%
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Narrative Teaser - Bottom (Click to Edit) */}
                                    <div
                                        className={`bg-gradient-to-t from-slate-900/95 via-slate-900/70 to-transparent backdrop-blur-[2px] py-3 pr-3 ${asset.isFirstInGroup ? 'pl-10' : 'pl-3'} transform transition-all duration-300 pointer-events-auto cursor-text hover:bg-slate-900/40`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingNarrativeId(asset.id);
                                        }}
                                    >
                                        {((asset as any).narrative || asset.description || asset.caption) ? (
                                            <div className="text-[11px] leading-relaxed text-slate-200/90 line-clamp-3 font-light">
                                                <WikiText text={(asset as any).narrative || asset.description || asset.caption} />
                                            </div>
                                        ) : (
                                            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-mono italic">
                                                No description at present
                                            </span>
                                        )}
                                    </div>
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

                    {/* Filename Debug Overlay */}
                    {showFilenameId === asset.id && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-cyan-500/50 shadow-2xl z-50 pointer-events-none flex flex-col items-center whitespace-nowrap">
                            <span className="text-cyan-400 font-mono text-[10px] uppercase tracking-wider font-bold">Forensic Data</span>
                            <span className="text-white font-mono text-[11px] mt-0.5 max-w-[250px] truncate" title={asset.originalName || 'Unknown'}>{asset.originalName || 'Unknown'}</span>
                            <div className="flex gap-3 mt-1 w-full justify-between">
                                <span className="text-amber-400 font-mono text-[10px]">Rot: {asset.rotation ?? 'null'}</span>
                                <span className={`font-mono text-[10px] ${asset.thumbnail_metadata_healed ? 'text-emerald-400' : 'text-red-400'}`}>
                                    Healed: {asset.thumbnail_metadata_healed ? 'Yes' : 'No'}
                                </span>
                            </div>
                        </div>
                    )}

                    {isSelected && <div className="absolute inset-0 bg-cyan-900/20 pointer-events-none z-10" />}
                </div>
            </BorderGlow>
        );

        return (
            <div 
                style={{ ...wrapperStyle, display: 'flex', padding: 0, overflow: 'visible', contentVisibility: 'auto', containIntrinsicSize: `${wrapperStyle.width}px ${wrapperStyle.height}px` } as React.CSSProperties} 
                className="items-center justify-end relative"
            >
                {/* Synthetic Date Pill (Horizontal or Vertical) */}
                {asset.isFirstInGroup && (
                    <div className="absolute top-0 left-0 bottom-0 flex flex-col z-20 pointer-events-none" style={{ width: layout.height * 0.08 }}>
                        {asset.isYearBreak && asset.yearText && (
                            <div className="bg-[#221061]/90 backdrop-blur-md rounded-lg border border-purple-500/30 text-[#e2d5ff] font-bold text-[12px] uppercase antialiased [text-rendering:optimizeLegibility] tracking-widest px-1.5 py-4 mb-2 shadow-[0_0_15px_rgba(192,132,252,0.4)] flex items-center justify-center w-full" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg) translateZ(0)', WebkitFontSmoothing: 'antialiased' }}>
                                {asset.yearText}
                            </div>
                        )}
                        <div className="relative flex-1 flex flex-col w-full h-full group/pill">
                            <div 
                                className={`w-full h-full rounded-lg border border-white/10 font-semibold text-[12px] antialiased [text-rendering:optimizeLegibility] tracking-wider px-1.5 py-3 shadow-lg flex flex-col items-center justify-center pointer-events-auto cursor-pointer transition-all hover:scale-[1.02] hover:brightness-125 ${getPillStyle(asset.groupPillType).bg} ${getPillStyle(asset.groupPillType).text} ${getPillStyle(asset.groupPillType).textGlow}`}
                                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg) translateZ(0)', WebkitFontSmoothing: 'antialiased' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onToggleSelectionList) {
                                        const group = groupedAssets.find(g => g.dateKey === asset.dateKey);
                                        if (group) onToggleSelectionList(group.assets.map(a => a.id));
                                    }
                                }}
                                title="Select entire group"
                            >
                                <span className="whitespace-nowrap uppercase">{asset.groupPillText}</span>
                            </div>
                            <div 
                                className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 hover:bg-black/90 rounded-md p-1 cursor-pointer opacity-0 group-hover/pill:opacity-100 transition-opacity z-30 pointer-events-auto shadow-md border border-white/10 backdrop-blur-md"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCollapsedGroups(prev => {
                                        const next = new Set(prev);
                                        next.add(asset.dateKey);
                                        return next;
                                    });
                                }}
                                title="Collapse group"
                            >
                                <X size={12} className="text-white" />
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="relative group/card w-full h-full" style={{ width: asset.isFirstInGroup ? `calc(100% - ${layout.height * 0.1}px)` : '100%', height: '100%', position: 'relative' }}>
                    {innerMediaContent}
                    
                    {/* [ZEN] SFE Transporter Buffer Overlay */}
                    {pendingRotations.has(asset.id) && (
                        <div className="absolute inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg pointer-events-none">
                            <img src="/assets/SFE_overlay.svg" alt="Engineering Division" className="w-16 h-16 opacity-50 animate-pulse" />
                            <span className="text-[10px] uppercase tracking-widest font-bold text-cyan-400 mt-2 animate-pulse">Pending Pattern Buffer</span>
                        </div>
                    )}
                    {/* Selection & Edit Controls Overlay */}
                    <div className="absolute inset-0 pointer-events-none z-50">
                        {/* Selection Checkbox */}
                        <div
                            onClick={(e) => { e.stopPropagation(); onToggleSelection(asset.id); }}
                            className={`absolute top-2 ${asset.isFirstInGroup ? 'left-10' : 'left-2'} pointer-events-auto cursor-pointer transition-all duration-200 ${isSelectionMode || isSelected ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'}`}
                        >
                            {isSelected ?
                                <div className="bg-cyan-500 text-white rounded-full p-1 shadow-lg border border-cyan-400"><CheckCircle2 size={18} className="text-white" /></div> :
                                <div className="bg-black/40 hover:bg-black/60 text-white/70 hover:text-white rounded-full p-1 border-2 border-white/50 hover:border-white backdrop-blur-sm transition-all"><Circle size={18} /></div>
                            }
                        </div>

                        {/* Action Drawer (Progressive Disclosure) */}
                        <div className="absolute top-2 right-2 flex flex-col items-end pointer-events-auto opacity-0 group-hover/card:opacity-100 transition-opacity z-50 group/drawer">
                            {/* Trigger Node */}
                            <div className="relative z-10 bg-black/50 backdrop-blur-md rounded-full border border-white/20 p-2 cursor-pointer hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-colors shadow-lg shadow-black/50">
                                <Zap size={14} className="text-cyan-400 group-hover/drawer:text-cyan-300 transition-colors" />
                            </div>

                            {/* Payload Node */}
                            <div className="absolute top-full mt-2 right-0 flex flex-col items-center gap-2 opacity-0 invisible group-hover/drawer:opacity-100 group-hover/drawer:visible transition-all duration-300 origin-top -translate-y-2 group-hover/drawer:translate-y-0">

                                <GlassButton
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setEditingDateAsset(asset);
                                    }}
                                    variant="ghost"
                                    className="h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-emerald-500 hover:text-white border border-white/20 shadow-lg"
                                    title="Quick Edit Date"
                                >
                                    <CalendarDays size={14} />
                                </GlassButton>
                                
                                {/* [ZEN] Citation Pad Trigger */}
                                {onCiteAsset && (
                                    <GlassButton
                                        onClick={(e) => { e.stopPropagation(); onCiteAsset(asset); }}
                                        variant="ghost"
                                        className="h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-rose-500 hover:text-white border border-rose-500/30 text-rose-400 shadow-lg"
                                        title="Issue Forensic Citation (Audit Hallucinations)"
                                    >
                                        <ShieldAlert size={14} />
                                    </GlassButton>
                                )}

                                <GlassButton
                                    onClick={(e) => { e.stopPropagation(); onEditAsset(asset); }}
                                    variant="ghost"
                                    className="h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-cyan-500 hover:text-white border border-white/20 shadow-lg"
                                    title="Edit metadata"
                                >
                                    <Edit2 size={14} />
                                </GlassButton>

                                <div className="relative group/rotatemenu">
                                    <GlassButton
                                        onClick={(e) => { e.stopPropagation(); setShowRotationMenu(prev => prev === asset.id ? null : asset.id); }}
                                        variant="ghost"
                                        className="h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-amber-500 hover:text-white border border-amber-500/30 text-amber-400 shadow-lg"
                                        title="Forensic Heal (Transporter Buffer)"
                                    >
                                        <RotateCw size={14} />
                                    </GlassButton>
                                    {showRotationMenu === asset.id && (
                                        <div className="absolute top-0 right-full mr-2 bg-slate-900 border border-amber-500/50 rounded-lg p-2 flex flex-col gap-1 shadow-2xl z-50 pointer-events-auto w-32">
                                            <div className="text-[9px] uppercase text-amber-400 font-black mb-1 border-b border-amber-500/20 pb-1 text-center tracking-widest">Rotation Vector</div>
                                            <button onClick={(e) => { e.stopPropagation(); handleForceRebake(asset.id, 'auto'); }} className="text-xs hover:bg-amber-500/20 text-white rounded px-2 py-1 text-left font-mono">Auto</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleForceRebake(asset.id, 90); }} className="text-xs hover:bg-amber-500/20 text-white rounded px-2 py-1 text-left font-mono">90° CW</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleForceRebake(asset.id, 180); }} className="text-xs hover:bg-amber-500/20 text-white rounded px-2 py-1 text-left font-mono">180° CW</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleForceRebake(asset.id, 270); }} className="text-xs hover:bg-amber-500/20 text-white rounded px-2 py-1 text-left font-mono">270° CW</button>
                                        </div>
                                    )}
                                </div>

                                <GlassButton
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setShowFilenameId(prev => prev === asset.id ? null : asset.id);
                                    }}
                                    variant="ghost"
                                    className="h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-fuchsia-500 hover:text-white border border-fuchsia-500/30 text-fuchsia-400 shadow-lg"
                                    title="Debug: Show File Details"
                                >
                                    <FileText size={14} />
                                </GlassButton>
                            </div>
                        </div>

                        {/* [ZEN] Memorial Airlock Badge */}
                        {asset.contributionStatus && (
                            <div className={`absolute top-10 ${asset.isFirstInGroup ? 'left-10' : 'left-2'} pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-lg border backdrop-blur-md shadow-xl text-[9px] font-black uppercase tracking-tighter transition-all group-hover/card:scale-105 ${
                                asset.contributionStatus === 'verified' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                                asset.contributionStatus === 'rejected' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                                'bg-amber-500/20 border-amber-500/50 text-amber-400'
                            }`} title={`Contributed by ${asset.contributorName || 'Anonymous'}`}>
                                {asset.contributionStatus === 'verified' ? <CheckCircle2 size={10} /> : <Archive size={10} />}
                                {asset.contributionStatus}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className={`${isWallpaperMode ? 'w-full px-4 pt-4' : 'max-w-[1800px] mx-auto pt-20'} pb-20`}>
            <PhotoAlbum
                layout="rows"
                photos={vortexItems.map((a, mapIndex) => {
                    if (a.isCollapsedPill) {
                        return {
                            ...a,
                            _vortexIndex: mapIndex,
                            src: '', // No image for synthetic pills
                            width: 80, // Narrow vertical pill width
                            height: targetRowHeight,
                            key: a.id
                        };
                    }

                    const intrinsic = intrinsicDimensions[a.id];
                    const baseW = intrinsic?.w || Number(a.width) || 800;
                    const baseH = intrinsic?.h || Number(a.height) || 600;
                    
                    let logicalW = baseW;
                    let logicalH = baseH;
                    
                    if (a.forceLandscape) {
                        logicalW = Math.max(baseW, baseH);
                        logicalH = Math.min(baseW, baseH);
                    }

                    // Add synthetic width for horizontal DatePills so the row accommodates them natively
                    if (a.isFirstInGroup) {
                        logicalW += logicalH * 0.1; 
                    }

                    return {
                        ...a,
                        _vortexIndex: mapIndex,
                        title: undefined,
                        alt: undefined,
                        src: a.thumbnailUrls?.medium || a.thumbnailUrls?.small || a.url,
                        width: logicalW,
                        height: logicalH,
                        key: `${a.id}_${mapIndex}`
                    };
                })}
                targetRowHeight={targetRowHeight}
                renderPhoto={renderPhoto}
                onClick={({ photo, index, event }) => {
                    event.stopPropagation();
                    const a = photo as any;
                    if (a.isCollapsedPill) return; // Prevent full screen open for collapsed pills
                    if (isSelectionMode) {
                        onToggleSelection(a.id);
                    } else {
                        // [ZEN FORENSIC FIX] Use the original, unmutated asset mapped strictly by index from the Ref.
                        // NEVER use vortexItems[index] here because react-photo-album closures can become stale during layout shifts (e.g. rotation)!
                        const realAsset = vortexItemsRef.current[a._vortexIndex] || vortexItemsRef.current.find(item => item.id === a.id) || photo as unknown as Media;
                        
                        // [ZEN FORENSIC STATE CHECK]
                        const thumbMed = realAsset.thumbnailUrls?.medium;
                        const mainUrl = realAsset.url;
                        const srcCollection = (realAsset as any)._collectionSource || 'unknown';
                        
                        console.log(`[ZEN] Forensic Click: Target ID ${a.id} -> Resolved ID ${realAsset.id}`);
                        console.log(`[ZEN] 🕵️ DATABASE STATE CHECK:`);
                        console.log(`      Collection Source: ${srcCollection}`);
                        console.log(`      Thumbnail URL: ${thumbMed ? thumbMed.substring(0, 80) + '...' : 'NONE'}`);
                        console.log(`      Main Media URL: ${mainUrl ? mainUrl.substring(0, 80) + '...' : 'NONE'}`);
                        
                        if (thumbMed && mainUrl && thumbMed !== mainUrl && !thumbMed.includes('thumb_')) {
                            // [ZEN] Ignore perfectly valid Backblaze URLs that just have divergent timestamp tags from extraction
                            const isB2Mismatch = thumbMed.includes('f005.backblazeb2.com') && mainUrl.includes('f005.backblazeb2.com');
                            if (!isB2Mismatch) {
                                console.warn(`[ZEN WARNING] Thumbnail URL does not match Main URL! This may be database corruption!`);
                            }
                        }

                        onMediaClickRef.current(realAsset);
                    }
                }}
                spacing={12}
            />

            {editingDateAsset && (
                <QuickDateEditor 
                    assets={[editingDateAsset]} 
                    userId={currentUserId} 
                    targetCollection={targetCollection}
                    onClose={() => setEditingDateAsset(null)} 
                    updateAsset={updateAsset} 
                    setMedia={setMedia} 
                />
            )}
        </div>
    );
};

export const MatrixGrid = memo(MatrixGridComponent);