import React, { useState, useMemo } from 'react';
import { 
    Tag as TagIcon, Plus, Search, Check, 
    Dog, User, MapPin, Package, X, ExternalLink, Loader2 
} from 'lucide-react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import type { Media, Tag, User as UserType } from '@/types';
import { GlassButton } from '../../GlassButton';
import { typesenseService } from '../../../services/typesenseService';

interface EntityPanelProps {
    media: Media;
    allTags: Tag[];
    user: UserType;
    onUpdateLocal: (updated: Media) => void;
    onNavigateToTag?: (tagId: string) => void;
    onTagCreated?: (tag: Tag) => void;
}

const getTagIcon = (type: string) => {
    switch(type) {
        case 'person': return User;
        case 'pet': return Dog;
        case 'place': return MapPin;
        case 'thing': return Package;
        default: return TagIcon;
    }
};

export const EntityPanel: React.FC<EntityPanelProps> = ({ 
    media, allTags, user, onUpdateLocal, onNavigateToTag, onTagCreated 
}) => {
    const [tagSearch, setTagSearch] = useState('');
    const [isCreatingTag, setIsCreatingTag] = useState(false);

    // [ZEN FIX] Robust Deduplication
    // Even if 'allTags' has duplicates, this ensures we only work with unique IDs.
    const uniqueAllTags = useMemo(() => {
        const map = new Map<string, Tag>();
        allTags.forEach(t => {
            if (t && t.id) map.set(t.id, t);
        });
        return Array.from(map.values());
    }, [allTags]);

    const linkedTags = useMemo(() => {
        return uniqueAllTags
            .filter(t => media.tagIds?.includes(t.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [media.tagIds, uniqueAllTags]);

    const searchResults = useMemo(() => {
        if (!tagSearch.trim()) return [];
        return uniqueAllTags
            .filter(t => !media.tagIds?.includes(t.id))
            .filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
            .slice(0, 5);
    }, [uniqueAllTags, media.tagIds, tagSearch]);

    const toggleTag = async (tagId: string) => {
        const currentIds = media.tagIds || [];
        const isLinked = currentIds.includes(tagId);
        const newIds = isLinked ? currentIds.filter(id => id !== tagId) : [...currentIds, tagId];

        const updated = { ...media, tagIds: newIds };
        onUpdateLocal(updated); 
        await typesenseService.updateMedia(updated); 

        try {
            const mediaRef = doc(db, 'users', user.id, 'media', media.id);
            await updateDoc(mediaRef, { tagIds: newIds });
            setTagSearch(''); 
        } catch (err) { console.error(err); }
    };

    const createNewTag = async (type: Tag['type']) => {
        if (isCreatingTag) return;
        setIsCreatingTag(true);

        const newTagId = `tag-${Date.now()}`;
        const newTag = {
            id: newTagId,
            name: tagSearch,
            type: type,
            tagIds: [],
            mediaIds: [media.id],
            mediaGallery: [],
            metadata: {},
            description: `Created via Matrix Studio`,
            isPrivate: false,
            privateNotes: ''
        } as Tag;

        try {
            await setDoc(doc(db, 'users', user.id, 'tags', newTagId), newTag);
            
            const currentIds = media.tagIds || [];
            const newIds = [...currentIds, newTagId];
            await updateDoc(doc(db, 'users', user.id, 'media', media.id), { tagIds: newIds });

            const updated = { ...media, tagIds: newIds };
            onUpdateLocal(updated);
            await typesenseService.updateMedia(updated); 
            
            if (onTagCreated) onTagCreated(newTag);
            setTagSearch('');
        } catch (error) {
            console.error("Failed to create tag", error);
        } finally {
            setIsCreatingTag(false); 
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Linked Entities */}
            <div className="space-y-3 shrink-0">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Check size={12} className="text-emerald-500"/> Active Links
                </label>
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                    {linkedTags.length > 0 ? linkedTags.map(tag => {
                        const Icon = getTagIcon(tag.type);
                        let variant: 'primary' | 'success' | 'secondary' = 'secondary';
                        let colorClass = '';

                        if (tag.type === 'person') variant = 'primary';
                        if (tag.type === 'place') variant = 'success';
                        if (tag.type === 'thing') { variant = 'secondary'; colorClass = 'text-amber-300 border-amber-500/30 hover:bg-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'; }
                        if (tag.type === 'pet') { variant = 'secondary'; colorClass = 'text-purple-300 border-purple-500/30 hover:bg-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.1)]'; }

                        return (
                            <div key={tag.id} className="flex items-center gap-1">
                                <GlassButton 
                                    onClick={() => toggleTag(tag.id)}
                                    variant={variant}
                                    className={`text-xs h-8 pl-2 pr-3 gap-2 group ${colorClass}`}
                                >
                                    <Icon size={12} className="opacity-70"/>
                                    {tag.name}
                                    <X size={12} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                                </GlassButton>
                                {onNavigateToTag && (
                                    <button 
                                        onClick={() => onNavigateToTag(tag.id)} 
                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                        title="Go to Tag"
                                    >
                                        <ExternalLink size={12} />
                                    </button>
                                )}
                            </div>
                        );
                    }) : (
                        <div className="w-full p-4 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-slate-600 gap-2 bg-white/[0.02]">
                            <TagIcon size={16} className="opacity-30"/>
                            <span className="text-xs italic">No entities linked.</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Omni-Scanner */}
            <div className="space-y-3 shrink-0">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Omni-Scanner</label>
                <div className="relative group">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                    <input 
                        type="text" 
                        value={tagSearch}
                        onChange={e => setTagSearch(e.target.value)}
                        placeholder="Search or Initialize Entity..."
                        className="w-full bg-[#1a1d26] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder-slate-600 shadow-inner"
                    />
                </div>

                {tagSearch.trim() && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        {searchResults.map(tag => (
                            <button 
                                key={tag.id}
                                onClick={() => toggleTag(tag.id)}
                                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 text-left group transition-colors border border-transparent hover:border-white/5"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-md bg-[#1a1d26] text-slate-400 group-hover:text-white transition-colors">
                                        {React.createElement(getTagIcon(tag.type), { size: 12 })}
                                    </div>
                                    <span className="text-sm text-slate-300 group-hover:text-white">{tag.name}</span>
                                </div>
                                <Plus size={14} className="text-slate-500 group-hover:text-emerald-400" />
                            </button>
                        ))}

                        {searchResults.length === 0 && (
                            <div className="pt-2 border-t border-white/5">
                                <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Initialize New Entity:</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <GlassButton onClick={() => createNewTag('person')} disabled={isCreatingTag} variant="primary" className="justify-center text-xs h-8">
                                        {isCreatingTag ? <Loader2 className="animate-spin mr-2"/> : <User size={12} className="mr-2"/>} Person
                                    </GlassButton>
                                    <GlassButton onClick={() => createNewTag('pet')} disabled={isCreatingTag} variant="secondary" className="justify-center text-xs h-8 text-purple-300 border-purple-500/30 hover:bg-purple-500/20">
                                        {isCreatingTag ? <Loader2 className="animate-spin mr-2"/> : <Dog size={12} className="mr-2"/>} Pet
                                    </GlassButton>
                                    <GlassButton onClick={() => createNewTag('place')} disabled={isCreatingTag} variant="success" className="justify-center text-xs h-8">
                                        {isCreatingTag ? <Loader2 className="animate-spin mr-2"/> : <MapPin size={12} className="mr-2"/>} Place
                                    </GlassButton>
                                    <GlassButton onClick={() => createNewTag('thing')} disabled={isCreatingTag} variant="secondary" className="justify-center text-xs h-8 text-amber-300 border-amber-500/30 hover:bg-amber-500/20">
                                        {isCreatingTag ? <Loader2 className="animate-spin mr-2"/> : <Package size={12} className="mr-2"/>} Thing
                                    </GlassButton>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};