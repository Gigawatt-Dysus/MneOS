// [ZEN] Tag Surgeon — Bulk false-positive tag removal tool.
// Allows selecting a person tag, viewing every image carrying it,
// flagging false positives, and batch-stripping them in one Firestore write.
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Search, CheckCircle2, Trash2, Loader2, AlertTriangle,
    Users, ChevronDown, Scissors, ShieldCheck, RefreshCw
} from 'lucide-react';
import { collection, getDocs, writeBatch, doc, query, where } from '../../services/sovereignDbAdapter';
import { db } from '../../firebaseConfig';
import type { Tag, Media } from '../../types';
import { typesenseService } from '../../services/typesenseService';

interface TagSurgeonModalProps {
    userId: string;
    tags: Tag[];
    onClose: () => void;
    addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const TagSurgeonModal: React.FC<TagSurgeonModalProps> = ({
    userId, tags, onClose, addToast
}) => {
    // --- STATE ---
    const [selectedTagId, setSelectedTagId] = useState<string>('');
    const [tagSearch, setTagSearch] = useState('');
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

    const [isLoadingMedia, setIsLoadingMedia] = useState(false);
    const [affectedMedia, setAffectedMedia] = useState<Media[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    // Set of media IDs the user has flagged as FALSE POSITIVES (to be stripped)
    const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

    const [isCommitting, setIsCommitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Only show person-type tags in the picker
    const personTags = tags
        .filter(t => t.type === 'person')
        .sort((a, b) => a.name.localeCompare(b.name));

    const filteredPersonTags = tagSearch.trim()
        ? personTags.filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
        : personTags;

    const selectedTag = personTags.find(t => t.id === selectedTagId) ?? null;

    // --- LOAD AFFECTED MEDIA ---
    const loadAffectedMedia = useCallback(async () => {
        if (!selectedTagId) return;
        setIsLoadingMedia(true);
        setHasSearched(false);
        setFlaggedIds(new Set());
        setAffectedMedia([]);
        try {
            const mediaRef = collection(db, 'users', userId, 'media');
            const q = query(mediaRef, where('tagIds', 'array-contains', selectedTagId));
            const snapshot = await getDocs(q);
            const loaded: Media[] = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as Media))
                // [ZEN] Exclude internal avatar images via four-layer detection:
                // 1. ID prefix 'media-avatar-' (hardcoded in handleUploadAvatar — most reliable)
                // 2. isAvatar:true flag (Oroborus Shield on newer uploads)
                // 3. 'avatar' in filename (named stragglers)
                // 4. '/avatar_' in storage URL (legacy pre-shield URL pattern)
                .filter(m => {
                    if (m.id.startsWith('media-avatar-')) return false;
                    if ((m as any).isAvatar === true) return false;
                    const name = (m.originalName || m.title || '').toLowerCase();
                    if (name.includes('avatar')) return false;
                    const url = (m.url || (m as any).thumbnailUrl || '').toLowerCase();
                    if (url.includes('/avatar_') || url.includes('%2favatar_')) return false;
                    return true;
                });
            // Sort by logical date or upload date descending
            loaded.sort((a, b) => {
                const da = a.logicalDate ? new Date(a.logicalDate as string).getTime() : new Date(a.uploadDate).getTime();
                const db2 = b.logicalDate ? new Date(b.logicalDate as string).getTime() : new Date(b.uploadDate).getTime();
                return db2 - da;
            });
            setAffectedMedia(loaded);
            setHasSearched(true);
        } catch (err: any) {
            console.error('[TagSurgeon] Failed to load media:', err);
            addToast(`Failed to load media: ${err.message}`, 'error');
        } finally {
            setIsLoadingMedia(false);
        }
    }, [selectedTagId, userId, addToast]);

    // Auto-load when a tag is chosen
    useEffect(() => {
        if (selectedTagId) loadAffectedMedia();
    }, [selectedTagId, loadAffectedMedia]);

    // --- TOGGLE FLAG ---
    const toggleFlag = (mediaId: string) => {
        setFlaggedIds(prev => {
            const next = new Set(prev);
            if (next.has(mediaId)) next.delete(mediaId);
            else next.add(mediaId);
            return next;
        });
    };

    const flagAll = () => setFlaggedIds(new Set(affectedMedia.map(m => m.id)));
    const clearFlags = () => setFlaggedIds(new Set());

    // --- COMMIT BATCH STRIP ---
    const commitStrip = async () => {
        if (flaggedIds.size === 0 || !selectedTagId) return;
        setIsCommitting(true);
        setShowConfirm(false);
        try {
            // Firestore batch write — max 500 ops per batch
            const toStrip = affectedMedia.filter(m => flaggedIds.has(m.id));
            const BATCH_SIZE = 499;

            for (let i = 0; i < toStrip.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = toStrip.slice(i, i + BATCH_SIZE);
                
                // Track the updated media objects so we can sync them to Typesense
                const updatedChunkMedia: Media[] = [];

                for (const media of chunk) {
                    const newTagIds = (media.tagIds || []).filter((id: string) => id !== selectedTagId);
                    const ref = doc(db, 'users', userId, 'media', media.id);
                    batch.update(ref, { tagIds: newTagIds });
                    
                    // Store the local mutation
                    updatedChunkMedia.push({ ...media, tagIds: newTagIds });
                }
                
                await batch.commit();

                // [ZEN] CRITICAL: Sync changes to Typesense to prevent stale cache resurrection in the Matrix/Galleries
                for (const updatedMedia of updatedChunkMedia) {
                    try {
                        await typesenseService.updateMedia(updatedMedia);
                    } catch (tsError) {
                        console.warn(`[TagSurgeon] Failed to sync ${updatedMedia.id} to Typesense.`, tsError);
                    }
                }
            }

            addToast(`✂️ Stripped "${selectedTag?.name}" from ${flaggedIds.size} image${flaggedIds.size > 1 ? 's' : ''}.`, 'success');

            // Refresh the grid — show only the ones that survived (not flagged)
            setAffectedMedia(prev => prev.filter(m => !flaggedIds.has(m.id)));
            setFlaggedIds(new Set());
        } catch (err: any) {
            console.error('[TagSurgeon] Batch strip failed:', err);
            addToast(`Strip failed: ${err.message}`, 'error');
        } finally {
            setIsCommitting(false);
        }
    };

    // --- RENDER ---
    return createPortal(
        <div className="fixed inset-0 z-[100000] bg-black/90 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">

            {/* === HEADER === */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-white/10 bg-[#0c0d10] shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-orange-700 flex items-center justify-center shadow-[0_0_20px_rgba(225,29,72,0.4)]">
                        <Scissors size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white uppercase tracking-widest">
                            Tag Surgeon
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
                            Bulk False-Positive Removal Engine
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                >
                    <X size={22} />
                </button>
            </div>

            {/* === CONTROLS BAR === */}
            <div className="px-8 py-4 border-b border-white/5 bg-[#0e0f13] shrink-0">
                <div className="flex items-center gap-4 flex-wrap">

                    {/* Tag Selector Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsTagDropdownOpen(o => !o)}
                            className="flex items-center gap-3 px-5 py-3 bg-black/50 border border-white/10 hover:border-rose-500/50 rounded-2xl text-sm font-bold text-white transition-all min-w-[240px] justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <Users size={16} className="text-rose-400" />
                                <span className={selectedTag ? 'text-white' : 'text-slate-500'}>
                                    {selectedTag ? selectedTag.name : 'Select a person tag…'}
                                </span>
                            </div>
                            <ChevronDown size={14} className={`text-slate-500 transition-transform ${isTagDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isTagDropdownOpen && (
                            <div className="absolute top-full mt-2 left-0 w-80 bg-[#141518] border border-white/10 rounded-2xl shadow-2xl z-[200] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                <div className="p-3 border-b border-white/5">
                                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
                                        <Search size={14} className="text-slate-500 shrink-0" />
                                        <input
                                            autoFocus
                                            value={tagSearch}
                                            onChange={e => setTagSearch(e.target.value)}
                                            placeholder="Search people…"
                                            className="bg-transparent text-sm text-white placeholder-slate-600 outline-none flex-1"
                                        />
                                    </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                    {filteredPersonTags.length === 0 ? (
                                        <div className="px-4 py-6 text-center text-slate-600 text-xs">No person tags found</div>
                                    ) : filteredPersonTags.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => { setSelectedTagId(t.id); setIsTagDropdownOpen(false); setTagSearch(''); }}
                                            className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 ${selectedTagId === t.id ? 'bg-rose-500/20 text-rose-300' : 'text-slate-300 hover:bg-white/5'}`}
                                        >
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-rose-600/40 to-orange-600/40 border border-white/10 shrink-0 flex items-center justify-center text-[10px] font-black text-slate-400">
                                                {t.name.charAt(0)}
                                            </div>
                                            {t.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stats & Controls (only visible after a search) */}
                    {hasSearched && (
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[11px] font-bold text-slate-400">
                                <span className="text-white">{affectedMedia.length}</span>&nbsp;images tagged
                            </div>
                            <div className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[11px] font-bold transition-all ${flaggedIds.size > 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                                <Trash2 size={12} />
                                <span>{flaggedIds.size} flagged for removal</span>
                            </div>
                            <button
                                onClick={flagAll}
                                className="px-3 py-2 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 text-slate-500 hover:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Flag All
                            </button>
                            {flaggedIds.size > 0 && (
                                <button
                                    onClick={clearFlags}
                                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Clear Flags
                                </button>
                            )}
                            <button
                                onClick={loadAffectedMedia}
                                className="px-3 py-2 bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 text-slate-500 hover:text-cyan-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1"
                            >
                                <RefreshCw size={12} />&nbsp;Reload
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* === EVIDENCE GRID === */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                {!selectedTagId ? (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                        <Scissors size={64} className="text-slate-800 animate-pulse" />
                        <h3 className="text-lg font-black text-slate-700 uppercase tracking-widest">Select a Tag to Begin</h3>
                        <p className="text-slate-600 text-sm max-w-sm leading-relaxed">
                            Choose a person tag from the dropdown. Every image carrying that tag will appear here for your triage review.
                        </p>
                    </div>
                ) : isLoadingMedia ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4">
                        <Loader2 size={40} className="text-rose-400 animate-spin" />
                        <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">
                            Loading images tagged as {selectedTag?.name}…
                        </p>
                    </div>
                ) : hasSearched && affectedMedia.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4">
                        <ShieldCheck size={64} className="text-emerald-500/60" />
                        <h3 className="text-lg font-black text-slate-500 uppercase tracking-widest">All Clear</h3>
                        <p className="text-slate-600 text-sm">
                            No images are currently tagged with {selectedTag?.name}.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Instruction strip */}
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em] mb-6 text-center">
                            Click any image to flag it as a false positive &nbsp;·&nbsp; Flagged images will have the tag removed on commit
                        </p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {affectedMedia.map(media => {
                                const isFlagged = flaggedIds.has(media.id);
                                return (
                                    <button
                                        key={media.id}
                                        onClick={() => toggleFlag(media.id)}
                                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200 group focus:outline-none ${
                                            isFlagged
                                                ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)] scale-[0.97]'
                                                : 'border-transparent hover:border-emerald-500/50 hover:scale-[1.02]'
                                        }`}
                                    >
                                        {/* Thumbnail */}
                                        <img
                                            src={media.url || (media as any).preview || ''}
                                            alt={media.title || media.originalName || 'Media'}
                                            className={`w-full h-full object-cover transition-all duration-200 ${isFlagged ? 'brightness-50 saturate-0' : 'group-hover:brightness-90'}`}
                                            onError={e => { 
                                                const target = e.currentTarget as HTMLImageElement;
                                                if (!target.src.includes('placehold.co')) {
                                                    target.src = 'https://placehold.co/300x300/0f1219/334155?text=No+Preview'; 
                                                }
                                            }}
                                        />

                                        {/* Flagged overlay */}
                                        {isFlagged && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-rose-900/40 animate-in fade-in duration-150">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center shadow-2xl">
                                                        <X size={20} className="text-white" strokeWidth={3} />
                                                    </div>
                                                    <span className="text-[9px] font-black text-rose-300 uppercase tracking-widest">Flagged</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Hover tap-to-flag hint */}
                                        {!isFlagged && (
                                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                                <span className="text-[8px] font-black text-white/70 bg-black/60 rounded px-2 py-0.5 uppercase tracking-widest">
                                                    Tap to flag
                                                </span>
                                            </div>
                                        )}

                                        {/* Title tooltip */}
                                        <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-[9px] text-white/80 truncate font-medium leading-tight">
                                                {media.title || media.originalName || media.id.slice(-8)}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* === COMMIT FOOTER === */}
            {flaggedIds.size > 0 && (
                <div className="shrink-0 px-8 py-5 border-t border-white/10 bg-[#0e0f13] flex items-center justify-between animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-3">
                        <AlertTriangle size={18} className="text-rose-400" />
                        <div>
                            <p className="text-sm font-bold text-white">
                                Ready to strip <span className="text-rose-400">{flaggedIds.size} image{flaggedIds.size > 1 ? 's' : ''}</span>
                            </p>
                            <p className="text-[10px] text-slate-500 font-bold">
                                Removes "{selectedTag?.name}" from only the flagged images. The tag itself and all other associations are untouched.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={clearFlags}
                            className="px-5 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all text-sm"
                        >
                            Clear Flags
                        </button>
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={isCommitting}
                            className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-[0_0_20px_rgba(244,63,94,0.4)] hover:shadow-[0_0_30px_rgba(244,63,94,0.6)] active:scale-95"
                        >
                            {isCommitting
                                ? <><Loader2 size={16} className="animate-spin" /> Committing…</>
                                : <><Scissors size={16} /> Strip {flaggedIds.size} Tag{flaggedIds.size > 1 ? 's' : ''}</>
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* === CONFIRMATION DIALOG === */}
            {showConfirm && createPortal(
                <div className="fixed inset-0 z-[200000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-[#16171a] border border-rose-500/30 rounded-2xl shadow-2xl max-w-md w-full p-7 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                                <Scissors size={20} className="text-rose-400" />
                            </div>
                            <h3 className="text-lg font-black text-white uppercase tracking-widest">Confirm Strip</h3>
                        </div>
                        <p className="text-slate-300 leading-relaxed mb-2">
                            You are about to remove the tag <strong className="text-rose-400">"{selectedTag?.name}"</strong> from{' '}
                            <strong className="text-white">{flaggedIds.size} image{flaggedIds.size > 1 ? 's' : ''}</strong>.
                        </p>
                        <p className="text-slate-500 text-sm leading-relaxed mb-6">
                            The images themselves will not be deleted. Only the tag link will be removed. This cannot be undone automatically.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="px-5 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={commitStrip}
                                className="flex items-center gap-2 px-7 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-lg"
                            >
                                <CheckCircle2 size={16} /> Confirm Strip
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>,
        document.body
    );
};
