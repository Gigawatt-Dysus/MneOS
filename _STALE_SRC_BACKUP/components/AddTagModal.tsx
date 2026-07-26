import React, { useState, useMemo } from 'react';
import { X, Search, Tag as TagIcon, User, Dog, MapPin, Package, Calendar } from 'lucide-react';
import type { Tag } from '@/types';

interface AddTagModalProps {
    allTags: Tag[];
    onSelect: (tag: Tag) => void;
    onClose: () => void;
    excludeTagId?: string; // Don't allow aliasing to the *current* tag (redundant)
}

const getTagIcon = (type: string) => {
    switch (type) {
        case 'person': return <User size={12} />;
        case 'pet': return <Dog size={12} />;
        case 'place': return <MapPin size={12} />;
        case 'thing': return <Package size={12} />;
        case 'event': return <Calendar size={12} />;
        default: return <TagIcon size={12} />;
    }
};

const AddTagModal: React.FC<AddTagModalProps> = ({ allTags, onSelect, onClose, excludeTagId }) => {
    const [search, setSearch] = useState('');
    
    // [ZEN FIX] Memoized, Sorted, and Unlimited
    const filteredTags = useMemo(() => {
        return allTags
            .filter(t => t.id !== excludeTagId)
            .filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
                // 1. Sort by Type Priority (Person first, then Pet, etc)
                const typePriority: Record<string, number> = { 'person': 0, 'pet': 1, 'place': 2, 'thing': 3, 'event': 4 };
                const pA = typePriority[a.type] ?? 99;
                const pB = typePriority[b.type] ?? 99;
                
                if (pA !== pB) return pA - pB;

                // 2. Sort Alphabetically by Name
                return a.name.localeCompare(b.name);
            });
            // [ZEN FIX] Removed .slice(0, 10) limitation
    }, [allTags, excludeTagId, search]);

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[80vh]">
                
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#13161f]">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <TagIcon size={16} className="text-cyan-400"/> Link Entity
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18}/></button>
                </div>
                
                <div className="p-4 border-b border-white/5">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <input 
                            type="text" 
                            autoFocus
                            placeholder="Search existing tags..." 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-[#0f1219] border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {filteredTags.length > 0 ? (
                        <div className="space-y-1">
                            {filteredTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => onSelect(tag)}
                                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 text-slate-300 hover:text-white text-sm flex items-center justify-between group transition-all"
                                >
                                    <span className="font-medium flex items-center gap-2">
                                        <span className={`text-slate-500 group-hover:text-cyan-400 transition-colors`}>
                                            {getTagIcon(tag.type)}
                                        </span>
                                        {tag.name}
                                    </span>
                                    <span className="text-[9px] uppercase bg-black/20 px-1.5 py-0.5 rounded text-slate-500 font-bold tracking-wider group-hover:text-slate-300">
                                        {tag.type}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-slate-600 text-xs py-8">
                            No matching tags found.
                        </div>
                    )}
                </div>
                
                <div className="p-3 border-t border-white/5 bg-[#13161f] text-center">
                    <p className="text-[10px] text-slate-500">
                        Showing {filteredTags.length} entities
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AddTagModal;