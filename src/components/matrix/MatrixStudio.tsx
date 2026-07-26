import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Trash2, AlertTriangle, Wand2, Info, ChevronDown, Edit2, Check, CalendarDays, Archive, ShieldAlert, Brain, RotateCw, Camera, Focus, Sparkles
} from 'lucide-react';
import type { Media, User, Tag } from '../../types';
import { DeepDiveIcon } from '../icons/CustomIcons';
import { getMediaType } from './MatrixShared';
import { GigiCoreIcon } from '../icons/GigiCoreIcon';
import { MediaStudioModal } from '../media/MediaStudioModal';
import { formatLifeOSDate } from '../../utils/dateSanitizer';
import { getPolishFilter } from '../../utils/mediaUtils';
import { doc, updateDoc } from '../../services/sovereignDbAdapter';
import { db } from '../../firebaseConfig';
import { httpsCallable } from '../../services/apiClient';
import { typesenseService } from '../../services/typesenseService';
import { WikiText } from '../shared/WikiText';
import { WikiTagEditor } from '../shared/WikiTagEditor';
import { QuickDateEditor } from './QuickDateEditor';
import { InlineCaptionEditor } from './InlineCaptionEditor';
import { PrivacyShutter } from './PrivacyShutter';
import { TooltipButton } from './TooltipButton';
import { AI_TriageModal } from '../TakeoutAirlock/AI_TriageModal';
import { ForensicVisualTagger, BoundingBox } from './ForensicVisualTagger';
import { MuseReimagineModal } from './MuseReimagineModal';

interface MatrixStudioProps {
    currentAssetId: string;
    setCurrentAssetId: (id: string) => void;
    assets: Media[];
    user: User;
    onClose: () => void;
    onDeepDive: (media: Media) => void;
    onDiscuss: (media: Media) => void;
    onCiteAsset?: (media: Media) => void;
    allTags: Tag[];
    onUpdateAsset: (asset: Media) => void;
    onDeleteMedia: (id: string) => Promise<void>;
    onNavigateToTag?: (id: string) => void;
    onTagCreated?: (tag: Tag) => void;
    autoEdit?: boolean;
    tetheredAnomalyId?: string | null;
    targetCollection?: string;
}


export const MatrixViewer: React.FC<MatrixStudioProps> = ({
    currentAssetId, setCurrentAssetId, assets, user, onClose, onDeepDive, onDiscuss, onCiteAsset, allTags, onUpdateAsset,
    onDeleteMedia, onTagCreated, autoEdit, tetheredAnomalyId, targetCollection
}) => {
    const currentIndex = useMemo(() => assets.findIndex(a => a.id === currentAssetId), [assets, currentAssetId]);
    const currentAsset = useMemo(() => assets[currentIndex] || assets.find(a => a.id === currentAssetId), [assets, currentIndex, currentAssetId]);
    
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditing, setIsEditing] = useState(autoEdit || false);
    const [isEditingDate, setIsEditingDate] = useState(false);
    const [showAITriage, setShowAITriage] = useState(false);
    const [isVisualTagging, setIsVisualTagging] = useState(false);
    const [showRotationMenu, setShowRotationMenu] = useState(false);
    const [isRebaking, setIsRebaking] = useState(false);
    const [showMuseReimagine, setShowMuseReimagine] = useState(false);

    // [ZEN] Traceability Logging
    useEffect(() => {
        if (currentAssetId) {
            console.log(`[MatrixStudio] Mounted/Updated with currentAssetId: ${currentAssetId}`);
            console.log(`[MatrixStudio] assets array length: ${assets.length}`);
            console.log(`[MatrixStudio] currentIndex found: ${currentIndex}`);
            if (currentIndex !== -1 && assets[currentIndex]) {
                const a = assets[currentIndex];
                console.log(`[MatrixStudio] 🕵️ Asset Collection Source: ${(a as any)._collectionSource || 'unknown'}`);
            }
            if (currentIndex === -1) {
                console.warn(`[MatrixStudio] FATAL POINTER DESYNC: currentAssetId ${currentAssetId} NOT FOUND in assets array!`);
            }
        }
    }, [currentAssetId, assets.length, currentIndex]);

    // [ZEN] Auto-Reconciliation: Only jump if we have a valid last known index AND the current asset is genuinely gone
    const lastKnownIndexRef = useRef(0);
    useEffect(() => {
        if (currentIndex !== -1) {
            lastKnownIndexRef.current = currentIndex;
        }
    }, [currentIndex]);

    // [ZEN FIX] Ensure we don't prematurely jump indexes during optimistic updates or initial hydration
    useEffect(() => {
        // If we can't find the asset, but we HAVE assets, and it's NOT the initial render mount race
        if (currentIndex === -1 && assets.length > 0 && currentAssetId) {
            console.warn(`[MatrixStudio] Asset ${currentAssetId} vanished from view. Reconciling to nearest neighbor...`);
            const nextIndex = Math.min(lastKnownIndexRef.current, assets.length - 1);
            if (assets[nextIndex]) {
                setCurrentAssetId(assets[nextIndex].id);
            }
        } else if (currentIndex === -1 && assets.length === 0 && currentAssetId) {
            // Only auto-close if the list is completely empty AND we had an active ID
            console.warn(`[MatrixStudio] Assets list emptied. Closing viewer.`);
            onClose();
        }
    }, [currentIndex, assets, currentAssetId, setCurrentAssetId, onClose]);

    if (!currentAsset) {
        return null; // Handle optimistic delete or index out of bounds gracefully
    }

    // [ZEN] Reset state when asset changes (e.g. after optimistic delete)
    useEffect(() => {
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        setIsVisualTagging(false);
    }, [currentAsset?.id]);

    const primaryCompanion = user?.aiCompanions?.find(c => c.isPrimary) || user?.aiCompanions?.[0];
    const primaryCompanionName = primaryCompanion?.name || 'AI';

    const [renderedUrl, setRenderedUrl] = useState(currentAsset.url || '');
    const [renderedAsset, setRenderedAsset] = useState<Media>(currentAsset);

    // [ZEN FIX] Derive rendered state explicitly from the active currentAsset prop
    useEffect(() => {
        setRenderedUrl(currentAsset.url || '');
        setRenderedAsset(currentAsset);
    }, [
        currentAsset.id, 
        currentAsset.url, 
        currentAsset.polishLayers, 
        (currentAsset as any).adjustmentStack, 
        (currentAsset as any).preset,
        currentAsset.rotation
    ]);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.target as HTMLImageElement;
        if (currentAsset) {
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            const dbW = Number(currentAsset.width) || nw;
            const dbH = Number(currentAsset.height) || nh;
            
            // Check if aspect ratio logic is inverted between DB and native loaded pixels.
            // If the DB says it's landscape (W > H) but the browser loaded it as portrait (nw < nh),
            // it means the browser natively applied an EXIF rotation tag (usually Orientation: 6).
            const dbIsWide = dbW >= dbH;
            const nativeIsWide = nw >= nh;
            
            setNativeRotated(dbIsWide !== nativeIsWide);
            setRenderedUrl(currentAsset.url);
            setRenderedAsset(currentAsset);
        }
    };
    
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const [nativeRotated, setNativeRotated] = useState(false);

    useEffect(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setNativeRotated(false);
    }, [currentAssetId]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showAITriage || isEditing || showDeleteConfirm || isEditingDate) return;
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentAssetId, assets.length, onClose, isEditing, showAITriage, showDeleteConfirm, isEditingDate]);

    const nextSlide = () => { 
        if (isEditing || currentIndex === -1) return;
        const nextIdx = currentIndex < assets.length - 1 ? currentIndex + 1 : 0;
        setCurrentAssetId(assets[nextIdx].id); 
    };
    const prevSlide = () => { 
        if (isEditing || currentIndex === -1) return;
        const prevIdx = currentIndex > 0 ? currentIndex - 1 : assets.length - 1;
        setCurrentAssetId(assets[prevIdx].id); 
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY * -0.002;
        const newScale = Math.min(Math.max(1, scale + delta), 5); 
        setScale(newScale);
        if (newScale === 1) setPosition({ x: 0, y: 0 }); 
    };

    const zoomIn = () => setScale(s => Math.min(s + 0.5, 5));
    const zoomOut = () => {
        setScale(s => {
            const next = Math.max(1, s - 0.5);
            if (next === 1) setPosition({ x: 0, y: 0 });
            return next;
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            e.preventDefault();
            setIsDragging(true);
            dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) {
            e.preventDefault();
            setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    const type = getMediaType(currentAsset);
    const rawRotation = Number((currentAsset as any)?.rotation) || 0;
    let baseCssRotation = rawRotation;
    if (rawRotation === 6) baseCssRotation = 90;
    else if (rawRotation === 8) baseCssRotation = 270;
    else if (rawRotation === 3) baseCssRotation = 180;
    else if (rawRotation === 1) baseCssRotation = 0;

    // Compensate for native EXIF rotation applied by the browser.
    // If the browser natively rotated the image 90 degrees CW (EXIF 6), 
    // we subtract 90 degrees from our target CSS rotation to prevent double-rotation.
    const cssRotation = nativeRotated ? (baseCssRotation - 90 + 360) % 360 : baseCssRotation;

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await onDeleteMedia(currentAsset.id);
            setShowDeleteConfirm(false);
            onClose(); 
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Delete failed. Please try again.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleForceRebake = async (degrees: number | 'auto') => {
        setIsRebaking(true);
        setShowRotationMenu(false);
        try {
            const rebake = httpsCallable(null, 'media/forceRebakeOrientation');
            const targetCollection = (currentAsset as any)._collectionSource || 'media';
            
            console.log(`[MatrixStudio] Firing Transporter Buffer for ${currentAsset.id} (${degrees} deg) on ${targetCollection}`);
            
            const result = await rebake({ 
                mediaId: currentAsset.id, 
                forceAngle: degrees 
            });
            
            console.log('[MatrixStudio] Transporter buffer locked.', result);

            // [ZEN] Dynamically inject the new physical dimensions back into the local state
            const newWidth = result.data.width;
            const newHeight = result.data.height;
            
            if (newWidth && newHeight) {
                const updatedAsset = {
                    ...currentAsset,
                    width: newWidth,
                    height: newHeight,
                    physicalWidth: newWidth,
                    physicalHeight: newHeight,
                    url: result.data.url || currentAsset.url,
                    thumbnailUrls: result.data.thumbnailUrls || currentAsset.thumbnailUrls,
                    rotation: 0,
                    orientation: 1,
                    thumbnail_metadata_healed: true
                };
                onUpdateAsset(updatedAsset);
            }

            // Small delay to allow the busted URL to load before hiding the overlay
            setTimeout(() => {
                setIsRebaking(false);
            }, 1000);
            
        } catch (error) {
            console.error("[MatrixStudio] Transporter buffer alignment failed:", error);
            alert("Buffer alignment failed! Check console.");
            setIsRebaking(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[50] bg-[#050505] flex font-sans overflow-hidden">
            
            <div className="flex-1 flex flex-col h-full relative min-w-0">
                
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-slate-900/40" />
                    <img 
                        src={renderedUrl} 
                        className="w-full h-full object-cover opacity-60 blur-[100px] saturate-200" 
                        alt="Ambient"
                        style={{ 
                            filter: getPolishFilter(renderedAsset),
                            transform: cssRotation ? `scale(2.5) rotate(${cssRotation}deg)` : 'scale(1.5)',
                            transformOrigin: 'center center'
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
                </div>

                <div className="h-20 flex items-center justify-between px-8 z-50">
                    <div className="flex flex-col drop-shadow-lg min-w-0 flex-1 mr-4">
                        <span 
                            className="text-lg font-bold text-white truncate max-w-xl lg:max-w-3xl tracking-tight shadow-black drop-shadow-md block"
                            title={currentAsset?.title || currentAsset?.originalName || ''}
                        >
                            <WikiText text={currentAsset?.title || currentAsset?.originalName || ''} className="!whitespace-nowrap !leading-none" />
                        </span>
                        <span className="flex items-center gap-2 text-xs text-cyan-200 font-mono tracking-wider opacity-90 uppercase drop-shadow-sm mt-0.5">
                            {currentAsset?.logicalDate 
                                ? formatLifeOSDate(currentAsset.logicalDate, currentAsset.datePrecision) 
                                : (currentAsset.uploadDate ? formatLifeOSDate(currentAsset.uploadDate, 'exact') : 'UNASSIGNED')}
                            
                            {/* [ZEN FORENSIC] Show Collection Source to prove what DB is actively loaded */}
                            {(currentAsset as any)._collectionSource && (
                                <span className="ml-2 px-1.5 py-0.5 rounded-sm bg-fuchsia-900/50 text-fuchsia-300 border border-fuchsia-500/30 text-[9px] font-black">
                                    {(currentAsset as any)._collectionSource}
                                </span>
                            )}
                            
                            <button 
                                onClick={() => setIsEditingDate(true)}
                                className="p-1 rounded-md hover:bg-cyan-500/20 text-cyan-400/50 hover:text-cyan-300 transition-colors"
                                title="Edit Date"
                            >
                                <CalendarDays size={12} />
                            </button>
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-black/30 backdrop-blur-md rounded-full px-2 py-1 border border-white/10 shadow-lg">
                            <button onClick={zoomOut} className="p-2 hover:text-white text-slate-300 transition-colors"><ZoomOut size={18}/></button>
                            <span className="text-xs font-mono w-12 text-center text-slate-200 select-none">{Math.round(scale * 100)}%</span>
                            <button onClick={zoomIn} className="p-2 hover:text-white text-slate-300 transition-colors"><ZoomIn size={18}/></button>
                        </div>

                        <div className="group relative">
                            <button 
                                onClick={onClose} 
                                className="p-3 bg-red-500/10 hover:bg-red-500/80 text-red-400 hover:text-white rounded-full transition-all duration-300 backdrop-blur-md border border-red-500/30 hover:border-red-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.6)]"
                            >
                                <X size={32} strokeWidth={2.5} />
                            </button>
                            <div className="absolute top-full right-0 mt-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] flex flex-col items-end">
                                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-black/90 mr-4"></div>
                                <div className="bg-black/90 backdrop-blur-xl border border-white/20 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest text-white shadow-2xl uppercase whitespace-nowrap">
                                    Exit to Composer
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div 
                    className={`flex-1 relative w-full h-full overflow-hidden grid grid-rows-1 ${isVisualTagging ? 'grid-cols-1' : 'grid-cols-[minmax(340px,1fr)_auto_minmax(340px,1fr)]'} items-center z-10 transition-all duration-500`}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                >
                    {/* Left Panel - Grid Column 1 */}
                    {!isVisualTagging && (
                        <div className="w-full h-full max-h-[80vh] flex flex-col gap-4 z-50 pointer-events-auto transition-opacity duration-300 overflow-y-auto px-8 pt-20 min-w-0">
                            <div className="ml-auto w-full max-w-md">
                                <InlineCaptionEditor 
                                    asset={currentAsset} 
                                    onCiteAsset={onCiteAsset}
                                    onOpenAITriage={() => setShowAITriage(true)}
                                />
                                <PrivacyShutter asset={currentAsset} user={user} targetCollection={targetCollection} onUpdate={(updates) => onUpdateAsset({ ...currentAsset, ...updates } as any)} />
                            </div>
                        </div>
                    )}

                    {/* Center Image Container - Grid Column 2 (or 1 if tagging) */}
                    <div 
                        className={`relative flex items-center justify-center min-w-0 ${isVisualTagging ? '' : 'col-start-2'} ${isDragging ? '' : 'transition-transform duration-200 ease-out'}`}
                        style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: 'center center' }}
                    >
                        {/* [ZEN] SFE Transporter Buffer Overlay */}
                        {isRebaking && (
                            <div className="absolute inset-0 z-[60] bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center rounded-lg pointer-events-none">
                                <img src="/assets/SFE_overlay.svg" alt="Engineering Division" className="w-32 h-32 opacity-50 animate-pulse" />
                                <span className="text-lg uppercase tracking-widest font-black text-amber-400 mt-4 animate-pulse drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">Aligning Pattern Buffer...</span>
                            </div>
                        )}

                        {(!isEditing && !isVisualTagging) && (
                            <>
                                <button onClick={(e) => {e.stopPropagation(); prevSlide();}} className="absolute -left-20 p-4 rounded-full bg-black/20 hover:bg-white/20 text-white/70 hover:text-white transition-all z-40 backdrop-blur-md border border-white/5 hover:scale-110 shadow-lg">
                                    <ChevronLeft size={36} />
                                </button>
                                <button onClick={(e) => {e.stopPropagation(); nextSlide();}} className="absolute -right-20 p-4 rounded-full bg-black/20 hover:bg-white/20 text-white/70 hover:text-white transition-all z-40 backdrop-blur-md border border-white/5 hover:scale-110 shadow-lg">
                                    <ChevronRight size={36} />
                                </button>
                            </>
                        )}

                        {type === 'video' ? (
                            <video 
                                src={currentAsset.url} 
                                controls 
                                className={`shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-lg object-contain max-h-[75vh] max-w-full`}
                            />
                        ) : isVisualTagging ? (
                            <div className="relative w-full h-[75vh] max-w-full bg-[#050505] border border-fuchsia-500/50 shadow-[0_0_30px_rgba(217,70,239,0.3)] rounded-lg flex items-center justify-center">
                                <ForensicVisualTagger
                                    src={renderedUrl}
                                    userId={user.id}
                                    existingBoxes={currentAsset.metadata?.boundingBoxes || []}
                                    onChange={(boxes) => {
                                        const newMetadata = { ...(currentAsset.metadata || {}), boundingBoxes: boxes };
                                        onUpdateAsset({ ...currentAsset, metadata: newMetadata } as any);
                                    }}
                                    imageStyle={{ 
                                        filter: getPolishFilter(renderedAsset),
                                        transform: cssRotation ? `rotate(${cssRotation}deg)` : undefined,
                                        transformOrigin: 'center center'
                                    }}
                                />
                            </div>
                        ) : (
                                <img 
                                    src={currentAsset.url} 
                                    alt={currentAsset.caption || currentAsset.title || 'Memory'} 
                                    draggable={false}
                                    onLoad={handleImageLoad}
                                    className={`shadow-[0_30px_60px_rgba(0,0,0,0.6)] rounded-lg select-none pointer-events-none object-contain m-auto`}
                                    style={{ 
                                        maxHeight: (cssRotation === 90 || cssRotation === 270) ? '100vw' : '75vh',
                                        maxWidth: (cssRotation === 90 || cssRotation === 270) ? '75vh' : '100%',
                                        filter: getPolishFilter(renderedAsset),
                                        transform: cssRotation ? `rotate(${cssRotation}deg)` : undefined,
                                        transformOrigin: 'center center'
                                    }}
                                />
                        )}
                    </div>

                    {/* Right Panel Balancer - Grid Column 3 */}
                    {!isVisualTagging && <div className="w-full h-full pointer-events-none"></div>}
                </div>

                {/* Mutara Nebula Tool Bed Container (Restored to Document Flow) */}
                <div className="relative w-full h-32 shrink-0 flex items-center justify-center z-50 pointer-events-none mt-auto">
                    
                    {/* Mutara Nebula Background Layer (Decoupled from Tools) */}
                    <div 
                        className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none z-0 animate-[pulse_8s_ease-in-out_infinite] opacity-75"
                        style={{
                            WebkitMaskImage: 'radial-gradient(ellipse at bottom center, black 10%, transparent 70%)',
                            maskImage: 'radial-gradient(ellipse at bottom center, black 10%, transparent 70%)',
                            backgroundImage: `url('/assets/nebula-seed.jpg'), radial-gradient(ellipse at bottom center, rgba(34,211,238,0.5) 0%, rgba(192,38,211,0.4) 40%, transparent 70%)`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center bottom',
                        }}
                    />

                    {/* Tools Container */}
                    <div className="pointer-events-auto relative z-10 flex items-center gap-6 px-12 py-2 bg-black/20 backdrop-blur-md border border-white/10 rounded-full shadow-2xl hover:shadow-[0_0_25px_rgba(255,255,255,0.15)] transition-all duration-500">
                        <TooltipButton 
                            onClick={() => onDiscuss(currentAsset)} 
                            isGigi={true}
                            label={`Ask ${primaryCompanionName}`} 
                            customClass=""
                            iconColor="text-white/80 hover:text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                        />

                        <TooltipButton 
                            onClick={() => onDeepDive(currentAsset)} 
                            icon={DeepDiveIcon} 
                            label="Deep Dive" 
                            customClass=""
                            iconColor="text-white/80 hover:text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                        />
                        
                        <div className="w-px h-8 bg-white/20 mx-1 drop-shadow-md" />

                        <TooltipButton 
                            onClick={() => setIsEditingDate(true)} 
                            icon={Archive} 
                            label="Edit Date" 
                            active={isEditingDate}
                            customClass=""
                            iconColor={isEditingDate ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "text-white/80 hover:text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"}
                        />

                        <div className="w-px h-8 bg-white/20 mx-1 drop-shadow-md" />
                        
                        <TooltipButton 
                            onClick={() => setIsEditing(true)} 
                            icon={Wand2} 
                            label="Media Studio" 
                            active={isEditing}
                            customClass=""
                            iconColor={isEditing ? "text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]" : "text-white/80 hover:text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"}
                        />

                        <div className="w-px h-8 bg-white/20 mx-1 drop-shadow-md" />
                        
                        <TooltipButton 
                            onClick={() => setShowMuseReimagine(true)} 
                            icon={Sparkles} 
                            label="Muse Reimagine" 
                            active={showMuseReimagine}
                            customClass=""
                            iconColor={showMuseReimagine ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "text-white/80 hover:text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"}
                        />

                        <div className="w-px h-8 bg-white/20 mx-1 drop-shadow-md" />
                        
                        <TooltipButton 
                            onClick={() => setIsVisualTagging(!isVisualTagging)} 
                            icon={Focus} 
                            label={isVisualTagging ? "Exit Visual Tagger" : "Launch Visual Tagger"} 
                            active={isVisualTagging}
                            badgeCount={currentAsset?.metadata?.boundingBoxes?.length || 0}
                            customClass=""
                            iconColor={isVisualTagging ? "text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.8)]" : "text-white/80 hover:text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"}
                        />

                        <div className="w-px h-8 bg-white/20 mx-1 drop-shadow-md" />

                        <TooltipButton 
                            onClick={() => setShowAITriage(true)} 
                            icon={Brain} 
                            label="AI Caption Editor" 
                            active={showAITriage}
                            customClass=""
                            iconColor={showAITriage ? "text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]" : "text-white/80 hover:text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"}
                        />

                        {onCiteAsset && (
                            <>
                                <div className="w-px h-8 bg-white/20 mx-1 drop-shadow-md" />
                                <TooltipButton 
                                    onClick={() => onCiteAsset(currentAsset)} 
                                    icon={ShieldAlert} 
                                    label="Issue Citation" 
                                    customClass=""
                                    iconColor="text-white/80 hover:text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]"
                                />
                            </>
                        )}

                        <div className="w-px h-8 bg-white/20 mx-1 drop-shadow-md" />

                        <TooltipButton 
                            onClick={() => setShowDeleteConfirm(true)} 
                            icon={Trash2} 
                            label="Delete Artifact" 
                            customClass=""
                            iconColor="text-white/80 hover:text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]"
                        />

                        <div className="w-px h-8 bg-white/20 mx-1 drop-shadow-md" />

                        <div className="relative">
                            <TooltipButton 
                                onClick={() => setShowRotationMenu(!showRotationMenu)} 
                                icon={RotateCw} 
                                label="Rotate CW (Forensic Heal)" 
                                active={showRotationMenu}
                                customClass=""
                                iconColor="text-white/80 hover:text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                            />
                            {showRotationMenu && (
                                <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-slate-900 border border-amber-500/50 rounded-lg p-2 flex flex-col gap-1 shadow-2xl z-50 pointer-events-auto w-32">
                                    <div className="text-[9px] uppercase text-amber-400 font-black mb-1 border-b border-amber-500/20 pb-1 text-center tracking-widest">Rotation Vector</div>
                                    <button onClick={(e) => { e.stopPropagation(); handleForceRebake('auto'); }} className="text-xs hover:bg-amber-500/20 text-white rounded px-2 py-1 text-left font-mono">Auto</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleForceRebake(90); }} className="text-xs hover:bg-amber-500/20 text-white rounded px-2 py-1 text-left font-mono">90° CW</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleForceRebake(180); }} className="text-xs hover:bg-amber-500/20 text-white rounded px-2 py-1 text-left font-mono">180° CW</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleForceRebake(270); }} className="text-xs hover:bg-amber-500/20 text-white rounded px-2 py-1 text-left font-mono">270° CW</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {isEditing && (
                    <MediaStudioModal
                        asset={{ ...currentAsset, isProduction: true } as any}
                        onClose={() => setIsEditing(false)}
                        onUpdate={(id, updates) => onUpdateAsset({ ...currentAsset, ...updates } as any)}
                        tags={allTags}
                        user={user}
                        onTagCreated={onTagCreated}
                        tetheredAnomalyId={tetheredAnomalyId}
                    />
                )}

                {isEditingDate && currentAsset && (
                    <QuickDateEditor
                        assets={[currentAsset]}
                        userId={user.id}
                        onClose={() => setIsEditingDate(false)}
                        updateAsset={onUpdateAsset}
                    />
                )}

                {showAITriage && currentAsset && (
                    <AI_TriageModal
                        isOpen={showAITriage}
                        onClose={() => setShowAITriage(false)}
                        document={{
                            _id: currentAsset.id,
                            url: currentAsset.url,
                            b2Url: currentAsset.url,
                            thumbnailUrls: { large: currentAsset.url },
                            caption: currentAsset.caption,
                            aiDescription: currentAsset.aiDescription || currentAsset.caption,
                            reviewStatus: 'pending',
                            rotation: (currentAsset as any).rotation || 0,
                            aiGenerator: (currentAsset as any).aiGenerator || 'Moondream'
                        } as any}
                        onAdopt={async (docId, finalCaption, newRotation, sourceAI) => {
                            await onUpdateAsset({ 
                                ...currentAsset, 
                                caption: finalCaption, 
                                aiDescription: currentAsset.aiDescription || finalCaption, 
                                rotation: newRotation,
                                aiGenerator: sourceAI || 'Manual Edit'
                            } as any);
                        }}
                    />
                )}

                {showMuseReimagine && currentAsset && (
                    <MuseReimagineModal
                        isOpen={showMuseReimagine}
                        onClose={() => setShowMuseReimagine(false)}
                        sourceMedia={currentAsset}
                        userId={user.id}
                    />
                )}

                {showDeleteConfirm && (
                    <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-red-500/50 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-4 mb-4 text-red-500">
                                <AlertTriangle size={32} />
                                <h3 className="text-xl font-bold text-white">Delete Artifact?</h3>
                            </div>
                            <p className="text-slate-300 mb-6 leading-relaxed">
                                Are you sure you want to permanently delete this artifact? This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={() => setShowDeleteConfirm(false)} 
                                    disabled={isDeleting}
                                    className="px-5 py-2.5 rounded-lg font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleDelete} 
                                    disabled={isDeleting}
                                    className="px-5 py-2.5 rounded-lg font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg hover:shadow-red-900/50 flex items-center gap-2"
                                >
                                    {isDeleting ? <Trash2 className="animate-pulse" /> : <Trash2 size={18} />}
                                    {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};