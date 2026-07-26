import React, { useState, useMemo } from 'react';
import { Search, X, Tag as TagIcon, Sparkles } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import type { Tag, Media } from '../../types';
import { db, collection, updateDoc, doc, arrayUnion, addDoc } from '../../services/sovereignDbAdapter';

interface RapidTagSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    tags: Tag[];
    selectedAssets: Media[];
    userId: string;
    targetCollection: string;
    onComplete: (updatedAssets: Media[]) => void;
    onTagCreated?: (newTag: Tag) => void;
    onCreateTag?: (name: string, type: Tag['type'], metadata?: any) => Promise<Tag | null>;
}

export const RapidTagSelectorModal: React.FC<RapidTagSelectorModalProps> = ({
    isOpen,
    onClose,
    tags,
    selectedAssets,
    userId,
    targetCollection,
    onComplete,
    onTagCreated,
    onCreateTag
}) => {
    const [search, setSearch] = useState('');
    const [isApplying, setIsApplying] = useState(false);

    const filteredTags = useMemo(() => {
        if (!search.trim()) return tags;
        const lower = search.toLowerCase();
        return tags.filter(tag => 
            tag.name.toLowerCase().includes(lower) || 
            (tag as any).aliases?.some((alias: string) => alias.toLowerCase().includes(lower))
        );
    }, [tags, search]);

    if (!isOpen) return null;

    const handleSelectTag = async (tag: Tag) => {
        setIsApplying(true);
        try {
            const updatedAssets: Media[] = [];
            for (const asset of selectedAssets) {
                const assetRef = doc(db, 'users', userId, targetCollection, asset.id);
                // Atomic push
                await updateDoc(assetRef, {
                    tagIds: arrayUnion(tag.id)
                });
                
                // Optimistic local update
                updatedAssets.push({
                    ...asset,
                    tagIds: asset.tagIds ? [...new Set([...asset.tagIds, tag.id])] : [tag.id]
                });
            }
            onComplete(updatedAssets);
        } catch (err) {
            console.error('[RapidTagSelector] Failed atomic tag push:', err);
            alert('Failed to apply tag to selected assets.');
        } finally {
            setIsApplying(false);
            onClose();
        }
    };

    const handleCreateTag = async () => {
        if (!search.trim()) return;
        setIsApplying(true);
        try {
            let newTag: Tag | null = null;
            if (onCreateTag) {
                newTag = await onCreateTag(search.trim(), 'concept', { flavor: 'User Created' });
            } else {
                // Fallback for isolated mode
                const newTagData = {
                    name: search.trim(),
                    type: 'concept',
                    isPrivate: false,
                    description: '',
                    mediaGallery: [],
                    tagIds: [],
                    mediaIds: [],
                    metadata: {
                        flavor: 'User Created'
                    }
                };
                const tagsRef = collection(db, 'users', userId, 'tags');
                const newDocRef = await addDoc(tagsRef, newTagData);
                newTag = {
                    id: newDocRef.id,
                    ...newTagData
                } as unknown as Tag;
            }

            if (!newTag) throw new Error("Tag creation failed");

            if (onTagCreated) {
                onTagCreated(newTag);
            }

            // Instantly bind the newly spawned tag
            await handleSelectTag(newTag);
        } catch (err) {
            console.error('[RapidTagSelector] Failed to create and bind new tag:', err);
            alert('Failed to spawn new tag.');
            setIsApplying(false);
        }
    };


    return (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
                            <TagIcon size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-white uppercase tracking-wider text-lg">Rapid Bind</h3>
                            <p className="text-[11px] text-slate-400 font-mono">
                                Binding {selectedAssets.length} asset{selectedAssets.length === 1 ? '' : 's'}
                            </p>
                        </div>
                    </div>
                    <GlassButton onClick={onClose} variant="ghost" className="h-8 w-8 p-0 rounded-full text-slate-400 hover:text-white hover:bg-white/10">
                        <X size={16} />
                    </GlassButton>
                </div>

                <div className="p-4 border-b border-white/5 bg-slate-900/80">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search or type to create a new tag..."
                            className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-slate-600"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {isApplying ? (
                        <div className="flex flex-col items-center justify-center py-12 text-cyan-500">
                            <Sparkles className="animate-spin mb-4" size={32} />
                            <p className="font-mono text-xs animate-pulse">EXECUTING ATOMIC PUSH...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-1">
                            {search.trim().length > 0 && !filteredTags.some(t => t.name.toLowerCase() === search.trim().toLowerCase()) && (
                                <button
                                    onClick={handleCreateTag}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-500/30 transition-all group text-left w-full mb-2"
                                >
                                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 font-bold group-hover:scale-110 transition-transform">
                                        +
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-cyan-400 text-sm truncate">
                                            Create "{search.trim()}"
                                        </div>
                                        <div className="text-[10px] text-cyan-500/70 font-mono uppercase tracking-wider">
                                            Rapid Spawn (Concept)
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-cyan-500/20 text-cyan-400 text-[10px] font-bold rounded">
                                        SPAWN & BIND
                                    </div>
                                </button>
                            )}

                            {filteredTags.length === 0 ? (
                                <div className="text-center py-12 text-slate-500 font-mono text-sm">
                                    {search.trim() ? '' : 'No matching tags found.'}
                                </div>
                            ) : (
                                filteredTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => handleSelectTag(tag)}
                                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 transition-colors group text-left w-full border border-transparent hover:border-white/5"
                                    >
                                        <div 
                                            className="w-3 h-3 rounded-full shrink-0 shadow-inner" 
                                            style={{ backgroundColor: (tag as any).color || '#94a3b8' }} 
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-200 text-sm truncate group-hover:text-cyan-400 transition-colors">
                                                {tag.name}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">
                                                {tag.type || 'Standard'}
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold rounded">
                                            BIND
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
