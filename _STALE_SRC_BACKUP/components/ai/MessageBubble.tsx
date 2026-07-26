import React, { useState, useRef, useEffect } from 'react';
import { TrashIcon, ClipboardIcon, EmojiIcon, XIcon, EllipsisVerticalIcon, ThumbsUpIcon, ThumbsDownIcon } from '../icons';
import { Save, Pencil } from 'lucide-react';
import type { ChatMessage, User, View } from '@/types';
import MarkdownRenderer from './MarkDownRenderer';
import { GlassAvatar } from '../GlassAvatar';
import { MarkdownEditor } from '../shared/MarkdownEditor';
import { QUICK_REACTIONS } from '@/types';

interface MessageBubbleProps {
    msg: ChatMessage;
    user: User;
    onNavigate: (view: View, data?: any) => void;
    onDelete?: () => void;
    onEdit?: (newContent: string) => void;
    onReact?: (emoji: string) => void;
    onFeedback?: (isPositive: boolean) => void;
    onSaveToContext?: (text: string) => void;
    isIncinerating?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ msg, user, onNavigate, onDelete, onEdit, onReact, onFeedback, onSaveToContext, isIncinerating }) => {
    const [showMeta, setShowMeta] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    // [ZEN FIX] Edit Content State
    const [editContent, setEditContent] = useState(msg.content);
    const menuRef = useRef<HTMLDivElement>(null);

    const author = msg.author ?
        (user.aiCompanions.find(c => c.name === msg.author?.name) || msg.author) :
        (user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0]);

    const companionData = user.aiCompanions.find(c => c.name === author?.name);
    const isUser = msg.role === 'user';
    const isSystem = msg.role === 'system';

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
        setEditContent(msg.content); // Reset content on open
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
        if (!msg.imageUrl) return null;
        const isVideo = msg.imageUrl.match(/\.(mp4|webm|ogg|mov)$/i) || (msg.mimeType && msg.mimeType.startsWith('video/'));
        const mediaStyle = "rounded-lg w-full max-w-full h-auto max-h-[400px] object-contain mb-2 border border-white/10 shadow-md bg-black/20";
        return isVideo ? <video src={msg.imageUrl} controls className={mediaStyle} /> : <img src={msg.imageUrl} alt="Content" className={mediaStyle} />;
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
                <button className="p-2 self-end -mb-1 cursor-pointer transition-transform hover:scale-105" onClick={() => onNavigate('aiCompanionEditor')}>
                    <GlassAvatar imageUrl={author.avatarUrl} altText={author.name} fallbackChar={author.name} size="w-6 h-6" className="shadow-lg" />
                </button>
            )}

            <div className={`relative max-w-[85%] md:max-w-md lg:max-w-lg flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                    className={`px-5 py-3 ${bubbleClass} liquid-bubble relative group/bubble transition-transform duration-200 overflow-hidden w-full`}
                    style={customStyle}
                    onDoubleClick={() => !isEditing && setShowMeta(!showMeta)}
                >
                    {renderMedia()}

                    {/* [ZEN FIX] Updated Props for Controlled Component */}
                    {isEditing ? (
                        <div className="min-w-[300px]">
                            <MarkdownEditor
                                value={editContent}
                                onChange={setEditContent}
                                onSave={handleSaveEdit}
                                onCancel={() => setIsEditing(false)}
                                saveLabel="Update"
                                autoFocus
                            />
                        </div>
                    ) : (
                        <div className={`message-bubble-text text-[15px] leading-relaxed tracking-wide font-light break-words ${isIncinerating ? 'incinerating-message' : ''}`}>
                            <MarkdownRenderer content={msg.content} onNavigate={onNavigate} />
                        </div>
                    )}

                    {!isEditing && msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 -mb-1">
                            {msg.reactions.map((r, i) => (
                                <span key={i} className="text-xs bg-black/20 hover:bg-black/40 cursor-pointer transition-colors px-2 py-0.5 rounded-full border border-white/5 shadow-sm" title={r.reactorName}>{r.emoji}</span>
                            ))}
                        </div>
                    )}

                    {showMeta && !isEditing && (
                        <div className="mt-2 pt-1 border-t border-white/10 text-[10px] opacity-60 font-mono text-right w-full select-none">
                            {formattedTime}
                        </div>
                    )}
                </div>

                {!isEditing && (
                    <div className={`
                    absolute top-full mt-1 flex flex-wrap items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 z-10 max-w-full
                    ${isUser ? 'right-0 flex-row-reverse pr-1' : 'left-0 pl-1'}
                `}>
                        {!isUser && onSaveToContext && (
                            <button onClick={() => onSaveToContext(msg.content)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-green-400 hover:bg-[#2f3136] rounded-full transition-colors"><Save size={14} /></button>
                        )}
                        <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-yellow-400 hover:bg-[#2f3136] rounded-full transition-colors relative">
                            <EmojiIcon className="w-4 h-4" weight="bold" />
                            {showReactionPicker && (
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#18191c] border border-white/10 rounded-xl shadow-2xl p-2 flex gap-1 z-50 animate-in zoom-in-95">
                                    {QUICK_REACTIONS.map((emoji: string) => (
                                        <button key={emoji} onClick={(e) => handleReactionClick(emoji, e)} className="hover:bg-[#2f3136] rounded p-1 text-lg transition-colors">{emoji}</button>
                                    ))}
                                </div>
                            )}
                        </button>
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
                                    {onDelete && (
                                        <button onClick={handleDelete} className="w-full text-left px-3 py-2 hover:bg-red-500/20 hover:text-red-400 flex items-center gap-2 transition-colors text-red-500 border-t border-white/5">
                                            <TrashIcon className="w-3 h-3" /> Delete
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {isUser && (
                <button className="p-2 self-end -mb-1 cursor-pointer transition-transform hover:scale-105" onClick={() => onNavigate('profile')}>
                    <GlassAvatar imageUrl={user.profilePictureUrl} altText="User" fallbackChar="U" size="w-6 h-6" className="shadow-lg" />
                </button>
            )}
        </div>
    );
};

export default MessageBubble;