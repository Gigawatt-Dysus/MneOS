import React, { useState, useMemo } from 'react';
import { Search, Grid, List, User, Tag as TagIcon, MapPin, Package, Calendar, Dog, Edit, MessageSquare, Trash2, ExternalLink, Plus, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import type { Tag, Media, PersonTag, PetTag, PlaceTag } from '@/types';
import { GlassAvatar } from './GlassAvatar';

interface TagGalleryProps {
    tags: Tag[];
    media: Media[];
    tagBeingDeleted: string | null;
    onEditTag: (tag: Tag) => void;
    onCreateTag: () => void;
    onDeleteTag: (id: string) => void;
    onReplaceTag: (tag: Tag) => void; 
    onDiscuss: (tag: Tag) => void;
}

// --- HELPERS ---

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

const getRelationshipLabel = (tag: Tag) => {
    return tag.type.toUpperCase();
};

const formatDisplayDate = (val: any): string => {
    if (!val) return 'Unknown';
    try {
        if (val instanceof Date) return val.toLocaleDateString();
        if (typeof val === 'object' && 'seconds' in val) {
            return new Date(val.seconds * 1000).toLocaleDateString();
        }
        if (typeof val === 'string') {
            if (!isNaN(Date.parse(val)) && (val.includes('-') || val.includes('/'))) {
                return new Date(val).toLocaleDateString();
            }
            return val;
        }
        return String(val);
    } catch (e) {
        return 'Invalid Date';
    }
};

// Helper to safely render Address Object or String
const formatAddress = (val: any): string => {
    if (!val) return 'Unknown';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
        const parts = [
            val.streetAddress, 
            val.addressLocality, 
            val.addressRegion
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'Unknown Location';
    }
    return 'Invalid Address Format';
};

export const TagGallery: React.FC<TagGalleryProps> = ({ 
    tags, media, tagBeingDeleted, onEditTag, onCreateTag, onDeleteTag, onDiscuss 
}) => {
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [selectedTag, setSelectedTag] = useState<Tag | null>(null);

    const filteredTags = useMemo(() => {
        return tags.filter(tag => {
            const matchesSearch = tag.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = filterType === 'all' || tag.type === filterType;
            return matchesSearch && matchesType;
        });
    }, [tags, searchQuery, filterType]);

    const getTagImage = (tag: Tag) => {
        if (tag.mainImageId) {
            const found = media.find(m => m.id === tag.mainImageId);
            if (found) return found.thumbnailUrl || found.url;
        }
        if (tag.tagIds && tag.tagIds.length > 0) {
             const relatedImage = media.find(m => m.tagIds && m.tagIds.includes(tag.id) && m.fileType.startsWith('image/'));
             if (relatedImage) return relatedImage.thumbnailUrl || relatedImage.url;
        }
        return null;
    };

    // --- SUB-COMPONENT: CARD ---
    const TagCard = ({ tag }: { tag: Tag }) => {
        const imageUrl = getTagImage(tag);
        const isDeleting = tagBeingDeleted === tag.id;
        
        return (
            <div 
                onClick={() => !isDeleting && setSelectedTag(tag)}
                className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-violet-500/50 transition-all group cursor-pointer relative flex flex-col h-full shadow-lg hover:shadow-violet-900/20 ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
            >
                {isDeleting && (
                    <div className="absolute inset-0 z-50 bg-slate-950/80 flex flex-col items-center justify-center text-red-400">
                        <Loader2 className="animate-spin mb-2" size={24} />
                        <span className="text-xs font-bold uppercase">Deleting...</span>
                    </div>
                )}

                {/* Banner */}
                <div className={`h-24 ${getTagColor(tag.type)} relative overflow-hidden`}>
                    {imageUrl ? (
                        <>
                            <img src={imageUrl} alt={tag.name} className="w-full h-full object-cover opacity-40 group-hover:opacity-30 transition-opacity blur-sm" />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900/90"></div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-20">
                            <TagIcon size={64} />
                        </div>
                    )}
                    
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEditTag(tag); }}
                            className="p-1.5 bg-black/50 hover:bg-black/80 rounded-full text-white backdrop-blur-sm"
                            title="Edit"
                        >
                            <Edit size={14} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteTag(tag.id); }}
                            className="p-1.5 bg-red-500/80 hover:bg-red-600 rounded-full text-white backdrop-blur-sm"
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 relative flex-1 flex flex-col pt-12">
                    <div className="absolute -top-10 left-4 z-10">
                        <GlassAvatar 
                            imageUrl={imageUrl} 
                            altText={tag.name} 
                            fallbackChar={tag.name}
                            size="w-20 h-20"
                            className="border-4 border-slate-900 shadow-xl text-3xl font-bold"
                        />
                    </div>

                    <div className="absolute top-2 right-4">
                         <span className="text-[10px] uppercase font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 tracking-wider">
                            {getRelationshipLabel(tag)}
                        </span>
                    </div>

                    <div className="flex-1">
                        <h3 className="font-bold text-white text-lg truncate mb-1">{tag.name}</h3>
                        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                            {tag.description || "No description provided."}
                        </p>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-800 flex gap-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDiscuss(tag); }}
                            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"
                        >
                            <MessageSquare size={14} /> Chat
                        </button>
                         <button 
                            onClick={(e) => { e.stopPropagation(); onEditTag(tag); }}
                            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"
                        >
                            <Edit size={14} /> Edit
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // --- SUB-COMPONENT: DETAIL MODAL ---
    const renderDetailModal = () => {
        if (!selectedTag) return null;
        const imageUrl = getTagImage(selectedTag);
        
        const relatedMedia = media.filter(m => 
            (m.tagIds && m.tagIds.includes(selectedTag.id)) || 
            (m.id === selectedTag.mainImageId)
        ).slice(0, 9); 

        return (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedTag(null)}>
                
                <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] isolate" onClick={e => e.stopPropagation()}>
                    
                    {/* Header */}
                    <div className={`h-32 ${getTagColor(selectedTag.type)} relative shrink-0 rounded-t-2xl z-20`}>
                        {imageUrl && (
                             <>
                                <img src={imageUrl} alt={selectedTag.name} className="w-full h-full object-cover opacity-30 blur-md rounded-t-2xl" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent rounded-t-2xl"></div>
                            </>
                        )}
                        <button 
                            onClick={() => setSelectedTag(null)}
                            className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors z-20"
                        >
                            <X size={20} />
                        </button>

                        <div className="absolute -bottom-16 left-8 z-50">
                            <GlassAvatar 
                                imageUrl={imageUrl} 
                                altText={selectedTag.name} 
                                fallbackChar={selectedTag.name}
                                size="w-32 h-32" 
                                className="border-[6px] border-slate-900 text-5xl font-bold"
                            />
                        </div>
                    </div>

                    <div className="px-8 pb-8 pt-20 flex flex-col flex-1 overflow-y-auto custom-scrollbar relative z-0">
                        <div className="flex justify-end mb-6">
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => { setSelectedTag(null); onDiscuss(selectedTag); }}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 border border-slate-700"
                                >
                                    <MessageSquare size={16}/> Discuss
                                </button>
                                <button 
                                    onClick={() => { setSelectedTag(null); onEditTag(selectedTag); }} 
                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-violet-900/20"
                                >
                                    <Edit size={16}/> Edit Profile
                                </button>
                            </div>
                        </div>

                        <div>
                            <div className="mb-6">
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-4xl font-black text-white tracking-tight">{selectedTag.name}</h2>
                                    <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                                        {getTagIcon(selectedTag.type)}
                                        {getRelationshipLabel(selectedTag)}
                                    </span>
                                </div>
                                <p className="text-lg text-slate-300 leading-relaxed font-light">
                                    {selectedTag.description || "No detailed description recorded."}
                                </p>
                            </div>

                            {/* Metadata Grid */}
                            <div className="bg-slate-950/50 rounded-xl p-6 border border-slate-800 mb-8">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider">Details</h4>
                                <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                                    {selectedTag.type === 'person' && (
                                        <>
                                            <div>
                                                <span className="block text-xs text-slate-500 mb-1">Birthday</span>
                                                <span className="text-white font-medium">{formatDisplayDate((selectedTag as PersonTag).metadata.dates?.birth)}</span>
                                            </div>
                                            <div>
                                                <span className="block text-xs text-slate-500 mb-1">Gender</span>
                                                <span className="text-white font-medium">{(selectedTag as PersonTag).metadata.gender || 'Unknown'}</span>
                                            </div>
                                        </>
                                    )}
                                    
                                    {/* [ZEN FIX] WRAPPED IN FORMATTER TO SOLVE TYPE ERROR */}
                                    {selectedTag.type === 'place' && (
                                        <div className="col-span-2">
                                            <span className="block text-xs text-slate-500 mb-1">Address</span>
                                            <span className="text-white font-medium">
                                                {formatAddress((selectedTag as PlaceTag).metadata.address)}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {selectedTag.type === 'pet' && (
                                        <div>
                                            <span className="block text-xs text-slate-500 mb-1">Species</span>
                                            <span className="text-white font-medium">{(selectedTag as PetTag).metadata.species || 'Unknown'}</span>
                                        </div>
                                    )}
                                    
                                    <div>
                                        <span className="block text-xs text-slate-500 mb-1">Database ID</span>
                                        <span className="text-white font-medium font-mono text-xs">{selectedTag.id}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Memories */}
                            {relatedMedia.length > 0 ? (
                                <div className="mb-8">
                                    <div className="flex justify-between items-end mb-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent Memories ({relatedMedia.length})</h4>
                                        <span className="text-xs text-cyan-500 cursor-pointer hover:underline flex items-center gap-1">
                                            View All <ExternalLink size={10} />
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {relatedMedia.map(m => (
                                            <div key={m.id} className="aspect-square rounded-lg overflow-hidden border border-slate-800 bg-slate-900 relative group cursor-pointer">
                                                {m.fileType.startsWith('image/') ? (
                                                    <img src={m.thumbnailUrl || m.url} alt={m.caption} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                                                        <ImageIcon />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                                                {m.caption && (
                                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 text-[10px] text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {m.caption}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-8 p-8 text-center border-2 border-dashed border-slate-800 rounded-xl">
                                    <p className="text-slate-500 text-sm">No memories tagged yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-slate-950">
            {/* Toolbar */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0 bg-slate-900/50 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search tags..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-full text-sm text-white focus:border-cyan-500 outline-none w-64 transition-all focus:w-80"
                        />
                    </div>
                    
                    <div className="h-8 w-px bg-slate-800 mx-2"></div>

                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 overflow-x-auto custom-scrollbar max-w-md">
                        {['all', 'person', 'pet', 'place', 'event', 'thing'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold capitalize whitespace-nowrap transition-colors ${filterType === type ? 'bg-slate-800 text-cyan-400 shadow-sm border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 mr-4">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500'}`}><Grid size={16} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500'}`}><List size={16} /></button>
                    </div>
                    <button onClick={onCreateTag} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg flex items-center gap-2 shadow-lg hover:shadow-cyan-500/20 transition-all">
                        <Plus size={16} /> Create Tag
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {filteredTags.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-slate-800">
                            <TagIcon size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-400">No Tags Found</h3>
                        <p className="text-sm">Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'grid-cols-1'}`}>
                        {filteredTags.map(tag => (
                            <TagCard key={tag.id} tag={tag} />
                        ))}
                    </div>
                )}
            </div>
            
            {renderDetailModal()}
        </div>
    );
};

export default TagGallery;