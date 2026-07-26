import React, { useState, useRef, useEffect } from 'react';
import { EllipsisVerticalIcon, TrashIcon, EmojiIcon, SendIcon } from '../icons'; 
import { DEFAULT_EMOJIS } from '../../types'; // [ZEN FIX] Correct source
import type { Comment, User } from '../../types';

export const ExpandableSection: React.FC<{ title: string; content: string; color: string }> = ({ title, content, color }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="mt-4">
            <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                className={`flex justify-between items-center w-full text-left text-sm font-medium ${color}`}
                title={isExpanded ? "Collapse section" : "Expand section"}
            >
                <span>{title}</span>
                <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>▼</span>
            </button>
            {isExpanded && (
                <div className="mt-2 pl-4 border-l-2 border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 prose prose-sm dark:prose-invert">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>
                </div>
            )}
        </div>
    );
};

export const CommentActionMenu: React.FC<{ 
    comment: Comment; 
    user: User; 
    onDelete: () => void;
    onReport: () => void;
    onBan: () => void;
}> = ({ comment, user, onDelete, onReport, onBan }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const isMe = comment.authorId === user.id;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={menuRef}>
            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(p => !p); }} 
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Comment Actions"
            >
                <EllipsisVerticalIcon className="w-4 h-4" />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1 text-sm">
                    <button onClick={() => { onDelete(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2" title="Delete this comment">
                        <TrashIcon className="w-4 h-4" /> Delete
                    </button>
                    {!isMe && (
                        <>
                            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1"></div>
                            <button onClick={() => { onReport(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" title="Report this user">Report</button>
                            <button onClick={() => { onBan(); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" title="Ban this user">Ban User</button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export const CommentInput: React.FC<{ onAddComment: (text: string) => void; }> = ({ onAddComment }) => {
    const [commentText, setCommentText] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [commentText]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (commentText.trim()) {
            onAddComment(commentText.trim());
            setCommentText('');
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex items-start gap-2 pt-2">
            <div className="flex-grow relative">
                <textarea
                    ref={textareaRef}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Write a comment..."
                    rows={1}
                    style={{ maxHeight: '120px' }}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-2 pr-12 text-sm focus:ring-1 focus:ring-violet-500 focus:outline-none resize-none custom-scrollbar"
                />
                 <div className="absolute right-1 top-2 flex items-center gap-1">
                    <div className="relative">
                        <button type="button" onClick={() => setShowEmojiPicker(p => !p)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:opacity-80 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Add emoji">
                            <EmojiIcon className="w-4 h-4" />
                        </button>
                        {showEmojiPicker && (
                            <div className="absolute bottom-full mb-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border dark:border-gray-700 z-20 w-64">
                                <div className="grid grid-cols-7 gap-1">
                                    {DEFAULT_EMOJIS.map(emoji => (
                                        <button key={emoji} type="button" onClick={() => {
                                            setCommentText(prev => prev + emoji);
                                            setShowEmojiPicker(false);
                                            textareaRef.current?.focus();
                                        }} className="text-2xl hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md p-1 transition-colors" title={`Insert ${emoji} emoji`}>
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <button type="submit" className="p-1.5 text-violet-600 dark:text-violet-400 hover:opacity-80 disabled:opacity-50" disabled={!commentText.trim()} title="Send comment">
                        <SendIcon className="w-4 h-4" />
                    </button>
                 </div>
            </div>
        </form>
    );
};