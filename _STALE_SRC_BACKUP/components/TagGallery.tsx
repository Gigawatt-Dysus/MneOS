import React, { useState, useMemo } from 'react';
import { Search, Grid, List, User, Tag as TagIcon, MapPin, Package, Calendar, Dog, Edit, MessageSquare, Trash2, Plus, Loader2, Hash, Filter } from 'lucide-react';
import type { Tag, Media, PersonTag } from '@/types';
import { GlassAvatar } from './GlassAvatar';
import { GlassButton } from './GlassButton';
import { TagDetailModal } from './TagDetailModal';

interface TagGalleryProps {
    tags: Tag[];
    media: Media[];
    tagBeingDeleted: string | null;
    onEditTag: (tag: Tag) => void;
    onCreateTag: () => void;
    onDeleteTag: (id: string) => void;
    onReplaceTag: (tag: Tag) => void; 
    onDiscuss: (tag: Tag) => void;
    // [ZEN FIX] New prop to identify "Self"
    userPersonTagId?: string;
}

// --- CONSTANTS ---

const FAMILY_TYPES = new Set([
    'spouse', 'partner', 'husband', 'wife', 'ex-wife', 'ex-husband',
    'child', 'son', 'daughter', 'step-child',
    'parent', 'mother', 'father', 'mom', 'dad', 'step-father', 'step-mother',
    'sibling', 'brother', 'sister', 'half-brother', 'half-sister'
]);

const RELATIVE_TYPES = new Set([
    'grandparent', 'grandmother', 'grandfather',
    'great-grandparent', 'great-grandmother', 'great-grandfather',
    'grandchild', 'grandson', 'granddaughter',
    'great-grandchild',
    'aunt', 'uncle', 'great-aunt', 'great-uncle',
    'niece', 'nephew',
    'cousin', 'relative', 'in-law'
]);

const FRIEND_TYPES = new Set([
    'friend', 'best friend', 'childhood friend',
    'colleague', 'manager', 'mentor'
]);

const getTagColor = (type: Tag['type']) => {
    switch (type) {
        case 'person': return 'bg-blue-600';
        case 'pet': return 'bg-purple-600';
        case 'place': return 'bg-emerald-600';
        case 'thing': return 'bg-yellow-500';
        case 'event': return 'bg-rose-500';
        case 'context': return 'bg-slate-700';
        default: return 'bg-slate-600';
    }
};

const getRelationshipLabel = (tag: Tag) => tag.type.toUpperCase();

const getTagIcon = (type: Tag['type']) => {
    switch (type) {
        case 'person': return <User size={16} />;
        case 'pet': return <Dog size={16} />;
        case 'place': return <MapPin size={16} />;
        case 'thing': return <Package size={16} />;
        case 'event': return <Calendar size={16} />;
        case 'context': return <Hash size={16} />;
        default: return <TagIcon size={16} />;
    }
};

const getDisplayName = (tag: Tag) => {
    if (tag.type === 'person') {
        const p = tag as PersonTag;
        return p.metadata?.alternateName?.trim() || p.name;
    }
    return tag.name;
};

const getSortKey = (tag: Tag) => {
    if (tag.type === 'person') {
        const p = tag as PersonTag;
        const nick = p.metadata?.alternateName?.trim();
        
        if (nick) {
            const last = p.metadata?.familyName?.trim() || '';
            return `${nick} ${last}`.toLowerCase();
        }
        return p.name.toLowerCase();
    }
    return tag.name.toLowerCase();
};

export const TagGallery: React.FC<TagGalleryProps> = ({ 
    tags, media, tagBeingDeleted, onEditTag, onCreateTag, onDeleteTag, onDiscuss, userPersonTagId 
}) => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [personFilter, setPersonFilter] = useState<'all' | 'family' | 'relatives' | 'friends' | 'others'>('all');
    
    const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

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

            // Apply Person Sub-Filter Logic
            if (matchesType && filterType === 'person' && personFilter !== 'all') {
                // [ZEN FIX] Explicitly exclude the "Self" tag from relationship buckets
                // (Because "Self" contains ALL relationship types in its metadata)
                if (userPersonTagId && tag.id === userPersonTagId) {
                    return false; 
                }

                const relationships = (tag as PersonTag).metadata?.relationships || [];
                const hasRel = (types: Set<string>) => relationships.some(r => types.has(r.type.toLowerCase()));

                if (personFilter === 'family' && !hasRel(FAMILY_TYPES)) return false;
                if (personFilter === 'relatives' && !hasRel(RELATIVE_TYPES)) return false;
                if (personFilter === 'friends' && !hasRel(FRIEND_TYPES)) return false;
                if (personFilter === 'others') {
                    // "Others" means it fits NONE of the specific categories
                    if (hasRel(FAMILY_TYPES) || hasRel(RELATIVE_TYPES) || hasRel(FRIEND_TYPES)) return false;
                }
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

    }, [tags, searchQuery, filterType, personFilter, userPersonTagId]);

    const getTagImage = (tag: Tag) => {
        if (tag.mainImageId) {
            const found = media.find(m => m.id === tag.mainImageId);
            if (found) return found.thumbnailUrl || found.url;
        }
        const related = media.find(m => m.tagIds?.includes(tag.id) && m.fileType && m.fileType.startsWith('image'));
        return related ? (related.thumbnailUrl || related.url) : null;
    };

    // --- CARD COMPONENT ---
    const TagCard = ({ tag }: { tag: Tag }) => {
        const imageUrl = getTagImage(tag);
        const isDeleting = tagBeingDeleted === tag.id;
        const displayName = getDisplayName(tag);
        
        return (
            <div 
                onClick={() => !isDeleting && setSelectedTag(tag)}
                className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all group cursor-pointer relative flex flex-col h-full shadow-lg hover:shadow-cyan-900/20 ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
            >
                <div className={`h-24 ${getTagColor(tag.type)} relative overflow-hidden`}>
                     {imageUrl ? (
                         <>
                            <img src={imageUrl} alt="" className="w-full h-full object-cover opacity-30 blur-sm" />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900"></div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                             <TagIcon size={64} />
                       </div>
                    )}
                     <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                         <button onClick={(e) => { e.stopPropagation(); onDeleteTag(tag.id); }} className="p-1.5 bg-black/50 text-red-400 rounded-full hover:bg-red-900/80"><Trash2 size={14}/></button>
                     </div>
                </div>

                <div className="p-4 pt-16 relative flex-1 flex flex-col">
                    <div className="absolute -top-16 left-4 z-10">
                        <GlassAvatar 
                            imageUrl={imageUrl} 
                            altText={displayName} 
                            fallbackChar={displayName}
                            size="w-32 h-32" 
                            className="shadow-xl border-4 border-slate-900 text-5xl font-bold"
                        />
                    </div>

                    <div className="absolute top-3 right-4">
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-950/50 px-2 py-0.5 rounded border border-slate-800 tracking-wider uppercase">
                            {getRelationshipLabel(tag)}
                        </span>
                    </div>

                    <div className="mb-4 mt-2">
                        <h3 className="text-lg font-bold text-white leading-tight mb-1 truncate" title={tag.name}>{displayName}</h3>
                        <p className="text-xs text-slate-400 line-clamp-2">{tag.description || "No description."}</p>
                    </div>

                    <div className="mt-auto flex gap-2 pt-3 border-t border-slate-800/50">
                        <GlassButton 
                            onClick={(e) => { e.stopPropagation(); onDiscuss(tag); }} 
                            variant="secondary"
                            className="flex-1 text-xs"
                        >
                            <MessageSquare size={14} /> Chat
                        </GlassButton>
                        <GlassButton 
                            onClick={(e) => { e.stopPropagation(); onEditTag(tag); }} 
                            variant="secondary"
                            className="flex-1 text-xs"
                        >
                            <Edit size={14} /> Edit
                        </GlassButton>
                    </div>
                </div>

                {isDeleting && (
                    <div className="absolute inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center text-red-500">
                        <Loader2 className="animate-spin mb-2" /> Deleting...
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-slate-950">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0 bg-slate-900/50 backdrop-blur-md z-10">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                            <input 
                                type="text" 
                                placeholder="Search entities..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-full text-sm text-white focus:border-cyan-500 outline-none w-64 transition-all focus:w-80"
                            />
                        </div>
                        
                        <div className="h-8 w-px bg-slate-800 mx-2"></div>

                        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 overflow-x-auto custom-scrollbar max-w-md">
                            {['all', 'person', 'pet', 'place', 'event', 'thing', 'context'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => {
                                        setFilterType(type);
                                        if (type !== 'person') setPersonFilter('all');
                                    }}
                                    className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize whitespace-nowrap transition-colors ${filterType === type ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {type === 'context' ? 'Keywords' : type}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Person Sub-Filters Row */}
                    {filterType === 'person' && (
                        <div className="flex items-center gap-3 animate-in slide-in-from-top-2 fade-in">
                            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-1">
                                <Filter size={10} /> Filter By:
                            </span>
                            <div className="flex gap-2">
                                {[
                                    { id: 'all', label: 'All People' },
                                    { id: 'family', label: 'Immediate Family' },
                                    { id: 'relatives', label: 'Relatives' },
                                    { id: 'friends', label: 'Friends' },
                                    { id: 'others', label: 'Others' }
                                ].map(filter => (
                                    <button
                                        key={filter.id}
                                        onClick={() => setPersonFilter(filter.id as any)}
                                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border transition-all ${
                                            personFilter === filter.id 
                                                ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-900/40' 
                                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                                        }`}
                                    >
                                        {filter.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 mr-4">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500'}`}><Grid size={16} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}><List size={16} /></button>
                    </div>
                    
                    <GlassButton onClick={onCreateTag} variant="primary">
                        <Plus size={16} /> Create Entity
                    </GlassButton>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {filteredTags.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-slate-800">
                            <TagIcon size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-400">No {filterType === 'all' ? 'Entities' : filterType} Found</h3>
                        {personFilter !== 'all' && <p className="text-xs text-slate-500 mt-2">(Filter: {personFilter})</p>}
                    </div>
                ) : (
                    <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'grid-cols-1'}`}>
                        {filteredTags.map(tag => (
                             <TagCard key={tag.id} tag={tag} />
                        ))}
                    </div>
                )}
            </div>
            
            {selectedTag && (
                <TagDetailModal 
                    tag={selectedTag}
                    media={media}
                    onClose={() => setSelectedTag(null)}
                    onEdit={onEditTag}
                    onDiscuss={onDiscuss}
                />
            )}
        </div>
    );
};

export default TagGallery;