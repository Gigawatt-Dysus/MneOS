import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Grid, List, User, Tag as TagIcon, MapPin, Package, Calendar, Dog, Edit, MessageSquare, Trash2, Plus, Loader2, Hash, Filter, Globe, Ghost, Brain } from 'lucide-react';
import type { Tag, Media, PersonTag, User as GIGIUser } from '../types';
import { GlassAvatar } from './GlassAvatar';
import { GlassButton } from './GlassButton';
import { TagDetailModal } from './TagDetailModal';
import { SocialDiscoveryModal } from './SocialDiscoveryModal';
import { SubHeader, SubHeaderAction } from './SubHeader';
import TapestryView from './TapestryView'; // [ZEN UPDATE] Moved here
import { Network } from 'lucide-react'; // [ZEN UPDATE] Icon for Family Tree
import { GedcomInspector } from './gedcom/GedcomInspector'; // [ZEN] V'Ger Shield
import { VantablackShield } from './VantablackShield'; // [ZEN V32]
import VantablackConfirmModal from './VantablackConfirmModal'; // [ZEN V32]
import { appDataService } from '../services/serviceManager'; // [ZEN V32]
import { formatFullName } from '../utils/formatters';
import { AzNavigator } from './AzNavigator';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { TagTypePicker } from './TagTypePicker'; // [ZEN] Type-gated create flow

interface TagGalleryProps {
    tags: Tag[];
    media: Media[];
    tagBeingDeleted: string | null;
    onEditTag: (tag: Tag, tab?: string) => void;
    // [ZEN] Updated signature: type is selected in TagTypePicker before TagEditor opens.
    onCreateTag: (type: Tag['type']) => void;
    onDeleteTag: (id: string) => void;
    onReplaceTag: (tag: Tag) => void;
    onDiscuss: (tag: Tag) => void;
    userPersonTagId?: string;
    currentUser?: GIGIUser | null;
    addToast: (msg: string, type: 'success' | 'error') => void;
    onMediaClick?: (media: Media) => void; // [ZEN] Interconnectedness
    initialTagId?: string;
    clearInitialTagId?: () => void;
    onNavigate?: (view: any, data?: any) => void;
    returnTo?: string;
}

const FAMILY_TYPES = new Set(['spouse', 'partner', 'husband', 'wife', 'ex-wife', 'ex-husband', 'child', 'son', 'daughter', 'step-child', 'parent', 'mother', 'father', 'mom', 'dad', 'step-father', 'step-mother', 'sibling', 'brother', 'sister', 'half-brother', 'half-sister']);
const RELATIVE_TYPES = new Set(['grandparent', 'grandmother', 'grandfather', 'great-grandparent', 'great-grandmother', 'great-grandfather', 'grandchild', 'grandson', 'granddaughter', 'great-grandchild', 'aunt', 'uncle', 'great-aunt', 'great-uncle', 'niece', 'nephew', 'cousin', 'relative', 'in-law']);
const FRIEND_TYPES = new Set(['friend', 'best friend', 'childhood friend', 'colleague', 'manager', 'mentor']);

const getTagColor = (type: Tag['type']) => {
    switch (type) {
        case 'person': return 'bg-blue-600';
        case 'pet': return 'bg-purple-600';
        case 'place': return 'bg-emerald-600';
        case 'thing': return 'bg-yellow-500';
        case 'event': return 'bg-rose-500';
        case 'concept': return 'bg-indigo-600';
        case 'context': return 'bg-slate-700';
        default: return 'bg-slate-600';
    }
};

const getTagGlow = (type: Tag['type']) => {
    switch (type) {
        case 'person': return 'border-blue-500/40 shadow-[0_0_15px_rgba(37,99,235,0.25)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] hover:border-blue-400/80';
        case 'pet': return 'border-purple-500/40 shadow-[0_0_15px_rgba(147,51,234,0.25)] hover:shadow-[0_0_25px_rgba(147,51,234,0.6)] hover:border-purple-400/80';
        case 'place': return 'border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:shadow-[0_0_25px_rgba(16,185,129,0.6)] hover:border-emerald-400/80';
        case 'thing': return 'border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.25)] hover:shadow-[0_0_25px_rgba(234,179,8,0.6)] hover:border-yellow-400/80';
        case 'event': return 'border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.25)] hover:shadow-[0_0_25px_rgba(244,63,94,0.6)] hover:border-rose-400/80';
        case 'concept': return 'border-indigo-500/40 shadow-[0_0_15px_rgba(79,70,229,0.25)] hover:shadow-[0_0_25px_rgba(79,70,229,0.6)] hover:border-indigo-400/80';
        case 'context': return 'border-slate-500/40 shadow-[0_0_15px_rgba(100,116,139,0.25)] hover:shadow-[0_0_25px_rgba(100,116,139,0.6)] hover:border-slate-400/80';
        default: return 'border-white/20 shadow-lg hover:border-cyan-500/50 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]';
    }
};

const getRelationshipLabel = (tag: Tag) => tag.type.toUpperCase();

const getDisplayName = (tag: Tag) => {
    if (tag.type === 'person') {
        const p = tag as PersonTag;
        const m = p.metadata;
        return m?.displayName?.trim() || m?.alternateName?.trim() || m?.givenName?.trim() || p.name;
    }
    return tag.name;
};

const getSortKey = (tag: Tag) => {
    if (tag.type === 'person') {
        const p = tag as PersonTag;
        return (p.metadata?.displayName || p.name).toLowerCase();
    }
    return tag.name.toLowerCase();
};

export const TagGallery: React.FC<TagGalleryProps> = ({
    tags, media, tagBeingDeleted, onEditTag, onCreateTag, onDeleteTag, onDiscuss, userPersonTagId, currentUser, addToast, onReplaceTag, initialTagId, clearInitialTagId, onMediaClick, onNavigate, returnTo
}) => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (sessionStorage.getItem('gigi_tag_gallery_viewMode') as any) || 'grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>(() => sessionStorage.getItem('gigi_tag_gallery_filter') || 'all');
    const [personFilter, setPersonFilter] = useState<'all' | 'family' | 'relatives' | 'friends' | 'others'>(() => (sessionStorage.getItem('gigi_tag_gallery_personFilter') as any) || 'all');
    const [vitalsFilter, setVitalsFilter] = useState<'all' | 'living' | 'deceased'>(() => (sessionStorage.getItem('gigi_tag_gallery_vitalsFilter') as any) || 'all'); 
    const [fictionalFilter, setFictionalFilter] = useState<'all' | 'reality' | 'fictional'>(() => (sessionStorage.getItem('gigi_tag_gallery_fictionalFilter') as any) || 'all');
    const [universeFilter, setUniverseFilter] = useState<string>(() => sessionStorage.getItem('gigi_tag_gallery_universeFilter') || 'all');

    useEffect(() => sessionStorage.setItem('gigi_tag_gallery_viewMode', viewMode), [viewMode]);
    useEffect(() => sessionStorage.setItem('gigi_tag_gallery_filter', filterType), [filterType]);
    useEffect(() => sessionStorage.setItem('gigi_tag_gallery_personFilter', personFilter), [personFilter]);
    useEffect(() => sessionStorage.setItem('gigi_tag_gallery_vitalsFilter', vitalsFilter), [vitalsFilter]);
    useEffect(() => sessionStorage.setItem('gigi_tag_gallery_fictionalFilter', fictionalFilter), [fictionalFilter]);
    useEffect(() => sessionStorage.setItem('gigi_tag_gallery_universeFilter', universeFilter), [universeFilter]);


    const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
    const [tagConfirmDeleteId, setTagConfirmDeleteId] = useState<string | null>(null); // [ZEN] Safe deletion popover
    const [showTypePicker, setShowTypePicker] = useState(false); // [ZEN] Type-gated create flow

    // [ZEN NAVIGATION] Auto-open specific tag if requested
    useEffect(() => {
        if (initialTagId && tags.length > 0) {
            const found = tags.find(t => t.id === initialTagId);
            if (found) {
                setSelectedTag(found);
                if (clearInitialTagId) clearInitialTagId();
            }
        }
    }, [initialTagId, tags, clearInitialTagId]);
    const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
    const [showTapestry, setShowTapestry] = useState(false);
    const [showControlPanel, setShowControlPanel] = useState(false); // [ZEN] SpaceX Overhaul
    const [showInspector, setShowInspector] = useState(false); // [ZEN] V'Ger Shield State
    const [inspectedTag, setInspectedTag] = useState<PersonTag | null>(null); // [ZEN] V'Ger Context Persistance
    const [pendingBulkMode, setPendingBulkMode] = useState<'white' | 'grey' | 'black' | null>(null); // [ZEN V32] Confirm Modal
    const [syncingTags, setSyncingTags] = useState<Set<string>>(new Set()); // [ZEN V32] Tags currently syncing
    const [syncedTags, setSyncedTags] = useState<Set<string>>(new Set()); // [ZEN V32] Tags that just synced (checkmark)
    const scrollContainerRef = useRef<HTMLDivElement>(null); // [ZEN V32] Scroll position preservation

    // [ZEN INFINITE SCROLL] High-Performance rendering: load 24 cards initially
    const [visibleCount, setVisibleCount] = useState(24);

    const filteredTags = useMemo(() => {
        const filtered = tags.filter(tag => {
            const display = getDisplayName(tag).toLowerCase();
            const real = tag.name.toLowerCase();
            const q = searchQuery.toLowerCase();
            const matchesSearch = display.includes(q) || real.includes(q);

            let matchesType = false;
            if (filterType === 'all') {
                matchesType = tag.type !== 'context';
            } else {
                matchesType = tag.type === filterType;
            }

            if (matchesType && filterType === 'person' && personFilter !== 'all') {
                if (userPersonTagId && tag.id === userPersonTagId) return false;
                const relationships = (tag as PersonTag).metadata?.relationships || [];
                const hasRel = (types: Set<string>) => relationships.some(r => types.has(r.type.toLowerCase()));

                if (personFilter === 'family' && !hasRel(FAMILY_TYPES)) return false;
                if (personFilter === 'relatives' && !hasRel(RELATIVE_TYPES)) return false;
                if (personFilter === 'friends' && !hasRel(FRIEND_TYPES)) return false;
                if (personFilter === 'others') {
                    if (hasRel(FAMILY_TYPES) || hasRel(RELATIVE_TYPES) || hasRel(FRIEND_TYPES)) return false;
                }
            }

            // [ZEN] Vitals Filter Logic
            if (tag.type === 'person') {
                const isDeceased = (tag as PersonTag).metadata?.isDeceased || false;
                if (vitalsFilter === 'living' && isDeceased) return false;
                if (vitalsFilter === 'deceased' && !isDeceased) return false;
            } else if (vitalsFilter === 'deceased') {
                // If we are looking for DECEASED, non-people are irrelevant
                return false;
            }

            // [ZEN] Fictional Filter Logic
            if (fictionalFilter === 'reality' && tag.isFiction) return false;
            if (fictionalFilter === 'fictional' && !tag.isFiction) return false;

            // [ZEN] Universe Filter Logic
            if (universeFilter !== 'all') {
                if (!tag.universeIds || !tag.universeIds.includes(universeFilter)) return false;
            }

            return matchesSearch && matchesType;
        });

        return filtered.sort((a, b) => {
            if (filterType === 'all') {
                const typeCompare = a.type.localeCompare(b.type);
                if (typeCompare !== 0) return typeCompare;
            }
            const keyA = getSortKey(a);
            const keyB = getSortKey(b);
            return keyA.localeCompare(keyB);
        });

    }, [tags, searchQuery, filterType, personFilter, vitalsFilter, fictionalFilter, universeFilter, userPersonTagId]);

    const availableLetters = useMemo(() => {
        const letters = new Set<string>();
        filteredTags.forEach(tag => {
            const letter = getSortKey(tag).charAt(0).toUpperCase();
            if (letter && /[A-Z0-9]/.test(letter)) {
                letters.add(letter);
            }
        });
        return Array.from(letters).sort();
    }, [filteredTags]);

    const availableUniverses = useMemo(() => {
        const u = new Set<string>();
        tags.forEach(tag => {
            if (tag.universeIds && Array.isArray(tag.universeIds)) {
                tag.universeIds.forEach(id => u.add(id));
            }
        });
        return Array.from(u).sort();
    }, [tags]);

    // Reset visible count when any filter changes to keep response snappy
    useEffect(() => {
        setVisibleCount(24);
    }, [searchQuery, filterType, personFilter, vitalsFilter, fictionalFilter, universeFilter]);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop - clientHeight < 400) {
            setVisibleCount(prev => Math.min(filteredTags.length, prev + 24));
        }
    }, [filteredTags.length]);

    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    // Handle jumping in spine by dynamically scaling up visible items so the target anchor is loaded
    const handleAzJump = useCallback((letter: string) => {
        const index = filteredTags.findIndex(t => getSortKey(t).charAt(0).toUpperCase() === letter);
        if (index !== -1) {
            setVisibleCount(prev => Math.max(prev, index + 24));
        }
    }, [filteredTags]);

    // [ZEN V32] Shield Logic with Rollback + Scroll Preservation
    const handleSingleShieldUpdate = async (tag: Tag, newMode: 'white' | 'grey' | 'black') => {
        if (!currentUser?.id) return;
        const previousMode = tag.exposure_mode || 'white'; // Save for rollback

        // 0. Preserve scroll position
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;

        // 1. Mark as syncing
        setSyncingTags(prev => new Set(prev).add(tag.id));

        // 2. Optimistic UI update
        onReplaceTag({ ...tag, exposure_mode: newMode });

        // 2b. Restore scroll immediately after state update
        requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollTop;
            }
        });

        try {
            // 3. Background write
            await appDataService.updateTagsExposureModeBulk(currentUser.id, [tag.id], newMode);

            // 4. Success: Show checkmark briefly
            setSyncingTags(prev => { const n = new Set(prev); n.delete(tag.id); return n; });
            setSyncedTags(prev => new Set(prev).add(tag.id));
            setTimeout(() => setSyncedTags(prev => { const n = new Set(prev); n.delete(tag.id); return n; }), 1500);
        } catch (e) {
            // 5. Rollback on failure
            console.error("Shield Update Failed", e);
            setSyncingTags(prev => { const n = new Set(prev); n.delete(tag.id); return n; });
            onReplaceTag({ ...tag, exposure_mode: previousMode }); // Snap back
            // Restore scroll after rollback
            requestAnimationFrame(() => {
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.scrollTop = scrollTop;
                }
            });
            addToast("Shield sync failed! Check connection.", 'error');
        }
    };

    const handleBulkShutter = async (mode: 'white' | 'grey' | 'black') => {
        if (!currentUser?.id || filteredTags.length === 0) return;
        setPendingBulkMode(mode); // Open the confirmation modal
    };

    const executeBulkShutter = async () => {
        if (!pendingBulkMode || !currentUser?.id) return;
        const mode = pendingBulkMode;
        const affectedTags = [...filteredTags]; // Snapshot for rollback
        const previousModes = new Map(affectedTags.map(t => [t.id, t.exposure_mode || 'white']));
        setPendingBulkMode(null); // Close modal

        addToast(`Engaging Shutter: ${mode.toUpperCase()} on ${affectedTags.length} items...`, 'success');

        // Mark all as syncing
        setSyncingTags(prev => new Set([...prev, ...affectedTags.map(t => t.id)]));

        // Optimistic Bulk
        affectedTags.forEach(t => onReplaceTag({ ...t, exposure_mode: mode }));

        try {
            const ids = affectedTags.map(t => t.id);
            await appDataService.updateTagsExposureModeBulk(currentUser.id, ids, mode);

            // Success: Clear syncing, show synced
            setSyncingTags(new Set());
            setSyncedTags(new Set(ids));
            addToast("Shutter Protocol Complete.", 'success');
            setTimeout(() => setSyncedTags(new Set()), 2000);
        } catch (e) {
            console.error("Bulk Shutter Failed", e);
            setSyncingTags(new Set());
            // Rollback all
            affectedTags.forEach(t => onReplaceTag({ ...t, exposure_mode: previousModes.get(t.id) || 'white' }));
            addToast("Shutter sync failed! Rolling back...", 'error');
        }
    };

    const getTagImage = (tag: Tag) => {
        if (tag.mainImageId) {
            const found = media.find(m => m.id === tag.mainImageId);
            if (found) return found.thumbnailUrl || found.url || found.base64Data;
        }
        const related = media.find(m => m.tagIds?.includes(tag.id) && m.fileType && m.fileType.startsWith('image'));
        return related ? (related.thumbnailUrl || related.url || related.base64Data) : null;
    };

    const TagCard = ({ tag }: { tag: Tag }) => {
        const imageUrl = getTagImage(tag);
        const isDeleting = tagBeingDeleted === tag.id;
        const displayName = getDisplayName(tag);
        const isLostPlace = tag.type === 'place' && (tag.metadata as any)?.isLost;

        const hasActiveSim = null; // [ZEN] Temporarily disabled to prevent N+1 API request storms

        return (
            <div
                onClick={() => !isDeleting && setSelectedTag(tag)}
                className={`bg-black/60 border rounded-xl overflow-hidden transition-all duration-300 group cursor-pointer relative flex flex-col h-full backdrop-blur-md ${getTagGlow(tag.type)} ${isDeleting ? 'opacity-50 pointer-events-none' : ''} ${isLostPlace ? 'grayscale-[0.3] sepia-[0.2]' : ''}`}
            >
                {/* [ZEN V32] Vantablack Shield (Top Right) */}
                <div className="absolute top-2 right-2 z-20 flex flex-col gap-2 items-end">
                    <VantablackShield
                        mode={tag.exposure_mode || 'white'}
                        onChange={(newMode) => handleSingleShieldUpdate(tag, newMode)}
                        syncState={syncingTags.has(tag.id) ? 'syncing' : syncedTags.has(tag.id) ? 'synced' : 'idle'}
                    />
                    {tag.pendingInferences && (
                        <div className="bg-amber-500/10 text-amber-400 p-1.5 rounded-full border border-amber-500/30 animate-pulse shadow-lg" title="Pending AI Inferences (Quarantined)">
                            <Brain size={14} />
                        </div>
                    )}
                    {isLostPlace && (
                        <div className="bg-amber-900/80 text-amber-200 p-1.5 rounded-full border border-amber-500/30 animate-pulse shadow-lg" title="Lost Settlement">
                            <Ghost size={14} />
                        </div>
                    )}
                </div>

                <div className={`h-24 ${isLostPlace ? 'bg-[#2a261f]' : getTagColor(tag.type)} relative overflow-hidden`}>
                    {imageUrl ? (
                        <>
                            <img src={imageUrl} alt="" loading="lazy" className={`w-full h-full object-cover opacity-30 blur-sm ${isLostPlace ? 'grayscale' : ''}`} />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80"></div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                            {isLostPlace ? <Ghost size={64} /> : tag.type === 'concept' ? <Brain size={64} /> : <TagIcon size={64} />}
                        </div>
                    )}
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onClick={(e) => { e.stopPropagation(); setTagConfirmDeleteId(tag.id); }} className="p-1.5 bg-black/50 text-red-400 rounded-full hover:bg-red-900/80"><Trash2 size={14} /></button>
                    </div>
                </div>

                <div className="p-4 pt-16 relative flex-1 flex flex-col">
                    <div className="absolute -top-16 left-4 z-10">
                        <GlassAvatar
                            imageUrl={imageUrl}
                            altText={displayName}
                            fallbackChar={displayName}
                            size="w-32 h-32"
                            className={`shadow-xl border-4 border-black text-5xl font-bold ${isLostPlace ? 'grayscale-[0.4] sepia-[0.3]' : ''}`}
                        />
                    </div>

                    <div className="absolute top-3 right-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border tracking-wider uppercase ${isLostPlace ? 'text-amber-500 bg-amber-950/50 border-amber-500/30' : 'text-slate-500 bg-black/50 border-white/10'}`}>
                            {isLostPlace ? 'Lost Settlement' : tag.type === 'concept' ? `CONCEPT: ${((tag as any).metadata?.flavor || 'General').toUpperCase()}` : getRelationshipLabel(tag)}
                        </span>
                    </div>

                    <div className="mb-4 mt-2">
                        <h3 className={`text-lg font-bold leading-tight mb-1 truncate ${isLostPlace ? 'text-amber-100' : 'text-white'}`} title={tag.name}>{displayName}</h3>
                        <p className={`text-xs line-clamp-2 ${isLostPlace ? 'text-amber-200/50' : 'text-slate-400'}`}>{tag.description || "No description."}</p>
                    </div>

                    <div className={`mt-auto flex gap-2 pt-3 border-t ${isLostPlace ? 'border-amber-900/30' : 'border-white/5'}`}>
                        <GlassButton
                            onClick={(e) => { e.stopPropagation(); onDiscuss(tag); }}
                            variant="secondary"
                            className={`flex-1 text-xs ${isLostPlace ? 'bg-amber-900/20 border-amber-900/30 text-amber-200 hover:bg-amber-900/40' : ''}`}
                            title={`Chat with ${displayName} in the Neural Node`}
                        >
                            <MessageSquare size={14} /> Chat
                        </GlassButton>
                        <GlassButton
                            onClick={(e) => { e.stopPropagation(); onEditTag(tag); }}
                            variant="secondary"
                            className={`flex-1 text-xs ${isLostPlace ? 'bg-amber-900/20 border-amber-900/30 text-amber-200 hover:bg-amber-900/40' : ''}`}
                            title={`Modify ${displayName}'s intelligence record`}
                        >
                            <Edit size={14} /> Edit
                        </GlassButton>
                        {tag.type === 'person' && !isLostPlace && (
                            <GlassButton
                                onClick={(e) => { e.stopPropagation(); onEditTag(tag, 'simulacrum'); }}
                                variant={hasActiveSim ? "primary" : "secondary"}
                                className={`flex-1 text-xs ${hasActiveSim ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400/50' : ''}`}
                                title={hasActiveSim ? `Resume active Simulacrum for ${displayName}` : `Launch new Simulacrum for ${displayName}`}
                            >
                                <Brain size={14} /> {hasActiveSim === true ? 'Resume Sim' : 'Launch Sim'}
                            </GlassButton>
                        )}
                    </div>
                </div>

                {isDeleting && (
                    <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center text-red-500">
                        <Loader2 className="animate-spin mb-2" /> Deleting...
                    </div>
                )}
            </div>
        );
    };

    return (
        // [ZEN FIX] Removed redundant pt-10 that was causing excess gap on mobile
        <div className="h-full flex flex-col overflow-hidden relative">
            <SubHeader
                left={
                    <div className="flex items-center gap-6">
                        {/* [ZEN] Minimalist SpaceX Search */}
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search Matrix..."
                                title="Filter through all known entities"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:border-cyan-500/50 focus:bg-black/60 outline-none w-48 sm:w-64 transition-all sm:focus:w-80 shadow-inner"
                            />
                        </div>

                        {/* [ZEN] Compact Type Scrubber */}
                        <div className="hidden lg:flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1 shadow-2xl">
                            {['all', 'person', 'pet', 'place', 'event', 'thing', 'concept', 'context'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => {
                                        setFilterType(type);
                                        if (type !== 'person') setPersonFilter('all');
                                    }}
                                    className={`h-8 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                                        filterType === type 
                                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    {type === 'context' ? 'Keywords' : type}
                                </button>
                            ))}
                        </div>
                    </div>
                }
                right={
                    <div className="flex items-center gap-3">
                        {/* View Modes */}
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 shadow-lg">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Grid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <List size={16} />
                            </button>
                        </div>

                        {/* Network Toggle */}
                        <button
                            onClick={() => setShowTapestry(!showTapestry)}
                            className={`p-2.5 rounded-xl border transition-all ${
                                showTapestry 
                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
                                : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'
                            }`}
                        >
                            <Network size={18} />
                        </button>

                        {/* [ZEN] THE CONTROL PANEL TOGGLE (Funnel) */}
                        <button
                            onClick={() => setShowControlPanel(!showControlPanel)}
                            className={`flex items-center gap-2 px-4 h-10 rounded-xl border transition-all ${
                                showControlPanel 
                                ? 'bg-violet-500/20 border-violet-500/50 text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.2)]' 
                                : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'
                            }`}
                        >
                            <Settings2 size={18} />
                            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Advanced Controls</span>
                            {showControlPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        <div className="h-8 w-px bg-white/10 mx-1"></div>

                        <SubHeaderAction
                            onClick={() => setShowTypePicker(true)}
                            variant="primary"
                            icon={<Plus size={18} />}
                            label="New Tag"
                            className="h-10 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                            title="Create a new Tag — choose a category to begin"
                        />
                    </div>
                }
            />

            {/* [ZEN] SpaceX Advanced Control Tray */}
            <AnimatePresence>
                {showControlPanel && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-black/40 border-b border-white/5 backdrop-blur-2xl"
                    >
                        <div className="px-8 py-6 flex flex-wrap items-center gap-8 animate-in fade-in duration-500">
                            {/* 1. Vantablack Shutter */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Bulk Shutter Protocol</span>
                                <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-xl border border-white/5">
                                    <span className="text-[10px] text-white/50 px-2 font-mono">{filteredTags.length} Targets Selected</span>
                                    <div className="flex gap-1.5">
                                        {([
                                            { id: 'white', label: 'Open', color: 'bg-white text-black' },
                                            { id: 'grey', label: 'Passive', color: 'bg-slate-600 text-white' },
                                            { id: 'black', label: 'Blackout', color: 'bg-black text-white border border-white/20' }
                                        ] as const).map(mode => (
                                            <button
                                                key={mode.id}
                                                onClick={() => handleBulkShutter(mode.id)}
                                                className={`${mode.color} text-[9px] uppercase font-black px-3 py-1.5 rounded-lg hover:scale-105 transition-all shadow-lg`}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 2. Status / Vitals */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Vitality Filter</span>
                                <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 gap-1">
                                    {(['all', 'living', 'deceased'] as const).map((v) => (
                                        <button
                                            key={v}
                                            onClick={() => setVitalsFilter(v)}
                                            className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                                vitalsFilter === v 
                                                ? 'bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]' 
                                                : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 3. Person-Specific Relationships */}
                            {filterType === 'person' && (
                                <div className="flex flex-col gap-2 animate-in slide-in-from-left-4 duration-500">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Neural Connection Type</span>
                                    <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 gap-1">
                                        {[
                                            { id: 'all', label: 'Everyone' },
                                            { id: 'family', label: 'Family' },
                                            { id: 'relatives', label: 'Relatives' },
                                            { id: 'friends', label: 'Friends' },
                                            { id: 'others', label: 'Casual' }
                                        ].map(filter => (
                                            <button
                                                key={filter.id}
                                                onClick={() => setPersonFilter(filter.id as any)}
                                                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                                    personFilter === filter.id 
                                                    ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                                                    : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                            >
                                                {filter.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* [ZEN] Fictional Multiverse Lore Filter */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Ontological Status</span>
                                <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 gap-1">
                                    {[
                                        { id: 'all', label: 'All' },
                                        { id: 'reality', label: 'Reality' },
                                        { id: 'fictional', label: 'Fictional' }
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => {
                                                setFictionalFilter(f.id as any);
                                                if (f.id === 'reality') setUniverseFilter('all'); // Reset universe if returning to reality
                                            }}
                                            className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                                fictionalFilter === f.id 
                                                ? 'bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(192,38,211,0.4)]' 
                                                : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* [ZEN] Universe Filter (Only show if universes exist) */}
                            {availableUniverses.length > 0 && fictionalFilter !== 'reality' && (
                                <div className="flex flex-col gap-2 animate-in slide-in-from-left-4 duration-500">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Universe Designation</span>
                                    <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 gap-1 overflow-x-auto max-w-[300px] custom-scrollbar">
                                        <button
                                            onClick={() => setUniverseFilter('all')}
                                            className={`whitespace-nowrap px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                                universeFilter === 'all' 
                                                ? 'bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(192,38,211,0.4)]' 
                                                : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            Any Universe
                                        </button>
                                        {availableUniverses.map(u => (
                                            <button
                                                key={u}
                                                onClick={() => setUniverseFilter(u)}
                                                className={`whitespace-nowrap px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                                    universeFilter === u 
                                                    ? 'bg-fuchsia-600 text-white shadow-[0_0_15px_rgba(192,38,211,0.4)]' 
                                                    : 'text-slate-500 hover:text-slate-300'
                                                }`}
                                            >
                                                {u}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Discovery Tools */}
                            {filterType === 'person' && currentUser && (
                                <div className="flex flex-col gap-2 ml-auto">
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Global Reach</span>
                                    <button
                                        onClick={() => setIsDiscoveryOpen(true)}
                                        className="flex items-center gap-2 px-6 h-10 rounded-xl border border-cyan-500/30 text-cyan-400 font-black uppercase text-[10px] tracking-widest hover:bg-cyan-500/10 transition-all shadow-lg"
                                    >
                                        <Globe size={16} />
                                        Social Scan
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>


            {/* [ZEN FIX] Added pb-32 to prevent occlusion from the bottom Springboard/Navigation ribbon */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-8 pb-32 custom-scrollbar">
                {showTapestry ? (
                    <div className="h-full w-full animate-in fade-in">
                        <TapestryView />
                    </div>
                ) : filteredTags.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        <div className="w-20 h-20 bg-black/30 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-white/10">
                            <TagIcon size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-400">No {filterType === 'all' ? 'Entities' : filterType} Found</h3>
                        {personFilter !== 'all' && <p className="text-xs text-slate-500 mt-2">(Filter: {personFilter})</p>}
                    </div>
                ) : (
                    <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'grid-cols-1'}`}>
                        {filteredTags.slice(0, visibleCount).map((tag, index) => {
                            const letter = getSortKey(tag).charAt(0).toUpperCase();
                            const prevLetter = index > 0 ? getSortKey(filteredTags[index - 1]).charAt(0).toUpperCase() : '';
                            const isFirstOfLetter = letter !== prevLetter;
                            
                            return (
                                <div key={tag.id} id={isFirstOfLetter ? `az-anchor-${letter}` : undefined} className="h-full">
                                    <TagCard tag={tag} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* [ZEN] High-Tech A-Z Data Spine */}
            {viewMode === 'grid' && !showTapestry && (
                <AzNavigator 
                    availableLetters={availableLetters}
                    scrollContainerRef={scrollContainerRef}
                    onJump={handleAzJump}
                />
            )}


            {selectedTag && (
                <TagDetailModal
                    tag={selectedTag}
                    media={media}
                    onClose={() => {
                        setSelectedTag(null);
                        // [ZEN] Return to Health Monitor if we came from there
                        if (returnTo === 'health' && onNavigate) {
                            onNavigate('health');
                        }
                    }}
                    onEdit={onEditTag}
                    onDiscuss={onDiscuss}
                    onOpenAncestry={(tag) => {
                        setInspectedTag(tag as PersonTag);
                        setShowInspector(true);
                    }}
                    onMediaClick={onMediaClick}
                    allTags={tags}
                    currentUser={currentUser}
                />
            )}

            {/* [ZEN] V'Ger Shield Inspector */}
            {showInspector && inspectedTag && currentUser && (
                <GedcomInspector
                    currentPerson={inspectedTag}
                    user={currentUser}
                    onClose={() => {
                        setShowInspector(false);
                        setInspectedTag(null);
                    }}
                    onUpdateTag={(updatedPerson) => {
                        onReplaceTag(updatedPerson);
                        setInspectedTag(updatedPerson); // Keep local state in sync
                        addToast('Gigi Intelligence Updated', 'success');
                    }}
                />
            )}

            {isDiscoveryOpen && currentUser && (
                <SocialDiscoveryModal
                    isOpen={isDiscoveryOpen}
                    onClose={() => setIsDiscoveryOpen(false)}
                    currentUser={currentUser}
                    onToast={addToast}
                />
            )}

            {/* [ZEN V32] Vantablack Shutter Confirm Modal */}
            {pendingBulkMode && (
                <VantablackConfirmModal
                    mode={pendingBulkMode}
                    count={filteredTags.length}
                    onConfirm={executeBulkShutter}
                    onDismiss={() => setPendingBulkMode(null)}
                />
            )}

            {/* [ZEN] Type-gated Tag creation — portal modal ensures correct z-layering */}
            {showTypePicker && (
                <TagTypePicker
                    onSelect={(type) => {
                        setShowTypePicker(false);
                        onCreateTag(type);
                    }}
                    onClose={() => setShowTypePicker(false)}
                />
            )}

            {/* [ZEN] Safe deletion popover using createPortal to escape all stacking contexts */}
            {tagConfirmDeleteId && createPortal(
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={(e) => { e.stopPropagation(); setTagConfirmDeleteId(null); }}>
                    <div className="w-full max-w-sm bg-slate-900 border border-red-500/40 rounded-2xl shadow-2xl p-6 text-left font-sans select-none animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <p className="text-lg font-bold text-red-400 flex items-center gap-2 mb-2">
                            <Trash2 size={20} /> Prune from Gallery?
                        </p>
                        <p className="text-sm text-slate-300 leading-relaxed mb-6">
                            This will execute a permanent hard-delete and compile an atomic backup entry inside the cryptographic Audit Ledger for <span className="font-bold text-white">{tags.find(t => t.id === tagConfirmDeleteId)?.name || 'this tag'}</span>.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setTagConfirmDeleteId(null); }}
                                className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-all"
                                title="Cancel tag pruning"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    onDeleteTag(tagConfirmDeleteId);
                                    setTagConfirmDeleteId(null);
                                }}
                                className="px-4 py-2 text-xs bg-red-950 border border-red-500/40 text-red-400 hover:bg-red-900 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                                title="Confirm permanent deletion to forensic ledger"
                            >
                                Yes, Purge Entry
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TagGallery;