import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Edit, User, Dog, MapPin, Package, Calendar, Tag as TagIcon, ExternalLink, Image as ImageIcon, Sparkles, Brain, Check, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import type { Tag, Media, PersonTag, PetTag, PlaceTag, User as GIGIUser } from '../types';
import { GlassAvatar } from './GlassAvatar';
import { formatLifeOSDate } from '../utils/dateSanitizer';
import { getMediaType } from './matrix/MatrixShared';
import { appDataService } from '../services/serviceManager';
import { inferTagVisualProfile } from '../services/aiOrchestrator';
import WhatIfImaginator from './media/WhatIfImaginator';
import { WikiText } from './shared/WikiText';
import { WikiTagEditor } from './shared/WikiTagEditor';
import { aiStateBridge } from '../utils/aiStateBridge';

interface TagDetailModalProps {
    tag: Tag;
    media: Media[];
    onClose: () => void;
    onEdit: (tag: Tag) => void;
    onDiscuss: (tag: Tag) => void;
    onOpenAncestry?: (tag: Tag) => void; // [ZEN] V'Ger Shield
    onMediaClick?: (media: Media) => void; // [ZEN] Interconnectedness
    allTags?: Tag[];
    currentUser?: GIGIUser | null;
}

const getTagColor = (type: Tag['type']) => {
    switch (type) {
        case 'person': return 'bg-violet-600';
        case 'pet': return 'bg-amber-500';
        case 'place': return 'bg-emerald-500';
        case 'thing': return 'bg-blue-500';
        case 'event': return 'bg-rose-500';
        default: return 'bg-slate-600';
    }
};

const getTagIcon = (type: Tag['type']) => {
    switch (type) {
        case 'person': return <User size={16} />;
        case 'pet': return <Dog size={16} />;
        case 'place': return <MapPin size={16} />;
        case 'thing': return <Package size={16} />;
        case 'event': return <Calendar size={16} />;
        default: return <TagIcon size={16} />;
    }
};

const formatAddress = (val: any): string => {
    if (!val) return 'Unknown';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
        const parts = [val.streetAddress, val.addressLocality, val.addressRegion].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
    }
    return 'Invalid Format';
};

export const TagDetailModal: React.FC<TagDetailModalProps> = ({ 
    tag: initialTag, media, onClose, onEdit, onDiscuss, onOpenAncestry, onMediaClick,
    allTags = [], currentUser = null
}) => {
    const [tag, setTag] = useState<Tag>(initialTag);
    const [isDeepLoaded, setIsDeepLoaded] = useState(false);
    const [showImaginator, setShowImaginator] = useState(false);
    const [isInferring, setIsInferring] = useState(false);
    const [localPendingInferences, setLocalPendingInferences] = useState<string | undefined>(initialTag.pendingInferences);
    const [localInferences, setLocalInferences] = useState<string | undefined>(initialTag.inferences);

    // [ZEN] CtxEd States
    const [isCtxEdOpen, setIsCtxEdOpen] = useState(false);
    const [ctxEdContext, setCtxEdContext] = useState("");
    const [ctxEdDraft, setCtxEdDraft] = useState<string>(initialTag.pendingInferences || "");
    const [isGeneratingCtxEd, setIsGeneratingCtxEd] = useState(false);

    // [ZEN FIX] The Observer Effect Fix - Always deep fetch on mount so we never auto-save a shallow Typesense tag
    useEffect(() => {
        let isMounted = true;
        const fetchDeepTag = async () => {
            if (currentUser?.id && initialTag.id) {
                try {
                    const deepTag = await appDataService.getTag(currentUser.id, initialTag.id);
                    if (isMounted && deepTag) {
                        setTag(deepTag as Tag);
                        setLocalPendingInferences(deepTag.pendingInferences);
                        setLocalInferences(deepTag.inferences);
                        setCtxEdDraft(deepTag.pendingInferences || "");
                    }
                } catch (e) {
                    console.error("[TagDetailModal] Deep fetch failed:", e);
                } finally {
                    if (isMounted) setIsDeepLoaded(true);
                }
            }
        };
        fetchDeepTag();
        return () => { isMounted = false; };
    }, [initialTag.id, currentUser?.id]);

    const handleReRollCtxEd = async () => {
        if (!currentUser?.id) return;
        setIsGeneratingCtxEd(true);
        aiStateBridge.setThinking(true);
        try {
            const newInsights = await inferTagVisualProfile(tag, media, ctxEdContext);
            setCtxEdDraft(newInsights);
        } catch (e) {
            console.error("CtxEd Re-roll failed", e);
        } finally {
            setIsGeneratingCtxEd(false);
            aiStateBridge.setThinking(false);
        }
    };

    const getTagImage = (t: Tag) => {
        if (t.mainImageId) {
            const found = media.find(m => m.id === t.mainImageId);
            if (found) return found.thumbnailUrl || found.url || found.base64Data;
        }
        if (t.tagIds && t.tagIds.length > 0) {
            const relatedImage = media.find(m => m.tagIds && m.tagIds.includes(t.id) && m.fileType && m.fileType.startsWith('image/'));
            if (relatedImage) return relatedImage.thumbnailUrl || relatedImage.url || relatedImage.base64Data;
        }
        return null;
    };

    const imageUrl = getTagImage(tag);

    const relatedMedia = media.filter(m =>
        !m.isFiction && !m.isAvatar && (
            (m.tagIds && m.tagIds.includes(tag.id)) ||
            (m.id === tag.mainImageId)
        )
    );

    // Lazy Inference Trigger
    useEffect(() => {
        const checkAndTriggerInference = async () => {
            if (!isDeepLoaded || !currentUser?.id || isInferring) return;
            const needsInference = !localInferences && !localPendingInferences;
            const mediaCountChanged = tag.inferredMediaCount !== relatedMedia.length;
            
            if (relatedMedia.length > 0 && (needsInference || mediaCountChanged)) {
                setIsInferring(true);
                try {
                    const inferred = await inferTagVisualProfile(tag, relatedMedia);
                    if (inferred) {
                        const updatedTag = {
                            ...tag,
                            pendingInferences: inferred,
                            inferredMediaCount: relatedMedia.length,
                            inferencesLastUpdated: new Date().toISOString()
                        };
                        await appDataService.saveTag(currentUser.id, updatedTag);
                        setLocalPendingInferences(inferred);
                    }
                } catch (e) {
                    console.error("Failed to run visual inference", e);
                } finally {
                    setIsInferring(false);
                }
            }
        };

        checkAndTriggerInference();
    }, [isDeepLoaded, tag, relatedMedia.length, currentUser]);

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] isolate animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

                {/* Banner */}
                <div className={`h-32 ${getTagColor(tag.type)} relative shrink-0 rounded-t-2xl z-20`}>
                    {imageUrl && (
                        <>
                            <img src={imageUrl} alt={tag.name} className="w-full h-full object-cover opacity-30 blur-md rounded-t-2xl" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent rounded-t-2xl"></div>
                        </>
                    )}
                    <button onClick={onClose} className="absolute top-12 right-6 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors z-50">
                        <X size={24} />
                    </button>

                    {/* Glass Avatar */}
                    <div className="absolute -bottom-16 left-8 z-30">
                        <GlassAvatar
                            imageUrl={imageUrl}
                            altText={tag.name}
                            fallbackChar={tag.name}
                            size="w-32 h-32"
                            className="text-5xl font-bold"
                        />
                    </div>
                </div>

                {/* Body */}
                <div className="px-8 pb-8 mt-20 block flex-1 overflow-y-auto min-h-0 custom-scrollbar relative z-0">
                    <div className="flex justify-end mb-6">
                        <div className="flex gap-3 flex-wrap justify-end">
                            <button onClick={() => setShowImaginator(true)} className="px-4 py-2 bg-gradient-to-r from-fuchsia-800 to-violet-800 hover:from-fuchsia-700 hover:to-violet-700 text-white border border-fuchsia-700/50 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-fuchsia-900/20 transition-all">
                                <Sparkles size={16} /> Re-imagine (Muse)
                            </button>
                            <button onClick={() => { onClose(); onDiscuss(tag); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 border border-slate-700 transition-all">
                                <MessageSquare size={16} /> Discuss
                            </button>
                            <button onClick={() => { onClose(); onEdit(tag); }} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-violet-900/20 transition-all">
                                <Edit size={16} /> Edit Profile
                            </button>
                            {/* [ZEN] V'Ger Shield Button */}
                            {tag.type === 'person' && onOpenAncestry && (
                                <button
                                    onClick={() => { onClose(); onOpenAncestry(tag); }}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors hover:text-blue-300"
                                >
                                    <Package size={16} /> Ancestry Connection
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-4xl font-black text-white tracking-tight">{tag.name}</h2>
                            <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                                {getTagIcon(tag.type)}
                                {tag.type.toUpperCase()}
                            </span>
                        </div>
                        <WikiText text={tag.description || "No detailed description recorded."} className="text-lg text-slate-300 leading-relaxed font-light" />
                    </div>

                    {/* Metadata Grid */}
                    <div className="bg-slate-950/50 rounded-xl p-6 border border-slate-800 mb-8">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider">Details</h4>
                        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                            {tag.type === 'person' && (
                                <>
                                    {/* Birth Info */}
                                    <div>
                                        <span className="block text-xs text-slate-500 mb-1">Birth</span>
                                        <span className="text-white font-medium">
                                            {formatLifeOSDate((tag as PersonTag).metadata?.dates?.birth, (tag as PersonTag).metadata?.dates?.birthPrecision || 'day')}
                                        </span>
                                        {(tag as PersonTag).metadata?.birthPlace && (
                                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                <MapPin size={10} /> {(tag as PersonTag).metadata?.birthPlace}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <span className="block text-xs text-slate-500 mb-1">Gender</span>
                                        <span className="text-white font-medium">{(tag as PersonTag).metadata?.gender || 'Unknown'}</span>
                                    </div>

                                    {/* Death Info */}
                                    {((tag as PersonTag).metadata?.dates?.death || (tag as PersonTag).metadata?.deathPlace) && (
                                        <div className="col-span-2 pt-4 mt-2 border-t border-slate-800">
                                            <span className="block text-xs text-slate-500 mb-1">Death</span>
                                            <div className="flex gap-4">
                                                {(tag as PersonTag).metadata?.dates?.death && (
                                                    <span className="text-slate-300 font-medium text-sm">
                                                        {formatLifeOSDate((tag as PersonTag).metadata?.dates?.death, (tag as PersonTag).metadata?.dates?.deathPrecision || 'day')}
                                                    </span>
                                                )}
                                                {(tag as PersonTag).metadata?.deathPlace && (
                                                    <span className="text-slate-400 text-xs flex items-center gap-1">
                                                        <MapPin size={10} /> {(tag as PersonTag).metadata?.deathPlace}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                            {tag.type === 'place' && <div className="col-span-2"><span className="block text-xs text-slate-500 mb-1">Address</span><span className="text-white font-medium">{formatAddress((tag as PlaceTag).metadata?.address)}</span></div>}

                            {tag.type === 'pet' && <div><span className="block text-xs text-slate-500 mb-1">Species</span><span className="text-white font-medium">{(tag as PetTag).metadata?.species || 'Unknown'}</span></div>}
                            <div><span className="block text-xs text-slate-500 mb-1">Database ID</span><span className="text-white font-medium font-mono text-xs">{tag.id}</span></div>
                        </div>
                    </div>

                    {/* Inference Status Indicator */}
                    {isInferring && (
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-400/80 mb-6 py-2 px-3 bg-cyan-950/20 border border-cyan-500/10 rounded-lg max-w-max animate-pulse">
                            <Loader2 size={12} className="animate-spin text-cyan-400" />
                            G.I.G.I. is calibrating visual fingerprint...
                        </div>
                    )}

                    {/* Approved Visual Insights */}
                    {localInferences && (
                        <div className="bg-emerald-950/20 rounded-xl p-6 border border-emerald-500/20 mb-8 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                            <h4 className="text-xs font-black text-emerald-400 uppercase mb-3 tracking-wider flex items-center gap-2">
                                <Brain size={14} className="text-emerald-400" /> Approved Visual Fingerprint
                            </h4>
                            <WikiText text={localInferences} className="text-sm text-slate-300" />
                        </div>
                    )}

                    {/* Pending Quarantined Insights */}
                    {localPendingInferences && (
                        <div className="bg-amber-950/20 rounded-xl p-6 border border-dashed border-amber-500/40 mb-8 shadow-[0_0_15px_rgba(245,158,11,0.05)] relative group overflow-hidden">
                            <div className="absolute top-0 right-0 bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase px-3 py-1 rounded-bl-lg tracking-widest border-l border-b border-amber-500/20">
                                QUARANTINED FROM RAG
                            </div>
                            <h4 className="text-xs font-black text-amber-400 uppercase mb-3 tracking-wider flex items-center gap-2">
                                <ShieldAlert size={14} className="text-amber-400" /> Pending AI Visual Insights
                            </h4>
                            
                            {!isCtxEdOpen ? (
                                <>
                                    <WikiText text={localPendingInferences} className="text-sm text-slate-300 mb-4 block" />
                                    <div className="flex gap-3 justify-end">
                                        <button
                                            onClick={() => setIsCtxEdOpen(true)}
                                            className="px-3 py-1.5 bg-blue-950/60 hover:bg-blue-900 border border-blue-500/30 text-blue-300 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                                        >
                                            <Edit size={12} /> CtxEd (Re-Roll)
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!currentUser?.id) return;
                                                const updatedTag = {
                                                    ...tag,
                                                    inferences: localPendingInferences,
                                                    pendingInferences: "",
                                                    inferredMediaCount: relatedMedia.length,
                                                    inferencesLastUpdated: new Date().toISOString()
                                                };
                                                await appDataService.saveTag(currentUser.id, updatedTag);
                                                setLocalInferences(localPendingInferences);
                                                setLocalPendingInferences("");
                                            }}
                                            className="px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-500/30 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                                        >
                                            <Check size={12} /> Approve & Integrate
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!currentUser?.id) return;
                                                const updatedTag = {
                                                    ...tag,
                                                    pendingInferences: "",
                                                    inferredMediaCount: relatedMedia.length,
                                                    inferencesLastUpdated: new Date().toISOString()
                                                };
                                                await appDataService.saveTag(currentUser.id, updatedTag);
                                                setLocalPendingInferences("");
                                            }}
                                            className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                                        >
                                            <X size={12} /> Reject & Dismiss
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Sovereign Context Layer</h5>
                                        <WikiTagEditor
                                            value={ctxEdContext}
                                            onChange={setCtxEdContext}
                                            userId={currentUser?.id || ''}
                                            placeholder="Provide specific factual overrides or guidance to Grok..."
                                            className="min-h-[60px]"
                                        />
                                        <div className="mt-2 flex justify-end">
                                            <button
                                                onClick={handleReRollCtxEd}
                                                disabled={isGeneratingCtxEd}
                                                className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-50 border border-indigo-400/30 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                                            >
                                                {isGeneratingCtxEd ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                                Generate (Re-Roll)
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Manual Tweak (Draft)</h5>
                                        <WikiTagEditor
                                            value={ctxEdDraft}
                                            onChange={setCtxEdDraft}
                                            userId={currentUser?.id || ''}
                                            className="min-h-[100px]"
                                        />
                                    </div>

                                    <div className="flex gap-3 justify-end mt-4">
                                        <button
                                            onClick={() => {
                                                setIsCtxEdOpen(false);
                                                setCtxEdDraft(localPendingInferences || "");
                                            }}
                                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (!currentUser?.id) return;
                                                const updatedTag = {
                                                    ...tag,
                                                    inferences: ctxEdDraft,
                                                    pendingInferences: "",
                                                    inferredMediaCount: relatedMedia.length,
                                                    inferencesLastUpdated: new Date().toISOString()
                                                };
                                                await appDataService.saveTag(currentUser.id, updatedTag);
                                                setLocalInferences(ctxEdDraft);
                                                setLocalPendingInferences("");
                                                setIsCtxEdOpen(false);
                                            }}
                                            className="px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-500/30 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                                        >
                                            <Check size={12} /> Approve & Integrate Draft
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* [ZEN] Liberated Linked Memories Gallery */}
                    {relatedMedia.length > 0 && (
                        <div className="mb-8 border-t border-white/5 pt-8">
                            <div className="flex justify-between items-end mb-6">
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Total Records</h4>
                                    <h3 className="text-xl font-bold text-white tracking-tight">Linked Memories ({relatedMedia.length})</h3>
                                </div>
                                <span className="text-[10px] font-black text-cyan-500 cursor-pointer hover:text-cyan-400 uppercase tracking-widest flex items-center gap-2 group">
                                    Archive View <ExternalLink size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </span>
                            </div>
                            
                            <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {/* Deduplicate by ID to prevent ghost repeats */}
                                    {Array.from(new Map(relatedMedia.map(m => [m.id, m])).values()).map(m => (
                                        <div 
                                            key={m.id} 
                                            onClick={() => onMediaClick?.(m)}
                                            className="aspect-square rounded-xl overflow-hidden border border-white/5 bg-slate-950/50 relative group cursor-pointer hover:border-cyan-500/50 transition-all shadow-xl"
                                        >
                                            {/* [ZEN FIX] Robust Image/Video Detection */}
                                            {getMediaType(m) === 'video' ? (
                                                <video 
                                                    src={m.url} 
                                                    muted 
                                                    loop 
                                                    playsInline 
                                                    autoPlay 
                                                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1" 
                                                />
                                            ) : (m.url || m.thumbnailUrl) ? (
                                                <img 
                                                    src={m.thumbnailUrl || m.url} 
                                                    alt={m.caption || m.title || 'Memory'} 
                                                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1" 
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        if (!target.src.includes('placeholder.png')) {
                                                            target.src = 'https://media.gigiwatt.com/file/LifeOS-Media/placeholder.png'; 
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 bg-black/40 gap-2">
                                                    <ImageIcon size={24} className="opacity-20" />
                                                    <span className="text-[8px] font-black uppercase tracking-tighter opacity-20">No Stream</span>
                                                </div>
                                            )}
                                            
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                                <p className="text-[10px] font-bold text-white truncate drop-shadow-md">
                                                    {m.caption || m.title || 'Untitled Memory'}
                                                </p>
                                                {m.logicalDate && (
                                                    <p className="text-[8px] text-cyan-400/80 font-mono mt-0.5">
                                                        {new Date(m.logicalDate as any).getFullYear()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {showImaginator && (
                <WhatIfImaginator
                    tag={tag}
                    allTags={allTags}
                    currentUser={currentUser}
                    onClose={() => setShowImaginator(false)}
                />
            )}
        </div>
    );
};