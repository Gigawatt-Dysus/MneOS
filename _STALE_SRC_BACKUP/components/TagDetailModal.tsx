import React from 'react';
import { X, MessageSquare, Edit, User, Dog, MapPin, Package, Calendar, Tag as TagIcon, ExternalLink, Image as ImageIcon } from 'lucide-react';
import type { Tag, Media, PersonTag, PetTag, PlaceTag } from '@/types';
import { GlassAvatar } from './GlassAvatar';

interface TagDetailModalProps {
    tag: Tag;
    media: Media[];
    onClose: () => void;
    onEdit: (tag: Tag) => void;
    onDiscuss: (tag: Tag) => void;
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

const formatDisplayDate = (val: any): string => {
    if (!val) return 'Unknown';
    try {
        if (val instanceof Date) return val.toLocaleDateString();
        if (typeof val === 'object' && 'seconds' in val) return new Date(val.seconds * 1000).toLocaleDateString();
        if (typeof val === 'string') return val;
        return String(val);
    } catch (e) { return 'Invalid Date'; }
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

export const TagDetailModal: React.FC<TagDetailModalProps> = ({ tag, media, onClose, onEdit, onDiscuss }) => {
    
    const getTagImage = (t: Tag) => {
        if (t.mainImageId) {
            const found = media.find(m => m.id === t.mainImageId);
            if (found) return found.thumbnailUrl || found.url;
        }
        if (t.tagIds && t.tagIds.length > 0) {
             const relatedImage = media.find(m => m.tagIds && m.tagIds.includes(t.id) && m.fileType && m.fileType.startsWith('image/'));
             if (relatedImage) return relatedImage.thumbnailUrl || relatedImage.url;
        }
        return null;
    };

    const imageUrl = getTagImage(tag);
    
    const relatedMedia = media.filter(m => 
        (m.tagIds && m.tagIds.includes(tag.id)) || 
        (m.id === tag.mainImageId)
    ).slice(0, 9); 

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] isolate" onClick={e => e.stopPropagation()}>
                
                {/* Banner */}
                <div className={`h-32 ${getTagColor(tag.type)} relative shrink-0 rounded-t-2xl z-20`}>
                     {imageUrl && (
                         <>
                            <img src={imageUrl} alt={tag.name} className="w-full h-full object-cover opacity-30 blur-md rounded-t-2xl" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent rounded-t-2xl"></div>
                         </>
                    )}
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors z-20">
                        <X size={20} />
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
                <div className="px-8 pb-8 mt-20 flex flex-col flex-1 overflow-y-auto custom-scrollbar relative z-0">
                    <div className="flex justify-end mb-6">
                        <div className="flex gap-3">
                            <button onClick={() => { onClose(); onDiscuss(tag); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 border border-slate-700">
                                <MessageSquare size={16}/> Discuss
                            </button>
                            <button onClick={() => { onClose(); onEdit(tag); }} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-violet-900/20">
                                <Edit size={16}/> Edit Profile
                            </button>
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
                        <p className="text-lg text-slate-300 leading-relaxed font-light">{tag.description || "No detailed description recorded."}</p>
                    </div>

                    {/* Metadata Grid */}
                    <div className="bg-slate-950/50 rounded-xl p-6 border border-slate-800 mb-8">
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-wider">Details</h4>
                        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                            {tag.type === 'person' && (
                                <>
                                    <div><span className="block text-xs text-slate-500 mb-1">Birthday</span><span className="text-white font-medium">{formatDisplayDate((tag as PersonTag).metadata.dates?.birth)}</span></div>
                                    <div><span className="block text-xs text-slate-500 mb-1">Gender</span><span className="text-white font-medium">{(tag as PersonTag).metadata.gender || 'Unknown'}</span></div>
                                </>
                            )}
                            {tag.type === 'place' && <div className="col-span-2"><span className="block text-xs text-slate-500 mb-1">Address</span><span className="text-white font-medium">{formatAddress((tag as PlaceTag).metadata.address)}</span></div>}
                            
                            {tag.type === 'pet' && <div><span className="block text-xs text-slate-500 mb-1">Species</span><span className="text-white font-medium">{(tag as PetTag).metadata.species || 'Unknown'}</span></div>}
                            <div><span className="block text-xs text-slate-500 mb-1">Database ID</span><span className="text-white font-medium font-mono text-xs">{tag.id}</span></div>
                        </div>
                    </div>

                    {/* Media Grid */}
                    {relatedMedia.length > 0 && (
                        <div className="mb-8">
                            <div className="flex justify-between items-end mb-4">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recent Memories ({relatedMedia.length})</h4>
                                <span className="text-xs text-cyan-500 cursor-pointer hover:underline flex items-center gap-1">View All <ExternalLink size={10} /></span>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                {relatedMedia.map(m => (
                                    <div key={m.id} className="aspect-square rounded-lg overflow-hidden border border-slate-800 bg-slate-900 relative group">
                                        {/* [ZEN FIX] Safe check for fileType */}
                                        {m.fileType && m.fileType.startsWith('image/') ? (
                                            <img src={m.thumbnailUrl || m.url} alt={m.caption} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-500"><ImageIcon /></div>
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
                    )}
                </div>
            </div>
        </div>
    );
};