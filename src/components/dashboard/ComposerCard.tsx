import React, { useState, useEffect, useRef } from 'react';
import type { View, User, Media, Tag, AddressData } from '../../types';
import {
    Radio, Activity as PulseIcon, Image as ImageIcon, MapPin, Plus, Settings as SettingsIcon, Wand2,
    Database, Cloud, Grid, X, Upload
} from 'lucide-react';
import { uploadFile } from '../../services/storageService';
import { appDataService } from '../../services/serviceManager';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { GlassAvatar } from '../GlassAvatar';
import { MarkdownEditor } from '../shared/MarkdownEditor';
import MatrixSelector from '../media/MatrixSelector';
import { useGooglePhotos } from '../../hooks/useGooglePhotos';
import { ImportModal } from '../matrix/ImportModal';
import { ShimmerWindow } from '../shared/ShimmerWindow';
import { NarrativeEnrichmentService, EventPrediction } from '../../services/ai/narrativeEnrichment';
import { geocodingService } from '../../services/geocodingService';
import type { LifeEvent } from '../../types/models';
import { Sparkles, Calendar, Tag as TagIcon, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';

const AI_STATUS_MESSAGES = [
    "Analyzing narrative threads...",
    "Optimizing retrieval paths...",
    "Monitoring temporal variance...",
    "System nominal. Ready for input.",
    "Cataloging recent artifacts...",
    "Scanning for emotional resonance..."
];

interface ComposerCardProps {
    aiName: string;
    aiAvatar: string;
    recentTags: Tag[];
    media: Media[];
    verts: any[];
    tags: Tag[];
    eventCount: number;
    user: User;
    onNavigate: (view: View, data?: any) => void;
    streamStatus?: 'idle' | 'receiving';
    stagedCount?: number;
}

export const ComposerCard: React.FC<ComposerCardProps> = ({ aiName, aiAvatar, recentTags, media, verts, tags, eventCount, user, onNavigate, streamStatus, stagedCount = 0 }) => {
    const [statusMsg, setStatusMsg] = useState(AI_STATUS_MESSAGES[0]);
    const [aiQuery, setAiQuery] = useState('');
    const [wdyetText, setWdyetText] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [attachedMedia, setAttachedMedia] = useState<Media[]>([]);
    const [showMap, setShowMap] = useState(false);
    const [showMatrixPicker, setShowMatrixPicker] = useState(false);
    const [draftLocation, setDraftLocation] = useState<AddressData | null>(null);
    const [userPresets, setUserPresets] = useState<any[]>([]);
    const [prediction, setPrediction] = useState<EventPrediction | null>(null);
    const [isEnriching, setIsEnriching] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const attachMenuRef = useRef<HTMLDivElement>(null);
    const [showAttachMenu, setShowAttachMenu] = useState(false);

    // [ZEN] Direct Cloud Ingestion Shortcut
    const { 
        isOpen: isImportModalOpen, 
        step: importStep, 
        errorMsg, 
        startImport, 
        cancelImport, 
        handleConnect 
    } = useGooglePhotos(() => {}, onNavigate);

    useEffect(() => {
        if (!user?.id) return;
        const fetchPresets = async () => {
            try {
                const presets = await appDataService.getUserPresets(user.id);
                setUserPresets(presets);
            } catch (e) {
                console.error("[ComposerCard] Failed to fetch presets", e);
            }
        };
        fetchPresets();
    }, [user?.id]);

    useEffect(() => {
        const savedText = sessionStorage.getItem('gigi_draft_text');
        if (savedText) setWdyetText(savedText);
        const savedMedia = sessionStorage.getItem('gigi_draft_media');
        if (savedMedia) { try { setAttachedMedia(JSON.parse(savedMedia)); } catch (e) { } }
        const savedLoc = sessionStorage.getItem('gigi_draft_location');
        if (savedLoc) { try { setDraftLocation(JSON.parse(savedLoc)); } catch (e) { } }
    }, []);

    // [ZEN] Geolocation Preload: Acquire user device coordinates and reverse-geocode into draftLocation
    useEffect(() => {
        const savedLoc = sessionStorage.getItem('gigi_draft_location');
        if (savedLoc) return; // Prioritize existing session-saved draft location

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    try {
                        const locationIqToken = import.meta.env.VITE_LOCATIONIQ_TOKEN || undefined;
                        const geoResult = await geocodingService.reverse(latitude, longitude, locationIqToken);
                        if (geoResult && geoResult.addressDetails) {
                            const details = geoResult.addressDetails;
                            const addrData: AddressData = {
                                streetAddress: details.street || geoResult.display_name.split(',')[0],
                                addressLocality: details.city || '',
                                addressRegion: details.state_code || details.state || '',
                                postalCode: details.postcode || '',
                                coordinates: { lat: latitude, lng: longitude }
                            };
                            setDraftLocation(addrData);
                            // [CLEARED]
                        }
                    } catch (err) {
                        console.warn("[ComposerCard] Reverse geocoding of device coordinates failed:", err);
                    }
                },
                (err) => {
                    console.warn("[ComposerCard] Geolocation acquisition failed/denied:", err);
                },
                { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
            );
        }
    }, []);

    useEffect(() => { 
        sessionStorage.setItem('gigi_draft_text', wdyetText); 
        window.dispatchEvent(new CustomEvent('gigi_draft_changed', { detail: wdyetText }));
    }, [wdyetText]);
    useEffect(() => { sessionStorage.setItem('gigi_draft_media', JSON.stringify(attachedMedia)); }, [attachedMedia]);
    useEffect(() => { if (draftLocation) sessionStorage.setItem('gigi_draft_location', JSON.stringify(draftLocation)); else sessionStorage.removeItem('gigi_draft_location'); }, [draftLocation]);

    // [ZEN] Spatial Context Bridge: Auto-populate location from attached media
    useEffect(() => {
        if (draftLocation || attachedMedia.length === 0) return;

        // Extract all valid locations from attached media
        const mediaLocations = attachedMedia
            .map(m => m.location)
            .filter((loc): loc is { address: string; lat?: number; lng?: number } => !!loc && !!loc.address);

        if (mediaLocations.length > 0) {
            // Majority rule / Priority selection
            // For now, we take the first high-fidelity location found
            const suggestedLoc = mediaLocations[0];
            const addressData: AddressData = {
                streetAddress: suggestedLoc.address,
                addressLocality: '',
                addressRegion: '',
                postalCode: '',
                coordinates: suggestedLoc.lat && suggestedLoc.lng 
                    ? { lat: suggestedLoc.lat, lng: suggestedLoc.lng }
                    : undefined
            };
            setDraftLocation(addressData);
            console.log("[Composer] Inherited location from media context:", addressData.streetAddress);
        }
    }, [attachedMedia, draftLocation]);

    useEffect(() => {
        if (!wdyetText || wdyetText.length < 12 || !user?.id) {
            setPrediction(null);
            return;
        }

        const timer = setTimeout(async () => {
            setIsEnriching(true);
            try {
                const pred = await NarrativeEnrichmentService.extractEventMetadata(wdyetText, user.id, { tags });
                setPrediction(pred);
            } catch (e) {
                console.error("[Composer] Enrichment failed", e);
            } finally {
                setIsEnriching(false);
            }
        }, 2000); // 2s debounce for narrative flow

        return () => clearTimeout(timer);
    }, [wdyetText, user?.id, tags]);

    useEffect(() => {
        const interval = setInterval(() => {
            setStatusMsg(AI_STATUS_MESSAGES[Math.floor(Math.random() * AI_STATUS_MESSAGES.length)]);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    // [ZEN] Click-Outside Menu Dismissal: Prevents backdrop race conditions & viewport blockages
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showAttachMenu && attachMenuRef.current && !attachMenuRef.current.contains(event.target as Node)) {
                setShowAttachMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showAttachMenu]);

    const handleAiQuerySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (aiQuery.trim()) {
            onNavigate('interviews', { initialMessage: aiQuery });
            setAiQuery('');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!user?.id) return;
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        const newAttachments: Media[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const { url } = await uploadFile(file, user.id, `event-attachment-${Date.now()}`);
                const newMedia: Media = {
                    id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    url: url, thumbnailUrl: url, caption: 'Draft Attachment',
                    uploadDate: new Date(), fileType: file.type, fileName: file.name,
                    size: file.size, tagIds: [], status: 'provisional', logicalDate: new Date().toISOString(),
                    mediaIds: []
                };
                await appDataService.saveMedia(user.id, newMedia);
                newAttachments.push(newMedia);
            } catch (err) { console.error("Quick Upload Failed", err); }
        }
        setAttachedMedia(prev => [...prev, ...newAttachments]);
        setIsUploading(false);
    };

    const handleMatrixSelect = (selectedMedia: Media[]) => {
        // Avoid duplicates in the attachment array
        setAttachedMedia(prev => {
            const newMedia = selectedMedia.filter(m => !prev.some(existing => existing.id === m.id));
            return [...prev, ...newMedia];
        });
        setShowMatrixPicker(false);
    };

    const handleCreateEvent = () => {
        const draftEvent = {
            title: prediction?.title || wdyetText.split('\n')[0].substring(0, 250) || "New Memory",
            details: wdyetText, 
            mediaIds: attachedMedia.map(m => m.id), 
            location: draftLocation || (prediction?.location ? { streetAddress: prediction.location } : undefined),
            date: prediction?.date ? new Date(prediction.date) : new Date()
        };
        sessionStorage.removeItem('gigi_draft_text');
        sessionStorage.removeItem('gigi_draft_media');
        sessionStorage.removeItem('gigi_draft_location');
        setWdyetText(''); setAttachedMedia([]); setDraftLocation(null); setPrediction(null);
        onNavigate('eventEditor', { draftEvent });
    };

    const handleQuickLog = async () => {
        if (!wdyetText.trim()) return;
        setIsUploading(true);
        try {
            const title = prediction?.title || wdyetText.split('\n')[0].substring(0, 60) || "New Memory";
            const eventDate = prediction?.date ? new Date(prediction.date) : new Date();
            
            const tagIds: string[] = [];
            if (prediction?.tags) {
                prediction.tags.forEach(tagName => {
                    const found = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                    if (found) tagIds.push(found.id);
                });
            }

            const stagedArtifact = {
                type: 'event', // [ZEN] Narrative Jot
                source: 'shoebox',
                title,
                description: wdyetText,
                logicalDate: eventDate,
                datePrecision: prediction?.date ? 'day' : 'exact',
                tagIds,
                mediaIds: attachedMedia.map(m => m.id),
                location: draftLocation || (prediction?.location ? { streetAddress: prediction.location } : undefined),
                aiStatus: 'completed',
                status: 'pending',
                metadata: {
                    confidence: prediction?.confidence || 0.5,
                    sentiment: prediction?.sentiment || 'neutral'
                }
            };

            await appDataService.stageArtifact(user.id, stagedArtifact);
            
            // Cleanup
            setWdyetText('');
            setAttachedMedia([]);
            setDraftLocation(null);
            setPrediction(null);
            
            console.log("[Composer] Staged to Shoebox Successfully");
        } catch (error) {
            console.error("[Composer] Staging failed", error);
        } finally {
            setIsUploading(false);
        }
    };

    const getTagImage = (tag: Tag) => {
        if (tag.mainImageId) {
            const m = media.find(x => x.id === tag.mainImageId);
            if (m) return m.thumbnailUrl || m.url;
        }
        return null;
    };

    // [ZEN] Bento Grid Data Points
    const shoeboxAll = media.filter(m => {
        const dateStr = typeof m.logicalDate === 'string' ? m.logicalDate : '';
        return m.year === 1970 || dateStr.startsWith('1970');
    });
    const shoeboxItems = shoeboxAll.slice(0, 6);
    const shoeboxCount = shoeboxAll.length;

    const temporalEchoes = media.filter(m => {
        if (!m.logicalDate) return false;
        const d = new Date(m.logicalDate);
        const today = new Date();
        return d.getMonth() === today.getMonth() && d.getDate() === today.getDate() && d.getFullYear() !== today.getFullYear();
    });

    const randomTemporalEcho = temporalEchoes.length > 0 ? temporalEchoes[Math.floor(Math.random() * temporalEchoes.length)] : null;

    return (
        <ShimmerWindow containerClassName="h-full min-h-[500px] shadow-2xl" className="gigi-bento-card p-6 relative overflow-hidden flex flex-col gap-4 h-full">

            {/* [ZEN V35] CORE MELTDOWN OVERLAY */}
            {(user?.sovereignMemex?.neuralTemperature || 0) > 90 && (
                <div className="absolute inset-0 z-50 pointer-events-none animate-pulse bg-red-900/20 border-4 border-red-600/50 rounded-3xl">
                    <div className="absolute inset-0 bg-gradient-to-t from-red-600/10 to-transparent"></div>
                </div>
            )}

            {/* Header with AI Team */}
            <div className={`bg-slate-900/80 border rounded-xl p-3 flex items-center gap-3 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] transition-colors duration-500 shrink-0 ${
                (user?.sovereignMemex?.neuralTemperature || 0) > 80 ? 'border-red-500/50 bg-red-950/20' :
                (user?.sovereignMemex?.neuralTemperature || 0) > 40 ? 'border-amber-500/50 bg-amber-950/10' :
                streamStatus === 'receiving' ? 'border-amber-500/50 bg-amber-950/20' : 
                'border-emerald-500/20'
            }`}>

                <div className="flex -space-x-3 hover:space-x-1 transition-all duration-300 relative shrink-0 pl-1">
                    {user?.aiCompanions && user.aiCompanions.length > 0 ? (
                        user.aiCompanions.map((companion) => (
                            <div key={companion.id} onClick={() => onNavigate('aiCompanionEditor')} className="relative z-10 cursor-pointer hover:z-20 hover:scale-110 transition-transform" title="Manage Companion">
                                <GlassAvatar
                                    imageUrl={companion.avatarUrl}
                                    altText={companion.name}
                                    fallbackChar={companion.name}
                                    size="w-10 h-10"
                                    className={
                                        (user?.sovereignMemex?.neuralTemperature || 0) > 80 ? "border-red-500 shadow-[0_0_15px_#dc2626]" :
                                        companion.isPrimary ? "border-emerald-500 shadow-[0_0_10px_#10b981]" : 
                                        "opacity-80"
                                    }
                                />
                                {companion.isPrimary && <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border border-black rounded-full z-20 ${
                                    (user?.sovereignMemex?.neuralTemperature || 0) > 80 ? 'bg-red-500 animate-ping' : 'bg-emerald-500'
                                }`}></span>}
                            </div>
                        ))
                    ) : (
                        <div onClick={() => onNavigate('aiCompanionEditor')} className="relative z-10 cursor-pointer hover:scale-110 transition-transform">
                            <GlassAvatar imageUrl={aiAvatar} altText="AI" fallbackChar="AI" size="w-10 h-10" />
                        </div>
                    )}
                    <button onClick={() => onNavigate('aiCompanionEditor')} className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 hover:border-slate-500 transition-all z-0 ml-2" title="Manage Companions"><SettingsIcon size={14} /></button>
                </div>

                <div className="flex-1 min-w-0 pl-2">
                    <div className="flex justify-between items-center mb-1">
                        {streamStatus === 'receiving' ? (
                            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2 animate-pulse">
                                <Radio size={12} className="animate-spin" /> Temporal Variance Detected
                            </span>
                        ) : (
                            <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                                (user?.sovereignMemex?.neuralTemperature || 0) > 80 ? 'text-red-500 animate-pulse' :
                                (user?.sovereignMemex?.neuralTemperature || 0) > 40 ? 'text-amber-500' :
                                'text-emerald-500'
                            }`}>
                                <PulseIcon size={12} className={(user?.sovereignMemex?.neuralTemperature || 0) > 70 ? 'animate-bounce' : ''} />
                                Neural Uplink: {(user?.sovereignMemex?.neuralTemperature || 0) > 80 ? 'CRITICAL DRIFT' : 
                                               (user?.sovereignMemex?.neuralTemperature || 0) > 40 ? 'STABILITY ALERT' : 
                                               'STABLE'}
                            </span>
                        )}
                    </div>
                    <form onSubmit={handleAiQuerySubmit} className="flex gap-2">
                        <span className={`font-mono text-sm ${
                            (user?.sovereignMemex?.neuralTemperature || 0) > 80 ? 'text-red-500' : 'text-emerald-500'
                        }`}>{">"}</span>
                        <input 
                            type="text" 
                            value={aiQuery} 
                            onChange={(e) => setAiQuery(e.target.value)} 
                            placeholder={`${aiName}: ${user?.sovereignMemex?.neuralStatusText || statusMsg}`} 
                            className={`bg-transparent border-none outline-none text-sm font-mono w-full ${
                                (user?.sovereignMemex?.neuralTemperature || 0) > 80 ? 'text-red-400 placeholder-red-900/50' : 'text-white placeholder-slate-600'
                            }`} 
                        />
                    </form>
                </div>
            </div>

            <div className="flex-1 flex gap-4 min-h-0">
                {/* Widescreen Creative Writing Workspace */}
                <div className="flex-1 bg-gradient-to-br from-[#040b16]/90 to-black backdrop-blur-xl rounded-2xl border border-cyan-500/20 shadow-[0_0_40px_rgba(6,182,212,0.05),inset_0_0_50px_rgba(0,0,0,0.8)] group focus-within:border-cyan-400/80 focus-within:shadow-[0_0_50px_rgba(6,182,212,0.15),inset_0_0_30px_rgba(6,182,212,0.05)] transition-all flex flex-col min-h-0 relative overflow-hidden">
                    
                    {/* Tech Bracket Accents (Top Left, Top Right, Bottom Left, Bottom Right) */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/50 rounded-tl-2xl pointer-events-none z-20 group-focus-within:border-cyan-400 group-focus-within:shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/50 rounded-tr-2xl pointer-events-none z-20 group-focus-within:border-cyan-400 group-focus-within:shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/50 rounded-bl-2xl pointer-events-none z-20 group-focus-within:border-cyan-400 group-focus-within:shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/50 rounded-br-2xl pointer-events-none z-20 group-focus-within:border-cyan-400 group-focus-within:shadow-[0_0_10px_rgba(34,211,238,0.5)] transition-all"></div>

                    <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 to-transparent shrink-0 relative z-10">
                        <div className="flex items-center gap-2">
                            <Wand2 size={12} className="text-cyan-400 animate-pulse" />
                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.25em] font-mono drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">NEURAL TIMESLIDE COMPOSER</span>
                        </div>
                        {stagedCount > 0 && (
                            <button 
                                onClick={() => onNavigate('staging')}
                                className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-all group animate-in fade-in slide-in-from-right-2"
                                title="Open Staging Airlock"
                            >
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                                <span className="text-[9px] font-black tracking-[0.15em] uppercase">{stagedCount} PENDING</span>
                                <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}
                    </div>

                    <div className="relative z-10 flex-1 flex flex-col min-h-0 p-4">
                        {/* GhostWriter Integration */}
                        <MarkdownEditor
                            value={wdyetText}
                            onChange={setWdyetText}
                            hideFooter={true}
                            className="flex-1 h-full"
                            placeholder="What did you experience today?"
                            userId={user.id}
                            userPresets={userPresets}
                        />
                    </div>

                {/* [ZEN] Neural Prediction Tray - The Friction Killer */}
                <div className={`overflow-hidden transition-all duration-500 ease-out border-t border-white/5 bg-black/40 ${prediction || isEnriching ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-2">
                                <Sparkles size={10} className={isEnriching ? 'animate-spin' : ''} />
                                {isEnriching ? 'Analyzing Narrative...' : 'Neural Spark Prediction'}
                            </span>
                            {prediction && (
                                <span className="text-[9px] font-bold text-slate-500">
                                    {Math.round(prediction.confidence * 100)}% Confidence
                                </span>
                            )}
                        </div>

                        {prediction && (
                            <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-1">
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/70">
                                    <Calendar size={10} className="text-emerald-400" />
                                    {new Date(prediction.date).toLocaleDateString()}
                                </div>
                                {prediction.location && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/70">
                                        <MapPin size={10} className="text-blue-400" />
                                        {prediction.location}
                                    </div>
                                )}
                                {prediction.tags.map(tagName => (
                                    <div key={tagName} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-300">
                                        <TagIcon size={10} />
                                        {tagName}
                                    </div>
                                ))}
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] ${
                                    prediction.sentiment === 'positive' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
                                    prediction.sentiment === 'negative' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
                                    'bg-white/5 border-white/10 text-white/50'
                                }`}>
                                    {prediction.sentiment.toUpperCase()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {attachedMedia.length > 0 && (
                    <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0 bg-transparent pt-2 border-t border-white/5">
                        {attachedMedia.map((m) => (
                            <div key={m.id} onClick={() => setAttachedMedia(prev => prev.filter(x => x.id !== m.id))} className="h-10 w-10 rounded border border-white/20 overflow-hidden relative cursor-pointer hover:border-red-500 transition-colors group/thumb" title="Remove Attachment">
                                <img src={m.thumbnailUrl || m.url} className="w-full h-full object-cover group-hover/thumb:opacity-30" alt="thumb" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 text-red-500">
                                    <X size={14} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {showMap && (
                    <div className="px-4 pb-2 shrink-0 bg-transparent">
                        <AddressAutocomplete 
                            value={draftLocation || { streetAddress: '', addressLocality: '', addressRegion: '', postalCode: '' }} 
                            onChange={(addr) => { setDraftLocation(addr); setShowMap(false); }} 
                            tags={tags}
                            userId={user.id}
                        />
                    </div>
                )}
                <div className="px-4 py-3 bg-black/20 shrink-0 border-t border-white/5">
                    <div className="flex flex-wrap gap-2 w-full">
                        <div className="relative flex-1 min-w-[120px]" ref={attachMenuRef}>
                            {/* Attach Dropdown Trigger */}
                            <button 
                                onClick={() => setShowAttachMenu(!showAttachMenu)}
                                className="w-full h-9 px-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <Plus size={14} />
                                <span>Attach</span>
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />

                            {showAttachMenu && (
                                <div className="absolute bottom-full mb-2 left-0 w-52 bg-slate-950/95 border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                                    <button 
                                        onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors text-xs text-left"
                                    >
                                        <ImageIcon size={14} className="text-cyan-400" />
                                        <span>Upload Device File</span>
                                    </button>
                                    <button 
                                        onClick={() => { setShowMatrixPicker(true); setShowAttachMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors text-xs text-left"
                                    >
                                        <Database size={14} className="text-violet-400" />
                                        <span>Search Matrix Vault</span>
                                    </button>
                                    <button 
                                        onClick={() => { startImport(); setShowAttachMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors text-xs text-left"
                                    >
                                        <Cloud size={14} className="text-blue-400" />
                                        <span>Google Photos Ingestion</span>
                                    </button>
                                    <button 
                                        onClick={() => { onNavigate('staging'); setShowAttachMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors text-xs text-left"
                                    >
                                        <Wand2 size={14} className="text-amber-400" />
                                        <span>Accessioning Gateway</span>
                                    </button>
                                    <button 
                                        onClick={() => { setShowMap(!showMap); setShowAttachMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors text-xs text-left"
                                    >
                                        <MapPin size={14} className="text-emerald-400" />
                                        <span>Spatial Location Metadata</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* Compact Location Active Indicator */}
                        {draftLocation && (
                            <div className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 h-9 rounded-lg animate-in zoom-in-95 relative group">
                                <MapPin size={12} className="shrink-0" />
                                <span className="truncate max-w-[160px]">{draftLocation.addressLocality || draftLocation.streetAddress}</span>
                                <button 
                                    onClick={() => setDraftLocation(null)}
                                    className="absolute right-2 text-emerald-500/50 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        )}

                        <button 
                            onClick={() => onNavigate('theMatrix')}
                            className="flex-1 min-w-[140px] h-9 px-4 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-xs font-bold text-cyan-400 transition-all flex items-center justify-center gap-2 shadow-sm"
                            title="Open Global Matrix"
                        >
                            <Grid size={14} />
                            GLOBAL MATRIX
                        </button>

                        <button 
                            onClick={handleCreateEvent} 
                            className="flex-1 min-w-[120px] h-9 px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                        >
                            EDIT DETAILS
                        </button>

                        <button 
                            onClick={handleQuickLog} 
                            disabled={!wdyetText.trim() || isUploading} 
                            className={`flex-1 min-w-[140px] h-9 px-5 rounded-lg flex items-center justify-center gap-2 text-white font-bold text-xs transition-all shadow-lg disabled:opacity-50 disabled:shadow-none group ${
                                prediction ? 'bg-violet-600 hover:bg-violet-500 shadow-violet-900/20 border-violet-500' : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/20 border-cyan-500'
                            } border`}
                            title="Stage Memory to Shoebox for Review"
                        >
                            {isUploading ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <>
                                    <span className="tracking-[0.1em]">{prediction ? 'NEURAL STAGE' : 'STAGING'}</span>
                                    {prediction ? <Sparkles size={14} /> : <Wand2 size={14} />}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* --- SHOEBOX RESONANCE BENTO GRID --- */}
                <div className="hidden lg:flex flex-col w-[300px] xl:w-[350px] gap-4 shrink-0 h-full">
                    
                    {/* Bento Tile 1: Shoebox Ticker */}
                    <div className="flex-1 min-h-[150px] bg-gradient-to-br from-amber-950/40 to-black backdrop-blur-xl rounded-2xl border border-amber-500/20 p-4 flex flex-col group hover:border-amber-500/40 transition-colors relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors pointer-events-none"></div>
                        <div className="flex items-center justify-between mb-3 relative z-10">
                            <div className="flex items-center gap-2 group/tooltip relative">
                                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-2 cursor-help">
                                    <Database size={12} />
                                    Shoebox Ticker
                                </span>
                                <div className="absolute top-full left-0 mt-1 w-48 p-2 bg-slate-900 border border-amber-500/30 rounded shadow-xl text-[10px] text-slate-300 opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-50 pointer-events-none">
                                    Displays pending items lacking metadata (e.g., 1970 timestamp).
                                </div>
                            </div>
                            <button 
                                onClick={() => onNavigate('theMatrix', { view: 'shoebox' })} 
                                className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black transition-colors"
                                title="Open Sovereign Shoebox"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                        <div className="flex-1 flex flex-col relative mt-2 min-h-[120px]">
                            {shoeboxItems.length > 0 ? (
                                <div className="grid grid-cols-3 grid-rows-2 gap-2 absolute inset-0">
                                    {shoeboxItems.map(item => (
                                        <div 
                                            key={item.id} 
                                            onClick={() => onNavigate('theMatrix', { mediaId: item.id })} 
                                            className="w-full h-full rounded-lg border border-amber-900/50 overflow-hidden relative cursor-pointer hover:z-20 hover:scale-[1.15] hover:border-amber-400 hover:shadow-[0_10px_20px_rgba(0,0,0,0.8)] transition-all duration-300 group/thumb" 
                                            title="View Artifact"
                                        >
                                            <div className="absolute inset-0 bg-amber-500/10 mix-blend-overlay group-hover/thumb:opacity-0 transition-opacity"></div>
                                            <img src={item.thumbnailUrl || item.url} alt="Shoebox Artifact" className="w-full h-full object-cover grayscale-[0.2] group-hover/thumb:grayscale-0 transition-all" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <p className="text-xs text-slate-500 text-center leading-relaxed">
                                        Your shoebox is empty. All artifacts are filed.
                                    </p>
                                </div>
                            )}
                        </div>
                        {shoeboxCount > 6 && (
                            <p className="text-[10px] text-amber-500/50 mt-3 text-center font-mono">+{shoeboxCount - 6} MORE ARCHIVED</p>
                        )}
                    </div>

                    {/* Bento Tile 2: Temporal Echo */}
                    <div className="flex-1 min-h-[150px] bg-gradient-to-br from-indigo-950/40 to-black backdrop-blur-xl rounded-2xl border border-indigo-500/20 p-4 flex flex-col group hover:border-indigo-500/40 transition-colors relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none"></div>
                        <div className="flex items-center justify-between mb-3 relative z-10">
                            <div className="flex items-center gap-2 group/tooltip relative">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 cursor-help">
                                    <Calendar size={12} />
                                    Temporal Echo
                                </span>
                                <div className="absolute top-full left-0 mt-1 w-48 p-2 bg-slate-900 border border-indigo-500/30 rounded shadow-xl text-[10px] text-slate-300 opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-50 pointer-events-none">
                                    Resurfaces media from this exact day in previous years.
                                </div>
                            </div>
                            {randomTemporalEcho && (
                                <span className="text-[10px] font-mono text-indigo-300/50 bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/20">
                                    {new Date(randomTemporalEcho.logicalDate!).getFullYear()}
                                </span>
                            )}
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                            {randomTemporalEcho ? (
                                <div 
                                    className="flex items-center gap-3 cursor-pointer group/echo"
                                    onClick={() => onNavigate('theMatrix', { mediaId: randomTemporalEcho.id })}
                                    title="Explore Temporal Echo"
                                >
                                    <div className="w-16 h-16 rounded-lg border border-indigo-500/30 overflow-hidden shrink-0 group-hover/echo:border-indigo-400 group-hover/echo:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">
                                        <img src={randomTemporalEcho.thumbnailUrl || randomTemporalEcho.url} className="w-full h-full object-cover" alt="Echo" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold text-slate-300 group-hover/echo:text-white truncate">
                                            {randomTemporalEcho.title || "On this day..."}
                                        </span>
                                        <span className="text-[10px] text-slate-500 line-clamp-2 mt-1">
                                            {randomTemporalEcho.caption || randomTemporalEcho.description || "A forgotten moment resurfaces in the neural stream."}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 text-center leading-relaxed">
                                    No historical resonance detected for today's date.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Bento Tile 3: Muse Protocol */}
                    <div 
                        className="min-h-[100px] bg-gradient-to-br from-emerald-950/40 to-black backdrop-blur-xl rounded-2xl border border-emerald-500/20 p-4 flex flex-col group hover:border-emerald-500/40 transition-colors relative overflow-hidden cursor-pointer shadow-lg"
                        onClick={() => {
                            const hasTags = recentTags && recentTags.length > 0;
                            const recentTag = hasTags ? recentTags[0].name : '';
                            const prompts = [
                                hasTags ? `Reflecting on "${recentTag}", what unresolved technical debt or emotional resonance is taking up your cache today?` : `What unresolved technical debt or emotional resonance is taking up your cache today?`,
                                `You have ${eventCount} events logged. What pattern are you noticing in your behavior right now?`,
                                media.length > 0 ? `Look at your recent media capture. What is the unspoken context behind it?` : `What context is missing from your recent logs?`,
                                `If ${aiName || 'the system'} were to summarize your week, what would the anomaly report say?`,
                                `You've been tracking ${tags.length} different narrative threads. Which one needs closure?`
                            ];
                            const prompt = prompts[Math.floor(Math.random() * prompts.length)];
                            setWdyetText(prev => prev ? `${prev}\n\n[MUSE]: ${prompt}` : `[MUSE]: ${prompt}`);
                        }}
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none"></div>
                        <div className="flex items-center justify-between mb-2 relative z-10">
                            <div className="flex items-center gap-2">
                                <Sparkles size={12} className="text-emerald-400 group-hover:animate-spin" />
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                    Muse Protocol
                                </span>
                            </div>
                            <span className="text-[10px] font-mono text-emerald-300/50 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                CLICK TO INSERT
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 italic flex-1 flex items-center relative z-10 leading-relaxed group-hover:text-white transition-colors">
                            Dynamic narrative prompt injection active. Click to draw from the current context.
                        </p>
                        
                        {/* Custom Tooltip */}
                        <div className="absolute top-full left-0 mt-2 w-full p-2 bg-slate-900 border border-emerald-500/30 rounded shadow-xl text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-center">
                            Injects a targeted narrative prompt into your draft to stimulate reflection.
                        </div>
                    </div>
                </div>
            </div>

            {/* Overlays */}
            {showMatrixPicker && (
                <MatrixSelector 
                    userId={user.id} 
                    onClose={() => setShowMatrixPicker(false)} 
                    onSelect={handleMatrixSelect}
                    title="Select from Matrix"
                />
            )}

            {isImportModalOpen && (
                <ImportModal 
                    isOpen={isImportModalOpen}
                    step={importStep} 
                    errorMsg={errorMsg} 
                    onLaunch={startImport}
                    onCancel={cancelImport} 
                    onConnect={handleConnect} 
                />
            )}


        </div>
        </ShimmerWindow>
    );
};

export default ComposerCard;
