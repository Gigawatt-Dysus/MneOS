import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { GigiJournalEntry, User, Reaction, Comment } from '@/types';
import CopyButton from '../CopyButton';
import { EllipsisVerticalIcon, ClipboardIcon, DocumentTextIcon, PaperclipIcon, TrashIcon } from '../icons';
import { DEFAULT_EMOJIS } from '@/types';
import { Image as ImageIcon, SmilePlus, Send } from 'lucide-react';
import { GlassAvatar } from '../GlassAvatar'; // [ZEN FIX] Import

// Helpers
const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
};

const formatJournalDate = (date: Date | string) => {
    try {
        const d = new Date(date);
        if (!d || isNaN(d.getTime())) return "Invalid Date";
        const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);
        const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(d);
        const day = d.getDate();
        const year = d.getFullYear();
        const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }).format(d).toLowerCase();
        return `${dayOfWeek}, ${month} ${day}${getOrdinalSuffix(day)}, ${year} | ${time}`;
    } catch (e) { return "Invalid Date"; }
};

const CommentView: React.FC<{ comment: Comment; isAI: boolean }> = ({ comment, isAI }) => {
    const isThinking = comment.id.startsWith('thinking-') || comment.content === 'Thinking...';
    return (
        <div className="flex items-start gap-3 animate-toastIn">
            {/* [ZEN FIX] Replaced img with GlassAvatar */}
            <GlassAvatar
                imageUrl={comment.authorAvatarUrl}
                altText={comment.authorName}
                fallbackChar={comment.authorName}
                size="w-8 h-8"
                className={`mt-1 flex-shrink-0 ${isAI ? 'ai-avatar-glow' : ''}`}
            />
            <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg px-3 py-2">
                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{comment.authorName}</p>
                {isThinking ? (
                    <div className="flex space-x-1 h-5 items-center px-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    </div>
                ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.content}</p>
                )}
            </div>
        </div>
    );
};

const JournalActionsMenu: React.FC<{ entry: GigiJournalEntry, onDelete?: (id: string) => void }> = ({ entry, onDelete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const formatTranscript = () => `Title: ${entry.title}\nDate: ${formatJournalDate(entry.creationDate)}\n\n---\n\n${entry.content}`;

    const handleSave = () => {
        const blob = new Blob([formatTranscript()], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date(entry.creationDate).toISOString().split('T')[0];
        a.download = `journal-${date}-${entry.title.replace(/\s+/g, '-').toLowerCase()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsOpen(false);
    };

    const handleDelete = () => {
        if (onDelete) {
            onDelete(entry.id);
            setIsOpen(false);
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button onClick={() => setIsOpen(p => !p)} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                <EllipsisVerticalIcon className="w-5 h-5" />
            </button>
            {isOpen && (
                <div className="absolute bottom-full mb-2 left-0 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border dark:border-gray-600 z-50 overflow-hidden">
                    <button onClick={() => { navigator.clipboard.writeText(formatTranscript()); setIsOpen(false); }} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">
                        <ClipboardIcon className="w-4 h-4" /> Copy Transcript
                    </button>
                    <button onClick={handleSave} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600">
                        <DocumentTextIcon className="w-4 h-4" /> Save Transcript...
                    </button>
                    {onDelete && (
                        <>
                            <div className="h-px bg-gray-200 dark:bg-gray-600 my-1"></div>
                            <button onClick={handleDelete} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                <TrashIcon className="w-4 h-4" /> Delete Entry
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export const JournalEntry: React.FC<{
    entry: GigiJournalEntry,
    user: User,
    isConversation?: boolean,
    onAddComment: (entryId: string, commentText: string) => void,
    onUpdateEntry: (entry: GigiJournalEntry) => void,
    isModalView?: boolean,
    onDelete?: (id: string) => void;
}> = ({ entry, user, isConversation = false, onAddComment, onUpdateEntry, isModalView = false, onDelete }) => {
    const [reactions, setReactions] = useState<Reaction[]>(entry.reactions || []);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Comment Input State
    const [commentText, setCommentText] = useState('');
    const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
    const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    const emojiList = user.settings?.preferredEmojis || DEFAULT_EMOJIS;

    useEffect(() => { setReactions(entry.reactions || []); }, [entry.reactions]);
    useEffect(() => {
        if (entry.comments?.length) commentsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [entry.comments]);

    const handleReaction = (emoji: string) => {
        let newReactions: Reaction[];
        const idx = reactions.findIndex(r => r.reactorId === user.id);
        if (idx > -1) {
            if (reactions[idx].emoji === emoji) newReactions = reactions.filter(r => r.reactorId !== user.id);
            else { const u = [...reactions]; u[idx] = { ...reactions[idx], emoji }; newReactions = u; }
        } else {
            newReactions = [...reactions, { reactorId: user.id, reactorName: user.displayName, emoji, reactorAvatarUrl: user.profilePictureUrl }];
        }
        setReactions(newReactions);
        onUpdateEntry({ ...entry, reactions: newReactions });
    };

    const handleCommentSubmit = () => {
        if (commentText.trim()) {
            onAddComment(entry.id, commentText.trim());
            setCommentText('');
            if (commentTextareaRef.current) commentTextareaRef.current.style.height = 'auto';
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCommentText(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCommentSubmit();
        }
    };

    const groupedReactions = useMemo(() => reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {} as Record<string, number>), [reactions]);

    const renderMarkdown = (text: string) => {
        const processed = text
            .replace(/^### (.*$)/gim, '<h3 class="text-[1.1em] font-bold mt-2 mb-1">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-[1.25em] font-bold mt-3 mb-2">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-[1.5em] font-extrabold mt-4 mb-2">$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/\n/g, '<br />');
        return <div dangerouslySetInnerHTML={{ __html: processed }} />;
    };

    const contentClasses = isConversation ? "bg-gray-100/80 dark:bg-gray-800/80" : entry.type === 'deep_dive' ? "bg-blue-50/80 dark:bg-gray-800/90 border-l-4 border-blue-300 dark:border-blue-700" : "bg-amber-50/80 dark:bg-gray-800/80";

    const buttonBaseClass = "p-2 rounded-full bg-[#003b6f] text-[#bfb9df] hover:bg-[#002a50] transition-colors shadow-md flex items-center justify-center";

    return (
        <div className={isModalView ? "" : "rounded-lg shadow-lg backdrop-blur-sm relative group border border-gray-200 dark:border-gray-700"}>
            {!isModalView && (
                <div className="relative p-4 bg-gray-900/80 text-white rounded-t-lg">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"><CopyButton textToCopy={entry.content} /></div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-semibold text-gray-100 font-serif">{entry.title}</h2>
                        {entry.type === 'deep_dive' && <span className="text-[10px] bg-blue-600 px-2 py-0.5 rounded font-bold uppercase text-white">RESEARCH</span>}
                        {entry.isAttached && <PaperclipIcon className="w-4 h-4 text-gray-400" />}
                    </div>
                    <p className="text-sm text-gray-400">{formatJournalDate(entry.creationDate)}</p>
                </div>
            )}
            <div className={`${contentClasses} p-6 ${isModalView ? '' : 'rounded-b-lg'}`}>
                {isConversation ? (
                    <div className="mt-4 space-y-4">
                        {entry.content.split('\n').map((line, i) => {
                            const parts = line.split(': ');
                            return (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-300 flex-shrink-0" />
                                    <div><p className="font-bold text-gray-800 dark:text-gray-200">{parts[0]}</p><div className="text-gray-700 dark:text-gray-300">{renderMarkdown(parts.slice(1).join(': '))}</div></div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="prose prose-lg dark:prose-invert max-w-none font-serif text-gray-700 dark:text-gray-300">{renderMarkdown(entry.content)}</div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50 flex items-center gap-2">
                    <div className="relative">
                        <button onClick={() => setShowEmojiPicker(p => !p)} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500" title="React to Entry">
                            <SmilePlus className="w-5 h-5" />
                        </button>
                        {showEmojiPicker && (
                            <div className="absolute bottom-full mb-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg p-2 border dark:border-gray-700 z-50 w-64 grid grid-cols-7 gap-1 max-h-60 overflow-y-auto custom-scrollbar">
                                {emojiList.map((emoji: string) => <button key={emoji} onClick={() => { handleReaction(emoji); setShowEmojiPicker(false); }} className="text-xl p-1 rounded-full hover:bg-gray-200">{emoji}</button>)}
                            </div>
                        )}
                    </div>
                    {Object.entries(groupedReactions).map(([emoji, count]) => (
                        <div key={emoji} className="flex items-center gap-1 bg-violet-100 dark:bg-violet-500/20 px-2 py-0.5 rounded-full text-sm"><span>{emoji}</span><span className="font-bold text-violet-700 dark:text-violet-300">{count}</span></div>
                    ))}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50 space-y-4">
                    <div className="max-h-[40vh] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                        {entry.comments?.map(c => <CommentView key={c.id} comment={c} isAI={c.authorId === 'ai-thinking' || c.authorId !== user.id} />)}
                        <div ref={commentsEndRef} />
                    </div>

                    <div className="flex items-end gap-2 pt-2">
                        {/* [ZEN FIX] Replaced img with GlassAvatar for User */}
                        <GlassAvatar
                            imageUrl={user.profilePictureUrl}
                            altText={user.displayName}
                            fallbackChar={user.displayName}
                            size="w-8 h-8"
                            className="mb-2 shadow-sm"
                        />
                        <div className="mb-1">
                            <JournalActionsMenu entry={entry} onDelete={onDelete} />
                        </div>
                        <div className="flex-grow relative flex items-end gap-2 glass-capsule rounded-[32px] px-3 py-2 transition-all focus-within:ring-1 focus-within:ring-cyan-500/50">
                            <div className="flex gap-2 pb-1.5 items-center pl-1">
                                <button className={buttonBaseClass} title="Attach Media">
                                    <ImageIcon size={18} strokeWidth={2.5} />
                                </button>
                                <div className="w-px h-6 bg-white/10 mx-1 self-center shadow-[1px_0_0_rgba(0,0,0,0.5)]"></div>
                            </div>
                            <textarea
                                ref={commentTextareaRef}
                                value={commentText}
                                onChange={handleInput}
                                onKeyDown={handleKeyDown}
                                placeholder="Write a comment..."
                                className="flex-grow bg-transparent border-none focus:ring-0 text-gray-100 placeholder-gray-500/80 resize-none py-2 max-h-32 min-h-[24px] custom-scrollbar text-[15px] leading-relaxed font-medium"
                                rows={1}
                            />
                            <div className="flex gap-2 pb-1.5 items-center pr-1">
                                <div className="relative">
                                    <button
                                        onClick={() => setShowInputEmojiPicker(p => !p)}
                                        className={buttonBaseClass}
                                    >
                                        <SmilePlus size={20} strokeWidth={2.5} />
                                    </button>

                                    {showInputEmojiPicker && (
                                        <div className="absolute bottom-12 right-0 glass-capsule shadow-2xl rounded-xl p-3 w-72 grid grid-cols-8 gap-1 z-50 max-h-60 overflow-y-auto custom-scrollbar">
                                            {emojiList.map((emoji: string, idx: number) => (
                                                <button key={`${emoji}-${idx}`} onClick={() => { setCommentText(prev => prev + emoji); setShowInputEmojiPicker(false); commentTextareaRef.current?.focus(); }} className="hover:bg-white/10 rounded p-1.5 text-xl transition-colors">
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleCommentSubmit}
                                    disabled={!commentText.trim()}
                                    className={`${buttonBaseClass} w-10 h-10 transition-all duration-300 ${!commentText.trim()
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:scale-105 active:scale-95 animate-pulse drop-shadow-[0_0_8px_#bfb9df]'
                                        }`}
                                >
                                    <Send size={20} strokeWidth={2.5} className={!commentText.trim() ? "" : "ml-0.5"} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JournalEntry;