import React, { useState, useMemo } from 'react';
import { Edit2, Trash2, Smile, MessageSquare, MapPin, Tag as TagIcon, MoreHorizontal, Eye, ExternalLink } from 'lucide-react';
import type { LifeEvent, Media, Tag, User, Reaction } from '@/types';
import { ExpandableSection, CommentActionMenu, CommentInput } from './TimelineShared';
import { EMOJIS_FOR_PICKER } from '../GigiJournalView';
import { GlassAvatar } from '../GlassAvatar'; // [ZEN FIX] Import

interface EventCardProps {
    event: LifeEvent;
    media: Media[];
    tags: Tag[];
    user: User;
    onEdit: () => void;
    onView: () => void;
    onTagClick: (tag: Tag) => void;
    onMediaClick: (media: Media) => void;
    onAddComment: (text: string) => void;
    onUpdateEvent: (event: LifeEvent) => void;
    onDeleteEvent?: (id: string) => void;
    viewMode: 'list' | 'tile';
}

export const EventCard: React.FC<EventCardProps> = ({ event, media, tags, user, onEdit, onView, onTagClick, onMediaClick, onAddComment, onUpdateEvent, onDeleteEvent, viewMode }) => {
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showComments, setShowComments] = useState(false);

    const eventMedia = useMemo(() =>
        media.filter(m => event.mediaIds?.includes(m.id)),
        [media, event.mediaIds]
    );

    const eventTags = useMemo(() =>
        tags.filter(t => event.tagIds?.includes(t.id)),
        [tags, event.tagIds]
    );
    
    const dateObj = event.date instanceof Date && !isNaN(event.date.getTime()) ? event.date : new Date();
    
    const day = dateObj.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' });
    const month = dateObj.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    const year = dateObj.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'UTC' });
    
    const fullDate = dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'UTC'
    });

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

    const handleDeleteEvent = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDeleteEvent) {
            if (window.confirm("⚠️ IRREVERSIBLE ACTION\n\nAre you sure you want to DELETE this event?\nThis will remove it from your timeline forever.")) {
                onDeleteEvent(event.id);
            }
        }
    };

    const handleReportUser = (userId: string) => {
        alert(`Report submitted for user ${userId}.`);
    };

    const handleBanUser = (userId: string) => {
        alert(`User ${userId} banned locally.`);
    };

    const reactionsCount = (event.reactions || []).reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const isTile = viewMode === 'tile';

    // --- BENTO TILE VIEW ---
    if (isTile) {
        return (
            <div 
                onClick={onView}
                className="group relative flex flex-col h-full bg-[#0f1219] rounded-3xl border border-white/5 shadow-lg overflow-hidden hover:border-cyan-500/50 hover:shadow-cyan-900/20 transition-all cursor-pointer"
            >
                 <div className="relative p-4 bg-gradient-to-b from-[#1a1d26] to-[#0f1219] border-b border-white/5 flex justify-between items-start">
                     <div className="overflow-hidden">
                        <h3 className="text-md font-bold text-white truncate pr-2">{event.title || "Untitled"}</h3>
                        <p className="text-[10px] text-cyan-500 font-mono tracking-wider">{fullDate}</p>
                    </div>
                    
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onView(); }} 
                            className="p-1.5 text-cyan-400 hover:text-white hover:bg-cyan-900/50 rounded-lg"
                            title="Open Viewer (Deep Dive)"
                        >
                            <Eye size={14} />
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
                            title="Edit"
                        >
                            <Edit2 size={14} />
                        </button>
                        {onDeleteEvent && (
                            <button 
                                onClick={handleDeleteEvent} 
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg"
                                title="Delete"
                            >
                               <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="p-4 flex-grow flex flex-col">
                    <p className="text-sm text-slate-400 line-clamp-4 mb-4 flex-grow font-light leading-relaxed">{event.details}</p>
                    
                    {eventMedia.length > 0 && (
                        <div className="flex gap-2 overflow-hidden mb-3">
                             {eventMedia.slice(0, 3).map(mediaItem => (
                                 <img key={mediaItem.id} src={mediaItem.thumbnailUrl || mediaItem.url} className="w-10 h-10 rounded-lg object-cover border border-white/10" alt="thumbnail" />
                             ))}
                             {eventMedia.length > 3 && <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs text-slate-500 font-bold">+{eventMedia.length - 3}</div>}
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-white/5" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                            {Object.entries(reactionsCount).slice(0, 3).map(([emoji, count]) => (
                                <span key={emoji} className="text-[10px] bg-white/5 text-slate-300 px-1.5 py-0.5 rounded border border-white/5">{emoji} {count}</span>
                            ))}
                         </div>
                        <button onClick={() => setShowComments(p => !p)} className="flex items-center gap-1 text-[10px] text-cyan-500 hover:text-cyan-400 font-bold uppercase tracking-wider">
                            <MessageSquare size={12} /> {event.comments?.length || 0}
                        </button>
                    </div>

                     {showComments && (
                         <div className="mt-3 pt-2 border-t border-white/5 animate-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
                             <div className="max-h-32 overflow-y-auto mb-2 custom-scrollbar">
                                 {event.comments?.map(c => (
                                    <div key={c.id} className="text-xs text-slate-400 mb-2">
                                         <span className="font-bold text-slate-200">{c.authorName}:</span> {c.content}
                                    </div>
                                 ))}
                             </div>
                            <CommentInput onAddComment={onAddComment} />
                         </div>
                     )}
                </div>
            </div>
        );
    }

    // --- BENTO LIST VIEW (The Main Stream) ---
    return (
        <div id={`event-card-${event.id}`} className="mb-6 relative group max-w-5xl mx-auto flex flex-col md:flex-row bg-[#0f1219] rounded-3xl border border-white/5 overflow-hidden shadow-xl hover:shadow-cyan-900/10 transition-all">
            
            {/* Left Column: Date Block (Clickable) */}
            <div 
                onClick={onView}
                className="md:w-32 bg-[#0a0c10] border-b md:border-b-0 md:border-r border-white/5 p-4 flex flex-row md:flex-col items-center justify-between md:justify-center text-center cursor-pointer relative overflow-hidden"
                title="Click to Open Viewer"
            >
                <div className="absolute inset-0 bg-cyan-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <span className="text-xs font-bold text-white tracking-widest uppercase flex flex-col items-center gap-1">
                        <ExternalLink size={16} /> Open
                    </span>
                </div>

                <div className="flex flex-col items-center group-hover:opacity-20 transition-opacity">
                    <span className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none">
                        {day}
                    </span>
                    <span className="text-xs font-bold text-cyan-500 uppercase tracking-[0.2em] mt-1">
                        {month}
                    </span>
                    <span className="text-xs font-mono text-slate-600 mt-1">
                        {year}
                    </span>
                </div>
                <div className="md:hidden text-slate-600"><MoreHorizontal /></div>
            </div>

            {/* Right Column: Content */}
            <div className="flex-1 p-6 relative">
                <div className="flex justify-between items-start mb-3">
                     <div onClick={onView} className="cursor-pointer">
                        <h2 className="text-xl md:text-2xl font-bold text-white hover:text-cyan-400 transition-colors tracking-tight">{event.title || "Untitled Event"}</h2>
                        {event.location && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                <MapPin size={12} className="text-emerald-500" />
                                {event.location.addressLocality || event.location.streetAddress}
                            </div>
                         )}
                    </div>
                    
                    {/* Actions Row */}
                    <div className="flex gap-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onView(); }}
                            className="p-2 rounded-xl bg-cyan-900/20 text-cyan-400 border border-cyan-900/50 hover:bg-cyan-600 hover:text-white transition-colors"
                            aria-label="View details"
                            title="Open Viewer & AI Tools"
                        >
                            <Eye size={16} />
                        </button>

                        <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(); }}
                            className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            aria-label="Edit event"
                            title="Edit Event Content"
                        >
                            <Edit2 size={16} />
                        </button>

                        {onDeleteEvent && (
                            <button 
                                onClick={handleDeleteEvent}
                                className="p-2 rounded-xl bg-red-950/20 text-red-400 hover:bg-red-600 hover:text-white border border-transparent hover:border-red-500 transition-colors"
                                aria-label="Delete event"
                                title="Delete Event"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed mb-6 cursor-pointer" onClick={onView}>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{event.details}</p>
                </div>
                
                {eventMedia.length > 0 && (
                    <div className="my-6 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {eventMedia.map(mediaItem => (
                             <div 
                                key={mediaItem.id} 
                                className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group/media cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); onMediaClick(mediaItem); }}
                            >
                                <img 
                                    src={mediaItem.thumbnailUrl || mediaItem.url} 
                                    alt={mediaItem.caption} 
                                    className="w-full h-full object-cover group-hover/media:scale-110 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover/media:bg-cyan-900/20 transition-colors"></div>
                            </div>
                        ))}
                    </div>
                )}
                
                {eventTags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 mb-4">
                        {eventTags.map(tag => (
                            <button 
                                key={tag.id} 
                                onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
                                className="flex items-center gap-1 bg-[#0a0c10] text-slate-400 hover:text-cyan-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/5 hover:border-cyan-500/30 transition-all uppercase tracking-wider"
                            >
                                <TagIcon size={10} /> {tag.name}
                            </button>
                         ))}
                    </div>
                )}

                <div className="space-y-2 mb-4">
                    {event.privateDetails && (
                        <div onClick={e => e.stopPropagation()} className="rounded-xl overflow-hidden border border-red-900/30">
                             <ExpandableSection title="Private Details" content={event.privateDetails} color="text-red-400" />
                        </div>
                    )}
                    
                    {event.historical && (
                        <div onClick={e => e.stopPropagation()} className="rounded-xl overflow-hidden border border-blue-900/30">
                            <ExpandableSection title="Historical Context" content={event.historical} color="text-blue-400" />
                        </div>
                    )}
                </div>
                
                {/* Interaction Footer - REACTIONS AND COMMENTS */}
                <div className="pt-4 border-t border-white/5 flex items-center gap-4" onClick={e => e.stopPropagation()}>
                    
                    {/* Smiley Button */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowEmojiPicker(p => !p)} 
                            className="p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-yellow-400 transition-colors"
                            title="React to this"
                        >
                            <Smile className="w-5 h-5" />
                        </button>
                        {showEmojiPicker && (
                            <div className="absolute bottom-full mb-2 left-0 bg-[#1a1d26] rounded-xl shadow-2xl p-2 border border-white/10 z-20 w-64 animate-in fade-in zoom-in-95">
                                 <div className="grid grid-cols-7 gap-1">
                                     {EMOJIS_FOR_PICKER.map(emoji => (
                                         <button key={emoji} onClick={() => handleReaction(emoji)} className="text-xl p-1 rounded-full hover:bg-white/10 transition-transform hover:scale-125">
                                            {emoji}
                                        </button>
                                     ))}
                                 </div>
                            </div>
                        )}
                    </div>

                    {/* Reactions Rendered HERE */}
                    <div className="flex gap-2 flex-wrap items-center">
                        {Object.entries(reactionsCount).map(([emoji, count]) => (
                            <span key={emoji} className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-lg text-xs border border-white/5 hover:bg-white/10 transition-colors cursor-default">
                                <span className="text-base leading-none">{emoji}</span>
                                <span className="font-bold text-slate-300">{count}</span>
                            </span>
                        ))}
                    </div>

                    <div className="flex-grow"></div>

                    <button 
                        onClick={() => setShowComments(p => !p)} 
                        className="flex items-center gap-2 text-sm text-slate-500 hover:text-cyan-400 font-medium transition-colors"
                    >
                        <MessageSquare size={16} />
                        {event.comments?.length || 0} <span className="hidden sm:inline">Comments</span>
                    </button>
                </div>
                
                 {showComments && (
                     <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 bg-[#0a0c10] p-4 rounded-xl border border-white/5" onClick={e => e.stopPropagation()}>
                         <div className="max-h-60 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                              {event.comments?.map(comment => (
                                 <div key={comment.id} className="flex items-start gap-3 text-sm group">
                                     {/* [ZEN FIX] Replaced img with GlassAvatar */}
                                     <GlassAvatar
                                        imageUrl={comment.authorAvatarUrl}
                                        altText={comment.authorName}
                                        fallbackChar={comment.authorName}
                                        size="w-8 h-8"
                                        className="mt-1 flex-shrink-0 border border-white/10"
                                     />
                                     <div className="flex-grow">
                                          <div className="flex justify-between items-start mb-1">
                                             <span className="font-bold text-slate-200 text-xs">{comment.authorName}</span>
                                              <CommentActionMenu 
                                                        comment={comment} 
                                                        user={user} 
                                                        onDelete={() => handleDeleteComment(comment.id)}
                                                        onReport={() => handleReportUser(comment.authorId)}
                                                        onBan={() => handleBanUser(comment.authorId)}
                                             />
                                          </div>
                                          <p className="text-slate-400 leading-relaxed">{comment.content}</p>
                                     </div>
                                 </div>
                             ))}
                         </div>
                         <div className="mt-4 pt-4 border-t border-white/5">
                            <CommentInput onAddComment={onAddComment} />
                         </div>
                     </div>
                 )}
            </div>
        </div>
    );
};