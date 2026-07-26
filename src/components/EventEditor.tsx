import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Save, Trash2, Calendar, Image as ImageIcon, Tag as TagIcon, Lock, Book, PenTool, ExternalLink, Plus, ChevronDown, Upload, Loader2 } from 'lucide-react';
import type { LifeEvent, Tag, Media, AddressData, GigiJournalEntry, User } from '../types'; 
import { AddressAutocomplete } from './AddressAutocomplete'; 
import { MarkdownEditor } from './shared/MarkdownEditor'; 
import { SmartTagInput } from './tagging/SmartTagInput';
import { appDataService } from '../services/serviceManager';
import GigiLogo from './GigiLogo';
import { formatLifeOSDate } from '../utils/dateSanitizer';
import { uploadFile } from '../services/storageService';
import MatrixSelector from './media/MatrixSelector';
import { geocodingService } from '../services/geocodingService';

interface EventEditorProps {
    event: Partial<LifeEvent>; 
    allTags: Tag[];
    allMedia: Media[];
    linkedEntries?: GigiJournalEntry[]; 
    user: User;
    onSave: (event: LifeEvent) => void;
    onDelete: (id: string) => void;
    onCancel: () => void;
    onCreateTag: (name: string, type: string) => Promise<Tag>;
    onCreateReflection?: (eventId: string) => void; 
}

const EventEditor: React.FC<EventEditorProps> = ({ 
    event, allTags, allMedia, linkedEntries = [], user,
    onSave, onDelete, onCancel, onCreateTag, onCreateReflection 
}) => {
    const [title, setTitle] = useState(event.title || '');
    const [date, setDate] = useState<string>(
        event.date ? new Date(event.date).toISOString() : new Date().toISOString()
    );
    const [details, setDetails] = useState(event.details || '');
    // [ZEN FIX] Repurposed 'privateDetails' as 'Secure Notes'
    const [secureNotes, setSecureNotes] = useState(event.privateDetails || '');
    
    // Auto-tag creator on new Vortex entry
    const [selectedTags, setSelectedTags] = useState<string[]>(() => {
        const isNew = !event.title && (!event.tagIds || event.tagIds.length === 0);
        if (isNew && user.personTagId) {
            return [user.personTagId];
        }
        return event.tagIds || [];
    });
    
    const [attachedMediaIds, setAttachedMediaIds] = useState<string[]>(
        event.mediaIds || (event as any).mediaUrls || [] 
    );
    const [location, setLocation] = useState<AddressData | undefined>(event.location);
    const [datePrecision, setDatePrecision] = useState<'exact' | 'day' | 'month' | 'year' | 'unknown' | 'circa' | 'decade'>(event.datePrecision || 'day');
    const [isPrecisionOpen, setIsPrecisionOpen] = useState(false);
    const [isMediaMenuOpen, setIsMediaMenuOpen] = useState(false);
    const [userPresets, setUserPresets] = useState<any[]>([]);
    
    // Curation states
    const [syncLocationToMedia, setSyncLocationToMedia] = useState(true);
    const [enableTemporalSuggestions, setEnableTemporalSuggestions] = useState<boolean>(() => {
        return localStorage.getItem('gigi_enable_temporal_suggestions') !== 'false';
    });
    const [viewSuggestedOnly, setViewSuggestedOnly] = useState(false);
    
    const [localUploadedMedia, setLocalUploadedMedia] = useState<Media[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchPresets = async () => {
            try {
                const presets = await appDataService.getUserPresets(user.id);
                setUserPresets(presets);
            } catch (e) {
                console.error("[EventEditor] Failed to fetch presets", e);
            }
        };
        fetchPresets();
    }, [user.id]);

    useEffect(() => {
        setTitle(event.title || '');
        setDate(event.date ? new Date(event.date).toISOString() : new Date().toISOString());
        setDetails(event.details || '');
        setSecureNotes(event.privateDetails || '');
        
        // Pre-select creator tag for new events
        const isNew = !event.title && (!event.tagIds || event.tagIds.length === 0);
        if (isNew && user.personTagId) {
            setSelectedTags([user.personTagId]);
        } else {
            setSelectedTags(event.tagIds || []);
        }
        
        setAttachedMediaIds(event.mediaIds || (event as any).mediaUrls || []); 
        setLocation(event.location);
        setDatePrecision(event.datePrecision || 'day');
    }, [event, user.personTagId]);

    // [ZEN] Spatial Context Bridge: Auto-populate location from attached media
    useEffect(() => {
        if (location || attachedMediaIds.length === 0) return;

        const mediaWithLocation = attachedMediaIds
            .map(id => allMedia.find(m => m.id === id) || localUploadedMedia.find(m => m.id === id))
            .filter((m): m is Media => !!m && !!m.location && !!m.location.address);

        if (mediaWithLocation.length > 0) {
            const rawLoc = mediaWithLocation[0].location!;
            const suggestedLoc: AddressData = {
                streetAddress: rawLoc.address || '',
                addressLocality: '',
                addressRegion: '',
                postalCode: '',
                coordinates: (rawLoc.lat && rawLoc.lng) ? { lat: rawLoc.lat, lng: rawLoc.lng } : undefined
            };
            setLocation(suggestedLoc);
            console.log("[EventEditor] Inherited location from media context:", suggestedLoc.streetAddress);
        }
    }, [attachedMediaIds, allMedia, localUploadedMedia, location]);

    // [ZEN] Geolocation Preload: Acquire user device coordinates and reverse-geocode into location state if empty
    useEffect(() => {
        if (location) return; // Do not overwrite existing location context

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
                            setLocation(addrData);
                            console.log("[EventEditor] Geolocation auto-preload success:", addrData);
                        }
                    } catch (err) {
                        console.warn("[EventEditor] Geolocation reverse geocoding failed:", err);
                    }
                },
                (err) => {
                    console.warn("[EventEditor] Geolocation access denied or failed:", err);
                },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        }
    }, [location]);

    // Temporal suggestions logic (Within 30 minutes window)
    const temporalSuggestions = useMemo(() => {
        if (!enableTemporalSuggestions || attachedMediaIds.length === 0) return [];

        const attachedTimes = attachedMediaIds
            .map(id => allMedia.find(m => m.id === id) || localUploadedMedia.find(m => m.id === id))
            .filter((m): m is Media => !!m && !!m.logicalDate)
            .map(m => new Date(m.logicalDate!).getTime())
            .filter(t => !isNaN(t));

        if (attachedTimes.length === 0) return [];

        return allMedia.filter(m => {
            if (attachedMediaIds.includes(m.id)) return false;
            if (m.isAvatar) return false;
            if (!m.logicalDate) return false;
            
            const itemTime = new Date(m.logicalDate).getTime();
            if (isNaN(itemTime)) return false;

            return attachedTimes.some(t => Math.abs(t - itemTime) <= 30 * 60 * 1000);
        });
    }, [attachedMediaIds, allMedia, localUploadedMedia, enableTemporalSuggestions]);

    const addAllSuggestedMedia = () => {
        const newIds = temporalSuggestions.map(m => m.id);
        setAttachedMediaIds(prev => [...prev, ...newIds]);
    };

    const handleSave = async () => {
        if (!title.trim()) return; 

        // [SUPERLUBRICITY] Propagate location to linked media if enabled
        if (location && (location.streetAddress || location.addressLocality) && syncLocationToMedia) {
            // Find matching Place Tag if any
            const matchingPlaceTag = allTags.find(t => {
                if (t.type !== 'place') return false;
                const meta = t.metadata as any;
                
                // Priority 1: Coordinate match
                if (location?.coordinates && meta?.coordinates) {
                    const dist = Math.abs(location.coordinates.lat - meta.coordinates.lat) + 
                                 Math.abs(location.coordinates.lng - meta.coordinates.lng);
                    if (dist < 0.0005) return true;
                }

                // Priority 2: Precise Address Match
                if (meta?.address?.streetAddress === location?.streetAddress) return true;

                // Priority 3: Name Match
                return t.name.toLowerCase() === location?.addressLocality?.toLowerCase();
            });

            // Update attached media database records
            for (const mediaId of attachedMediaIds) {
                const mediaItem = allMedia.find(m => m.id === mediaId) || localUploadedMedia.find(m => m.id === mediaId);
                if (mediaItem) {
                    const hasLocation = mediaItem.location && (mediaItem.location.address || mediaItem.location.lat);
                    const hasPlaceTag = matchingPlaceTag && mediaItem.tagIds && mediaItem.tagIds.includes(matchingPlaceTag.id);
                    
                    let mediaUpdated = false;
                    const updatedMedia = { ...mediaItem };
                    
                    if (!hasLocation) {
                        updatedMedia.location = {
                            address: location.streetAddress || location.addressLocality || '',
                            lat: location.coordinates?.lat,
                            lng: location.coordinates?.lng
                        };
                        mediaUpdated = true;
                    }
                    
                    if (matchingPlaceTag && !hasPlaceTag) {
                        updatedMedia.tagIds = [...(updatedMedia.tagIds || []), matchingPlaceTag.id];
                        mediaUpdated = true;
                    }
                    
                    if (mediaUpdated) {
                        await appDataService.saveMedia(user.id, updatedMedia);
                    }
                }
            }
        }

        const updatedEvent: any = {
            id: event.id || `event-${Date.now()}`, 
            title,
            date: new Date(date), 
            details,
            privateDetails: secureNotes, // Persisting to the privateDetails field
            tagIds: selectedTags,
            mediaIds: attachedMediaIds,
            location,
            datePrecision,
            comments: event.comments || []
        };
        onSave(updatedEvent);
        onCancel();
    };

    const toggleTag = (tagId: string) => setSelectedTags(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
    const toggleMedia = (mediaId: string) => setAttachedMediaIds(prev => prev.includes(mediaId) ? prev.filter(id => id !== mediaId) : [...prev, mediaId]);

    const handleSmartCreateTag = async (name: string, type: string) => {
        const newTag = await onCreateTag(name, type);
        if (newTag) setSelectedTags(prev => [...prev, newTag.id]);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!user?.id) return;
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setIsUploading(true);
        const newAttachments: string[] = [];
        const newMediaObjects: Media[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const { url } = await uploadFile(file, user.id, `event-attachment-${Date.now()}`);
                const newMedia: Media = {
                    id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    url: url,
                    thumbnailUrl: url,
                    caption: file.name,
                    uploadDate: new Date(),
                    fileType: file.type,
                    fileName: file.name,
                    size: file.size,
                    tagIds: selectedTags, // Inherit event tags
                    status: 'provisional',
                    logicalDate: date, // Inherit event date
                    mediaIds: []
                };
                await appDataService.saveMedia(user.id, newMedia);
                newAttachments.push(newMedia.id);
                newMediaObjects.push(newMedia);
            } catch (err) {
                console.error("Direct Upload Failed", err);
            }
        }
        setLocalUploadedMedia(prev => [...prev, ...newMediaObjects]);
        setAttachedMediaIds(prev => [...prev, ...newAttachments]);
        setIsUploading(false);
    };

    const handleMatrixSelect = (selectedMedia: Media[]) => {
        setAttachedMediaIds(selectedMedia.map(m => m.id));
        setIsMediaMenuOpen(false);
    };

    const availableTagsForInput = allTags.filter(t => !selectedTags.includes(t.id));
    const selectedTagObjects = allTags.filter(t => selectedTags.includes(t.id));
    
    const selectedMediaObjects = attachedMediaIds.map(id => {
        const found = allMedia.find(m => m.id === id) || localUploadedMedia.find(m => m.id === id);
        if (found) return found;
        if (id.startsWith('http') || id.startsWith('blob:')) {
            return {
                id, url: id, thumbnailUrl: id, caption: 'Provisional Image',
                uploadDate: new Date(), fileType: 'image/unknown', fileName: 'unknown', size: 0,
                tagIds: [], status: 'provisional', mediaIds: [] 
            } as Media; 
        }
        return null;
    }).filter(Boolean) as Media[];

    return (
        <div className="max-w-5xl mx-auto h-[90vh] mt-4 gigi-breathing-bg rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/40 backdrop-blur-md">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                    {event.id?.startsWith('event-') ? 'Log New Event' : 'Edit Memory'}
                </h2>
                <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                
                {/* Title & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center h-8">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Title</label>
                        </div>
                        <input 
                            type="text" value={title} onChange={e => setTitle(e.target.value)} 
                            placeholder="e.g., Summer Vacation 1999"
                            className="w-full px-4 py-3 rounded-xl border border-white/10 bg-[#1a1d26] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all h-[50px]"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between h-8">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Chronological Index</label>
                            <div className="relative">
                                <button 
                                    onClick={() => setIsPrecisionOpen(!isPrecisionOpen)}
                                    className="flex items-center gap-2 bg-black/40 border border-white/10 text-violet-400 text-[10px] font-black uppercase tracking-[0.1em] rounded-full px-3 py-1.5 hover:border-violet-500/50 transition-all"
                                    title="Select the granularity of the chronological index"
                                >
                                    {datePrecision === 'exact' ? 'Exact Time' : datePrecision === 'day' ? 'Date Only' : datePrecision === 'month' ? 'Month & Year' : 'Year Only'}
                                    <ChevronDown size={10} className={`transition-transform ${isPrecisionOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isPrecisionOpen && (
                                    <div className="absolute right-0 mt-2 w-40 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                                        {(['exact', 'day', 'month', 'year'] as const).map((p) => (
                                            <button
                                                key={p}
                                                onClick={() => { setDatePrecision(p); setIsPrecisionOpen(false); }}
                                                className={`w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-violet-500/20 ${
                                                    datePrecision === p ? 'text-violet-400 bg-violet-500/10' : 'text-slate-500'
                                                }`}
                                            >
                                                {p === 'exact' ? 'Exact' : p === 'day' ? 'Day' : p === 'month' ? 'Month' : 'Year'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="relative">
                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                            <input 
                                type={datePrecision === 'year' ? 'number' : datePrecision === 'month' ? 'month' : datePrecision === 'day' ? 'date' : 'datetime-local'}
                                step={datePrecision === 'exact' ? "1" : undefined}
                                value={
                                    datePrecision === 'year' ? (date ? new Date(date).getFullYear() : '') :
                                    datePrecision === 'month' ? (date ? date.slice(0, 7) : '') :
                                    datePrecision === 'exact' ? (date ? date.slice(0, 19) : '') :
                                    (date ? date.slice(0, 10) : '')
                                } 
                                onChange={e => {
                                    const val = e.target.value;
                                    if (!val) return;
                                    
                                    if (datePrecision === 'year') {
                                        setDate(new Date(`${val}-01-01T12:00:00`).toISOString());
                                    } else if (datePrecision === 'month') {
                                        setDate(new Date(`${val}-01T12:00:00`).toISOString());
                                    } else if (datePrecision === 'day') {
                                        setDate(new Date(`${val}T12:00:00`).toISOString());
                                    } else {
                                        setDate(new Date(val).toISOString());
                                    }
                                }} 
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-white/10 bg-[#1a1d26] text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all h-[50px]"
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Details (Public Facts) */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Details (Timeline View)</label>
                    <div className="h-[300px] border border-white/10 rounded-xl bg-[#1a1d26] overflow-hidden">
                        <MarkdownEditor 
                            value={details} 
                            onChange={setDetails} 
                            hideFooter={true} 
                            placeholder="Describe the event facts..."
                            className="h-full w-full"
                            userId={user.id}
                            userPresets={userPresets}
                        />
                    </div>
                </div>

                {/* [ZEN FIX] Secure Notes (The Closet Vault) */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-wider">
                        <Lock size={12} /> Secure Notes (Private)
                    </label>
                    <div className="relative">
                        <textarea 
                            value={secureNotes}
                            onChange={(e) => setSecureNotes(e.target.value)}
                            placeholder="Gate codes, receipts, private medical info, or other sensitive utility data..."
                            className="w-full h-32 px-4 py-3 rounded-xl border border-emerald-900/30 bg-[#0a120a] text-emerald-100 placeholder-emerald-900/50 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all resize-none font-mono text-sm"
                        />
                        <div className="absolute top-3 right-3 text-emerald-900 pointer-events-none">
                            <Lock size={16} />
                        </div>
                    </div>
                </div>

                {/* [ZEN FIX] Journal Entries & Insights (The Nightstand) */}
                <div className="space-y-2 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-violet-400 uppercase tracking-wider">Journal Entries & Insights</label>
                        {event.id && onCreateReflection && (
                            <button 
                                onClick={() => onCreateReflection(event.id!)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-violet-600/20 text-violet-300 hover:bg-violet-600/40 hover:text-white rounded-lg text-xs font-bold transition-all border border-violet-500/30"
                                title="Draft a new journal entry or reflection linked to this event"
                            >
                                <PenTool size={12} /> Write Entry
                            </button>
                        )}
                    </div>
                    
                    {linkedEntries.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                            {linkedEntries.map(entry => {
                                // Fallback: Missing author defaults to AI (Legacy Data)
                                const isAi = !entry.author || entry.author === 'ai'; 
                                return (
                                    <div key={entry.id} className={`flex items-center gap-3 p-3 rounded-xl border ${isAi ? 'bg-black/40 border-white/5' : 'bg-violet-900/10 border-violet-500/20'} group`}>
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isAi ? 'bg-white/5 text-slate-500' : 'bg-violet-500 text-white'}`}>
                                            {isAi ? <GigiLogo size={14} /> : <Book size={14} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-slate-300 truncate group-hover:text-white transition-colors">{entry.title}</h4>
                                            <p className="text-xs text-slate-500 font-mono">
                                                {formatLifeOSDate(entry.creationDate, 'day')} • {isAi ? 'Gigi Insight' : 'Personal Journal'}
                                            </p>
                                        </div>
                                        <ExternalLink size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-6 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center text-slate-600 bg-white/[0.02]">
                            <Book size={24} className="mb-2 opacity-50" />
                            <span className="text-xs">No entries linked to this event yet.</span>
                        </div>
                    )}
                </div>

                {/* Location */}
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Location</label>
                    <div className="bg-[#1a1d26] rounded-xl border border-white/10 p-1">
                        <AddressAutocomplete 
                            value={location || { streetAddress: '', addressLocality: '', addressRegion: '', postalCode: '' }}
                            onChange={setLocation}
                            tags={allTags}
                            userId={user.id}
                        />
                    </div>
                    {location && (location.streetAddress || location.addressLocality) && (
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer pl-1 mt-1">
                            <input 
                                type="checkbox" 
                                checked={syncLocationToMedia} 
                                onChange={(e) => setSyncLocationToMedia(e.target.checked)}
                                className="rounded border-white/10 bg-slate-900 text-cyan-600 focus:ring-cyan-500/50"
                            />
                            <span>Sync this location to all associated media items (unless already set)</span>
                        </label>
                    )}
                </div>

                {/* Tags */}
                <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tags</label>
                    <SmartTagInput 
                        availableTags={availableTagsForInput}
                        onSelectTag={(tag) => toggleTag(tag.id)}
                        onCreateTag={handleSmartCreateTag}
                        placeholder="Search for people, places, or create new context tags..."
                    />
                    <div className="flex flex-wrap gap-2 min-h-[40px]">
                        {selectedTagObjects.length > 0 ? (
                            selectedTagObjects.map(tag => (
                                <span key={tag.id} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1a1d26] text-slate-300 text-sm border border-white/10 shadow-sm animate-in fade-in zoom-in-95">
                                    <TagIcon className="w-3 h-3 text-cyan-500" />
                                    {tag.name}
                                    <button onClick={() => toggleTag(tag.id)} className="hover:text-red-400 ml-1 transition-colors"><X className="w-3 h-3" /></button>
                                </span>
                            ))
                        ) : (
                            <div className="text-slate-600 text-xs italic py-2 flex items-center gap-2 opacity-50">
                                <TagIcon size={12} /> No tags selected yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Media */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Associated Media</label>
                            {!enableTemporalSuggestions && (
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setEnableTemporalSuggestions(true);
                                        localStorage.setItem('gigi_enable_temporal_suggestions', 'true');
                                    }}
                                    className="text-[9px] font-black text-slate-600 hover:text-cyan-500 uppercase tracking-wider transition-colors ml-2"
                                >
                                    Enable Series Scanner
                                </button>
                            )}
                        </div>
                        <div className="flex gap-4">
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()} 
                                disabled={isUploading}
                                className="text-xs font-bold text-emerald-500 hover:text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider disabled:opacity-50 transition-colors"
                                title="Upload new files from local storage to attach to this event"
                            >
                                {isUploading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Upload className="w-3.5 h-3.5" />
                                )}
                                <span>{isUploading ? 'Uploading...' : 'Upload Media'}</span>
                            </button>
                            <button 
                                type="button"
                                onClick={() => setIsMediaMenuOpen(true)} 
                                className="text-xs font-bold text-violet-500 hover:text-violet-400 flex items-center gap-1.5 uppercase tracking-wider transition-colors"
                                title="Select existing media from the Sovereign Matrix gallery to attach to this event"
                            >
                                <Plus className="w-3.5 h-3.5" /> 
                                <span>Add from Matrix</span>
                            </button>
                        </div>
                    </div>

                    {/* Temporal suggestions banner */}
                    {temporalSuggestions.length > 0 && (
                        <div className="p-3 bg-cyan-950/40 border border-cyan-500/20 rounded-xl flex items-center justify-between gap-4 text-xs animate-in slide-in-from-top-2">
                            <span className="text-cyan-300 font-medium flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                                </span>
                                We found {temporalSuggestions.length} other media file{temporalSuggestions.length > 1 ? 's' : ''} from the same timeframe.
                            </span>
                            <div className="flex items-center gap-3 shrink-0">
                                <button 
                                    type="button" 
                                    onClick={addAllSuggestedMedia} 
                                    className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors text-[10px] uppercase tracking-wider"
                                >
                                    Link All
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setViewSuggestedOnly(!viewSuggestedOnly)} 
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all text-[10px] uppercase tracking-wider border ${
                                        viewSuggestedOnly 
                                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' 
                                            : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700'
                                    }`}
                                >
                                    {viewSuggestedOnly ? 'Show All' : 'Inspect'}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setEnableTemporalSuggestions(false);
                                        localStorage.setItem('gigi_enable_temporal_suggestions', 'false');
                                    }} 
                                    className="text-slate-500 hover:text-red-400 font-black uppercase text-[9px] tracking-wider transition-colors ml-1"
                                    title="Disable automatic temporal scanning for related media for this session"
                                >
                                    Bypass
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Suggested Items Inspector */}
                    {viewSuggestedOnly && temporalSuggestions.length > 0 && (
                        <div className="p-3 bg-black/20 border border-white/5 rounded-xl space-y-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Suggested Items Inspector</span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {temporalSuggestions.map(media => (
                                    <div key={media.id} className="relative group aspect-square rounded-lg overflow-hidden border border-white/5 bg-[#12141c]">
                                        <img src={media.thumbnailUrl || media.url} alt="media" className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity" />
                                        <button 
                                            type="button" 
                                            onClick={() => setAttachedMediaIds(prev => [...prev, media.id])} 
                                            className="absolute top-2 right-2 p-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-colors shadow-lg text-[9px] font-bold uppercase tracking-wider"
                                        >
                                            Add
                                        </button>
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1 text-[8px] text-slate-300 truncate">
                                            {media.caption || media.fileName || 'Untitled'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 rounded-xl border border-white/10 bg-[#1a1d26] min-h-[120px]">
                        {selectedMediaObjects.length > 0 ? (
                            selectedMediaObjects.map(media => (
                                <div key={media.id} className="relative group aspect-square rounded-xl overflow-hidden border border-white/10">
                                    <img src={media.thumbnailUrl || media.url} alt="media" className="w-full h-full object-cover" />
                                    <button type="button" onClick={() => toggleMedia(media.id)} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 text-[10px] text-white truncate">
                                        {media.caption || 'No caption'}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full flex flex-col items-center justify-center text-slate-600 italic h-full">
                                <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                                <span>No media attached. Click to select from Matrix or upload a new file.</span>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/5 bg-black/40 backdrop-blur-md flex justify-between items-center">
                {event.id && !event.id.startsWith('event-') ? (
                    <button type="button" onClick={() => onDelete(event.id!)} className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors font-bold text-sm">
                        <Trash2 className="w-4 h-4" /> Delete Event
                    </button>
                ) : <div></div>}
                
                <div className="flex gap-4">
                    <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                        Cancel
                    </button>
                    <button type="button" onClick={handleSave} className="flex items-center gap-2 px-8 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-cyan-900/30 transition-all hover:scale-105">
                        <Save className="w-4 h-4" /> Save & Exit
                    </button>
                </div>
            </div>

            {isMediaMenuOpen && (
                <MatrixSelector
                    userId={user.id}
                    initialSelectedIds={attachedMediaIds}
                    onSelect={handleMatrixSelect}
                    onClose={() => setIsMediaMenuOpen(false)}
                    title="Select Media for Event"
                />
            )}
        </div>
    );
};

export default EventEditor;