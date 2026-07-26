import React, { useState, useRef, useEffect } from 'react';
import { TrashIcon, ClipboardIcon, EmojiIcon, XIcon, EllipsisVerticalIcon, ThumbsUpIcon, ThumbsDownIcon } from '../icons';
import { Save, Pencil, Trash2, X, RotateCcw } from 'lucide-react';
import type { ChatMessage, User, View } from '../../types';
import MarkdownRenderer from './MarkDownRenderer';
import { GlassAvatar } from '../GlassAvatar';
import { MarkdownEditor } from '../shared/MarkdownEditor';
import { QUICK_REACTIONS } from '../../types';

interface MessageBubbleProps {
    msg: ChatMessage;
    user: User;
    onNavigate: (view: View, data?: any) => void;
    onDelete?: () => void;
    onEdit?: (newContent: string) => void;
    onReact?: (emoji: string) => void;
    onFeedback?: (isPositive: boolean) => void;
    onSaveToContext?: (text: string) => void;
    onSaveToMatrix?: (msg: ChatMessage) => void;
    onPromoteToCore?: (msg: ChatMessage) => void;
    onSetFiction?: (msg: ChatMessage, status: boolean) => void; // [ZEN V14]
    // [ZEN V14] Bulk Mode
    isBulkMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
    otherLastReadTimestamp?: number;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, user, onNavigate, onDelete, onEdit, onReact, onFeedback, onSaveToContext, onSaveToMatrix, onPromoteToCore, onSetFiction, isBulkMode, isSelected, onToggleSelect, otherLastReadTimestamp }) => {
    const [showMeta, setShowMeta] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(msg.content);
    const [isConfirmingVaporize, setIsConfirmingVaporize] = useState(false); // [ZEN V27]
    const menuRef = useRef<HTMLDivElement>(null);

    // Identity Resolution
    const isPeerSegment = 'fromUid' in msg;
    const isUser = isPeerSegment ? (msg as any).fromUid === user.id : msg.role === 'user';
    const isSystem = msg.role === 'system';

    // Resolve Author Data
    let authorName = '';
    let authorAvatar = '';
    let companionData: any = null;

    if (isPeerSegment) {
        const seg = msg as any;
        authorName = seg.fromName;
        authorAvatar = seg.fromAvatarUrl || '';
        if (seg.authorType === 'ai') {
            companionData = user.aiCompanions.find(c => c.id === seg.responderAgentId || c.name === seg.fromName);
        }
    } else {
        const auth = msg.author || (user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0]);
        authorName = auth.name;
        authorAvatar = auth.avatarUrl;
        companionData = user.aiCompanions.find(c => c.name === auth.name);
    }

    // [ZEN FIX] Use User Settings for Quick Reactions
    const reactionsList = user.settings?.preferredEmojis?.length
        ? user.settings.preferredEmojis
        : QUICK_REACTIONS;

    const customStyle: React.CSSProperties = (!isUser && companionData) ? {
        backgroundColor: companionData.bubbleBackgroundColor || '#2f3136',
        color: companionData.bubbleTextColor || '#ffffff',
    } : (isUser ? {
        backgroundColor: '#7c3aed',
    } : {
        backgroundColor: '#2f3136',
    });

    const bubbleClass = isUser ? 'rounded-2xl text-white' : 'rounded-2xl text-gray-100';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
                setShowReactionPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(msg.content);
        setShowMenu(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (onDelete) {
            onDelete();
            setShowMenu(false);
        }
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditContent(msg.content);
        setIsEditing(true);
        setShowMenu(false);
    };

    const handleSaveEdit = (contentToSave: string) => {
        if (onEdit && contentToSave.trim() !== msg.content) {
            onEdit(contentToSave);
        }
        setIsEditing(false);
    };

    const handleReactionClick = (emoji: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onReact) onReact(emoji);
        setShowReactionPicker(false);
    };

    const renderMedia = () => {
        if (!msg.imageUrl || msg.isDeleted) return null;
        const isVideo = msg.imageUrl.match(/\.(mp4|webm|ogg|mov)$/i) || (msg.mimeType && msg.mimeType.startsWith('video/'));
        const mediaStyle = "rounded-lg w-full max-w-full h-auto max-h-[400px] object-contain mb-2 border border-white/10 shadow-md bg-black/20 cursor-pointer hover:brightness-110 transition-all active:scale-[0.98]";
        return (
            <div onClick={() => onSaveToMatrix?.(msg)} title="Copy to Matrix Staging">
                {isVideo ? (
                    <video
                        src={msg.imageUrl}
                        poster={msg.thumbnailUrl}
                        className={mediaStyle}
                    />
                ) : (
                    <img src={msg.imageUrl} alt="Content" className={mediaStyle} />
                )}
            </div>
        );
    };

    const formattedTime = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';

    if (isSystem) {
        return (
            <div className="flex justify-center my-4 group relative">
                <span className="text-xs font-mono text-gray-500 bg-[#18191c] px-4 py-1.5 rounded-full border border-white/5 shadow-inner flex items-center gap-2">
                    {msg.content}
                    {onDelete && <button onClick={handleDelete} className="ml-2 hover:text-red-400 text-gray-600 font-bold"><XIcon className="w-3 h-3" /></button>}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex items-end gap-2 mb-6 group/row ${isUser ? 'justify-end' : 'justify-start'}`} ref={menuRef}>
            {!isUser && (
                <button className="p-2 self-end -mb-1 cursor-pointer transition-transform hover:scale-105" onClick={() => onNavigate(companionData ? 'aiCompanionEditor' : 'archivists')}>
                    <GlassAvatar imageUrl={authorAvatar} altText={authorName} fallbackChar={authorName[0]} size="w-6 h-6" className="shadow-lg" />
                </button>
            )}

            <div className={`relative max-w-[85%] md:max-w-md lg:max-w-lg flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                {!isUser && <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-2 mb-1">{authorName}</span>}
                <div
                    className={`px-5 py-3 ${bubbleClass} liquid-bubble relative group/bubble transition-transform duration-200 w-full ${msg.isDeleted ? 'opacity-40 grayscale italic border-dashed border-white/20' : ''}`}
                    style={customStyle}
                    onDoubleClick={() => !isEditing && !msg.isDeleted && setShowMeta(!showMeta)}
                >
                    {/* [ZEN V14] FICTION STATUS LED */}
                    {/* [ZEN V14] FICTION STATUS LED */}
                    {!isEditing && !msg.isDeleted && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const currentStatus = (msg as any).fiction ?? (msg as any).is_fiction ?? undefined;
                                const newStatus = currentStatus === true ? false : true; // Toggle or Default to True (Writer mode first)

                                // Optimistic Toggle or Callback
                                if (onSetFiction) {
                                    onSetFiction(msg, newStatus);
                                } else {
                                    // Direct singleton fallback
                                    import('../../services/typesenseService').then(({ typesenseService }) => {
                                        if (msg.id) typesenseService.setFictionStatus(msg.id, newStatus);
                                    });
                                }
                            }}
                            title={(msg as any).fiction ? "Status: Creative (Roleplay) - Click to Ground" : ((msg as any).fiction === false ? "Status: Grounded (Fact) - Click to Create" : "Status: Undefined")}
                            className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border border-white/40 shadow-lg z-20 focus:outline-none transition-all duration-300
                                ${(msg as any).fiction === true ? 'bg-[#BC13FE] animate-[purple-glow-pulse_2s_infinite]' : ''}
                                ${(msg as any).fiction === false ? 'bg-[#00FF41] shadow-[0_0_5px_#00FF41]' : ''}
                                ${(msg as any).fiction === undefined ? 'bg-slate-700 hover:bg-white' : ''}
                                ${isUser ? 'right-auto left-2' : ''}
                            `}
                        />
                    )}

                    {renderMedia()}

                    {msg.isDeleted ? (
                        <div className="flex items-center gap-2 text-[11px] font-mono tracking-tighter opacity-80 py-2">
                            <TrashIcon className="w-4 h-4" />
                            <span>Signal Scrubbed by {authorName} {msg.deletedAt ? `at ${new Date(msg.deletedAt).toLocaleTimeString()}` : ''}</span>
                        </div>
                    ) : isEditing ? (
                        <div className="min-w-[300px]">
                            <MarkdownEditor
                                value={editContent}
                                onChange={setEditContent}
                                onSave={handleSaveEdit}
                                onCancel={() => setIsEditing(false)}
                                saveLabel="Update"
                                autoFocus
                                mode="modal"
                                // [ZEN FIX] Persistent Context Wiring
                                initialFictionStatus={(msg as any).fiction ?? (msg as any).is_fiction}
                                onFictionStatusChange={(newStatus) => {
                                    if (onSetFiction) {
                                        onSetFiction(msg, newStatus);
                                    } else {
                                        import('../../services/typesenseService').then(({ typesenseService }) => {
                                            if (msg.id) typesenseService.setFictionStatus(msg.id, newStatus);
                                        });
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <div className="message-bubble-text text-[15px] leading-relaxed tracking-wide font-light break-words">
                            <MarkdownRenderer content={msg.content} onNavigate={onNavigate} />
                        </div>
                    )}

                    {!isEditing && !msg.isDeleted && msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 -mb-1">
                            {msg.reactions.map((r, i) => (
                                <span key={i} className="text-xs bg-black/20 hover:bg-black/40 cursor-pointer transition-colors px-2 py-0.5 rounded-full border border-white/5 shadow-sm" title={r.reactorName}>{r.emoji}</span>
                            ))}
                        </div>
                    )}

                    {showMeta && !isEditing && !msg.isDeleted && (
                        <div className="mt-2 pt-1 border-t border-white/10 text-[10px] opacity-60 font-mono text-right w-full select-none">
                            {formattedTime}
                        </div>
                    )}

                    {/* [ZEN V14] BULK SELECT OVERLAY */}
                    {isBulkMode && (
                        <div
                            onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(); }}
                            className={`absolute inset-0 z-50 cursor-pointer rounded-2xl transition-all border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-500/20 border-indigo-500' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                        >
                            {isSelected && (
                                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12" /></svg>
                                </div>
                            )}
                        </div>
                    )}

                    {/* [ZEN V27] IN-LINE VAPORIZER (KISS UI) - PHYSICALLY MOUNTED IN BUBBLE */}
                    {!isEditing && !msg.isDeleted && (
                        <div className={`absolute bottom-2 right-2 flex items-center gap-1 opacity-30 group-hover/bubble:opacity-100 transition-opacity duration-200 z-[100] ${isUser ? 'right-auto left-2 flex-row-reverse' : ''}`}>
                            {isConfirmingVaporize ? (
                                <div className="flex items-center gap-1 animate-in slide-in-from-right-2 duration-300">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setIsConfirmingVaporize(false); }}
                                        className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); setIsConfirmingVaporize(false); }}
                                        className="bg-red-500 hover:bg-red-400 text-white text-[9px] font-black uppercase px-2 py-1 rounded shadow-lg transition-all active:scale-95 whitespace-nowrap"
                                    >
                                        Confirm - Vaporize?
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsConfirmingVaporize(true); }}
                                    className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/20 rounded-full transition-all bg-black/20 backdrop-blur-sm border border-white/10"
                                    title="Vaporize Signal"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {!isEditing && !msg.isDeleted && (
                <div className={`
                    absolute top-full mt-1 flex flex-wrap items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 z-10 max-w-full
                    ${isUser ? 'right-0 flex-row-reverse pr-1' : 'left-0 pl-1'}
                `}>
                    {/* [Removed external Vaporizer tray entry - moved inside bubble] */}

                    {!isUser && onSaveToContext && (
                        <button onClick={() => onSaveToContext(msg.content)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-green-400 hover:bg-[#2f3136] rounded-full transition-colors"><Save size={14} /></button>
                    )}

                    <div className="relative">
                        <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-yellow-400 hover:bg-[#2f3136] rounded-full transition-colors">
                            <EmojiIcon className="w-4 h-4" weight="bold" />
                        </button>

                        {showReactionPicker && (
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#18191c] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-in zoom-in-95 grid grid-cols-4 gap-1 min-w-[120px]">
                                {reactionsList.map((emoji: string, index: number) => (
                                    <button key={`${emoji}-${index}`} onClick={(e) => handleReactionClick(emoji, e)} className="hover:bg-[#2f3136] rounded p-1 text-lg transition-colors">{emoji}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    {!isUser && onFeedback && (
                        <>
                            <button onClick={() => onFeedback(true)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-green-400 hover:bg-[#2f3136] rounded-full transition-colors"><ThumbsUpIcon className="w-4 h-4" weight="bold" /></button>
                            <button onClick={() => onFeedback(false)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-[#2f3136] rounded-full transition-colors"><ThumbsDownIcon className="w-4 h-4" weight="bold" /></button>
                        </>
                    )}
                    <div className="relative">
                        <button onClick={() => setShowMenu(!showMenu)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#2f3136] rounded-full transition-colors">
                            <EllipsisVerticalIcon className="w-4 h-4" weight="bold" />
                        </button>
                        {showMenu && (
                            <div className={`absolute bottom-full mb-1 w-32 bg-[#18191c] border border-white/10 rounded-lg shadow-2xl z-50 py-1 text-xs text-gray-300 ${isUser ? 'right-0' : 'left-0'}`}>
                                <button onClick={handleCopy} className="w-full text-left px-3 py-2 hover:bg-[#5865F2] hover:text-white flex items-center gap-2 transition-colors">
                                    <ClipboardIcon className="w-3 h-3" /> Copy Text
                                </button>
                                {onEdit && (
                                    <button onClick={handleEditClick} className="w-full text-left px-3 py-2 hover:bg-violet-500/20 hover:text-violet-400 flex items-center gap-2 transition-colors border-t border-white/5">
                                        <Pencil className="w-3 h-3" /> Edit
                                    </button>
                                )}
                                {onPromoteToCore && (
                                    <button onClick={() => { onPromoteToCore(msg); setShowMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-amber-500/20 hover:text-amber-400 flex items-center gap-2 transition-colors border-t border-white/5">
                                        {/* Using a simple star/brain icon */}
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                        Promote to Core
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        onClick={handleDelete}
                                        disabled={isPeerSegment && otherLastReadTimestamp !== undefined && (msg as any).timestamp < otherLastReadTimestamp}
                                        className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-t border-white/5 ${isPeerSegment && otherLastReadTimestamp !== undefined && (msg as any).timestamp < otherLastReadTimestamp
                                            ? 'opacity-20 cursor-not-allowed text-gray-400'
                                            : 'hover:bg-red-500/20 hover:text-red-400 text-red-500'
                                            }`}
                                        title={isPeerSegment && otherLastReadTimestamp !== undefined && (msg as any).timestamp < otherLastReadTimestamp ? "Cannot delete read signals" : "Delete"}
                                    >
                                        <TrashIcon className="w-3 h-3" /> {isPeerSegment && otherLastReadTimestamp !== undefined && (msg as any).timestamp < otherLastReadTimestamp ? 'Read (Locked)' : 'Delete'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {isUser && (
                <button className="p-2 self-end -mb-1 cursor-pointer transition-transform hover:scale-105" onClick={() => onNavigate('profile')}>
                    <GlassAvatar imageUrl={user.profilePictureUrl} altText="User" fallbackChar="U" size="w-6 h-6" className="shadow-lg" />
                </button>
            )}
        </div>
    );
};

export default MessageBubble;