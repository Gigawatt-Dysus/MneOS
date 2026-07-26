import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Edit2, MapPin, Tag as TagIcon, Trash2, Calendar, MessageSquare, Smile } from 'lucide-react';
import type { LifeEvent, Media, Tag, User, Reaction } from '@/types';
import { ExpandableSection, CommentActionMenu, CommentInput } from './TimelineShared';
import { EMOJIS_FOR_PICKER } from '../GigiJournalView';
import { GigiCoreIcon } from '../icons/GigiCoreIcon';
import { GlassAvatar } from '../GlassAvatar'; // [ZEN FIX] Import

interface EventViewerModalProps {
    event: LifeEvent;
    media: Media[];
    tags: Tag[];
    user: User;
    onClose: () => void;
    onEdit: () => void;
    onTagClick: (tag: Tag) => void;
    onMediaClick: (media: Media) => void;
    onAddComment: (text: string) => void;
    onUpdateEvent: (event: LifeEvent) => void;
    onDeepDive?: (event: LifeEvent) => void;
    onDelete?: () => void;
}

const EventViewerModalFixed: React.FC<EventViewerModalProps> = ({ 
    event, media, tags, user, onClose, onEdit, onTagClick, onMediaClick, 
    onAddComment, onUpdateEvent, onDeepDive, onDelete 
}) => {
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isDiving, setIsDiving] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);
    
    // Robust AI Name Logic
    const primaryCompanion = user.aiCompanions?.find(c => c.isPrimary) || user.aiCompanions?.[0];
    const aiName = primaryCompanion?.name || 'Gigi';

    const eventMedia = useMemo(() => media.filter(m => event.mediaIds?.includes(m.id)), [media, event.mediaIds]);
    const eventTags = useMemo(() => tags.filter(t => event.tagIds?.includes(t.id)), [tags, event.tagIds]);

    // UTC Date Enforcement
    const dateObj = event.date instanceof Date && !isNaN(event.date.getTime()) ? event.date : new Date();
    const fullDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'UTC' 
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        if (event.comments && event.comments.length > 0) {
            commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [event.comments?.length]);

    const handleReaction = (emoji: string) => {
        let newReactions: Reaction[] = event.reactions || [];
        const existingIdx = newReactions.findIndex(r => r.reactorId === user.id);
        
        if (existingIdx > -1) {
             if (newReactions[existingIdx].emoji === emoji) {
                 newReactions = newReactions.filter((_, i) => i !== existingIdx);
             } else {
                 const updated = [...newReactions];
                 updated[existingIdx] = { ...updated[existingIdx], emoji };
                 newReactions = updated;
             }
        } else {
            newReactions = [...newReactions, {
                reactorId: user.id,
                reactorName: user.displayName,
                emoji,
                reactorAvatarUrl: user.profilePictureUrl
            }];
        }
        onUpdateEvent({...event, reactions: newReactions});
        setShowEmojiPicker(false);
    };

    const handleDeleteComment = (commentId: string) => {
        const updatedComments = event.comments?.filter(c => c.id !== commentId);
        onUpdateEvent({ ...event, comments: updatedComments });
    };

    const handleDeepDiveClick = () => {
        if (onDeepDive) {
            setIsDiving(true);
            onDeepDive(event);
            setTimeout(() => setIsDiving(false), 2000);
        } else {
            console.warn("Deep Dive function missing");
        }
    };

    const reactionsCount = (event.reactions || []).reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);


    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
            
            {/* Constrained Width Bento Box */}
            <div 
                className="bg-[#0f1219] border border-white/10 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden ring-1 ring-white/5" 
                onClick={e => e.stopPropagation()}
            >
                {/* --- HEADER (GRID LAYOUT) --- */}
                <div className="grid grid-cols-[1fr_auto] items-start p-6 border-b border-white/5 bg-[#13161f] gap-4">
                    
                    {/* Title Column */}
                    <div className="flex flex-col min-w-0">
                        <h2 className="text-2xl font-bold text-white tracking-tight break-words leading-tight">{event.title || "Untitled Event"}</h2>
                        <div className="flex items-center gap-2 text-slate-400 mt-2">
                            <Calendar size={14} className="text-cyan-500" />
                            <span className="text-sm font-mono tracking-wide uppercase">{fullDate}</span>
                        </div>
                    </div>

                    {/* Buttons Column */}
                    <div className="flex items-center gap-2 pt-1">
                        
                        {/* "Ask AI" Button - Always Visible, No Wiper */}
                        <button 
                            onClick={handleDeepDiveClick} 
                            disabled={isDiving || !onDeepDive} 
                            className={`flex items-center gap-2 transition-all group mr-3 ${!onDeepDive ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-100'}`}
                            title={onDeepDive ? `Ask ${aiName} to analyze this` : "AI Analysis Unavailable"}
                        >
                            <div className={`relative w-12 h-12 flex items-center justify-center`}>
                                <GigiCoreIcon className={`w-12 h-12 drop-shadow-[0_0_15px_rgba(37,99,235,0.6)] ${isDiving ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
                            </div>
                            <span className="text-lg font-bold tracking-wide text-cyan-400 group-hover:text-cyan-300 hidden sm:inline whitespace-nowrap">
                                Ask {aiName}
                            </span>
                        </button>

                        <div className="h-8 w-px bg-white/10 hidden sm:block mx-1"></div>

                        <button 
                            onClick={() => { onClose(); onEdit(); }} 
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors" 
                            title="Edit Event"
                        >
                            <Edit2 size={20} />
                        </button>

                        {onDelete && (
                            <button 
                                onClick={() => {
                                    if(window.confirm("Are you sure you want to delete this event?")) {
                                        onDelete();
                                        onClose();
                                    }
                                }} 
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-900/20 rounded-xl transition-colors" 
                                title="Delete Event"
                            >
                                <Trash2 size={20} />
                            </button>
                        )}

                        <button 
                            onClick={onClose} 
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors ml-1"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* --- CONTENT --- */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-8 space-y-8">
                        <div className="prose prose-invert prose-lg max-w-none text-slate-300 font-serif leading-relaxed whitespace-pre-wrap">
                            {event.details}
                        </div>

                        {event.location && (
                            <div className="flex items-center gap-2 text-sm text-slate-400 bg-white/5 w-fit px-4 py-2 rounded-full border border-white/5">
                                <MapPin size={16} className="text-emerald-500" />
                                {event.location.addressLocality}, {event.location.addressRegion}
                            </div>
                        )}

                        {eventMedia.length > 0 && (
                            <div className="bg-[#0a0c10] p-4 rounded-2xl border border-white/5">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    Visual Artifacts <span className="bg-white/10 px-1.5 rounded text-[10px] text-white">{eventMedia.length}</span>
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {eventMedia.map(mediaItem => (
                                        <div key={mediaItem.id} className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 cursor-pointer" onClick={() => onMediaClick(mediaItem)}>
                                            <img src={mediaItem.thumbnailUrl || mediaItem.url} alt={mediaItem.caption} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-cyan-900/20 transition-colors"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {eventTags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {eventTags.map(tag => (
                                    <button key={tag.id} onClick={() => { onClose(); onTagClick(tag); }} className="flex items-center gap-1.5 bg-[#1a1d26] text-slate-400 hover:text-cyan-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/5 hover:border-cyan-500/30 transition-all uppercase tracking-wider">
                                        <TagIcon size={12} /> {tag.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="space-y-3">
                            {event.privateDetails && (
                                <div className="rounded-xl overflow-hidden border border-red-900/30 bg-red-950/10">
                                    <ExpandableSection title="Private Details" content={event.privateDetails} color="text-red-400" />
                                </div>
                            )}
                            {event.historical && (
                                <div className="rounded-xl overflow-hidden border border-blue-900/30 bg-blue-950/10">
                                    <ExpandableSection title="Historical Context" content={event.historical} color="text-blue-400" />
                                </div>
                            )}
                        </div>

                        <div className="border-t border-white/5 pt-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="relative">
                                     <button onClick={() => setShowEmojiPicker(p => !p)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-yellow-400 transition-colors"><Smile className="w-5 h-5" /></button>
                                    {showEmojiPicker && (
                                        <div className="absolute bottom-full mb-2 left-0 bg-[#1a1d26] rounded-xl shadow-2xl p-2 border border-white/10 z-20 w-64 animate-in fade-in zoom-in-95">
                                             <div className="grid grid-cols-7 gap-1">
                                                {EMOJIS_FOR_PICKER.map(emoji => (
                                                    <button key={emoji} onClick={() => handleReaction(emoji)} className="text-xl p-1 rounded-full hover:bg-white/10 transition-transform hover:scale-125">{emoji}</button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {Object.entries(reactionsCount).map(([emoji, count]) => (
                                        <span key={emoji} className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-full text-xs border border-white/5 text-slate-300">
                                            <span>{emoji}</span> <span className="font-bold">{count}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-[#0a0c10] rounded-2xl border border-white/5 p-4">
                                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><MessageSquare size={14} /> Discussion</h4>
                                 <div className="max-h-60 overflow-y-auto space-y-4 pr-1 custom-scrollbar mb-4">
                                     {event.comments && event.comments.length > 0 ? (
                                         event.comments.map(comment => (
                                             <div key={comment.id} className="flex items-start gap-3 text-sm group">
                                                 {/* [ZEN FIX] Replaced img with GlassAvatar */}
                                                 <GlassAvatar
                                                    imageUrl={comment.authorAvatarUrl}
                                                    altText={comment.authorName}
                                                    fallbackChar={comment.authorName}
                                                    size="w-8 h-8"
                                                    className="mt-1 flex-shrink-0 border border-white/10"
                                                 />
                                                 <div className="flex-1">
                                                     <div className="bg-[#1a1d26] p-3 rounded-xl rounded-tl-none border border-white/5 relative group-hover:border-white/10 transition-colors">
                                                         <div className="flex justify-between items-start mb-1">
                                                             <span className="font-bold text-slate-200 text-xs">{comment.authorName}</span>
                                                             <CommentActionMenu comment={comment} user={user} onDelete={() => handleDeleteComment(comment.id)} onReport={() => alert('Reported')} onBan={() => alert('User Banned')} />
                                                         </div>
                                                         <span className="text-slate-400 leading-relaxed whitespace-pre-wrap">{comment.content}</span>
                                                     </div>
                                                     <span className="text-[10px] text-slate-600 ml-1 mt-1 block">{new Date(comment.timestamp).toLocaleString()}</span>
                                                 </div>
                                             </div>
                                         ))
                                     ) : (
                                          <p className="text-xs text-slate-600 italic text-center py-4">No reflections recorded yet.</p>
                                     )}
                                     <div ref={commentsEndRef} />
                                 </div>
                                 <CommentInput onAddComment={onAddComment} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventViewerModalFixed;