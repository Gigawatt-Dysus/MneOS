import React, { useRef, useState, useEffect } from 'react';
import { Image, RefreshCcw, Send, SmilePlus } from 'lucide-react';
import { QUICK_REACTIONS, EMOJI_CATEGORIES, SPICY_EMOJIS } from '@/types';
import type { User } from '@/types';

interface ChatInputProps {
    userInput: string;
    setUserInput: (val: string) => void;
    onSend: () => void;
    isFrozen: boolean;
    isThinking: boolean;
    onRefreshSession: () => void;
    stagedFile: { file: File; previewUrl: string; type: 'image' | 'video' } | null;
    setStagedFile: (file: { file: File; previewUrl: string; type: 'image' | 'video' } | null) => void;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    user?: User;
}

const ChatInput: React.FC<ChatInputProps> = ({
    userInput, setUserInput, onSend, isFrozen, isThinking,
    onRefreshSession, stagedFile, setStagedFile, onFileUpload, fileInputRef,
    user
}) => {
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeEmojiTab, setActiveEmojiTab] = useState<keyof typeof EMOJI_CATEGORIES>('smileys');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isInputActive, setIsInputActive] = useState(false);
    const inputAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (inputAreaRef.current && !inputAreaRef.current.contains(event.target as Node)) {
                setIsInputActive(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [inputAreaRef]);

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                if (blob) {
                    const previewUrl = URL.createObjectURL(blob);
                    setStagedFile({ file: blob, previewUrl, type: 'image' });
                }
            }
        }
    };

    // [ZEN FIX] Prevent double submission events
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation(); // Stop event bubbling
            onSend();
        }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setUserInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
    };

    const handleEmojiClick = (emoji: string) => {
        setUserInput(userInput + emoji);
        setShowEmojiPicker(false);
    };

    const buttonBaseClass = "p-2 rounded-full text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 transition-colors flex items-center justify-center";
    const isSendDisabled = isFrozen || isThinking || (!userInput.trim() && !stagedFile);

    const showSpicyEmojis = user?.aiCompanions?.some(c => c.isPrimary && (c.spiceLevel ?? 0) >= 7);

    const tabs = [
        { key: 'smileys' as const, icon: '😀', label: 'Smileys' },
        { key: 'gestures' as const, icon: '👋', label: 'Gestures' },
        { key: 'hearts' as const, icon: '❤️', label: 'Hearts' },
        { key: 'nature' as const, icon: '🐶', label: 'Nature' },
        { key: 'food' as const, icon: '☕', label: 'Food' },
        { key: 'activities' as const, icon: '⚽', label: 'Activities' },
        { key: 'objects' as const, icon: '💻', label: 'Objects' },
        { key: 'symbols' as const, icon: '✨', label: 'Symbols' }
    ];

    return (
        <div className={`w-full mx-auto relative z-20 p-2 pb-24 md:p-4 md:pb-8 transition-all duration-300 ease-in-out ${isInputActive ? 'md:max-w-5xl' : 'max-w-4xl'}`}>

            {/* STAGING AREA (Image Preview) */}
            {stagedFile && (
                <div className="flex items-center gap-3 mb-3 p-2 bg-slate-800/90 rounded-xl animate-in slide-in-from-bottom-2 mx-2 md:mx-4 border border-white/10 shadow-lg backdrop-blur-sm overflow-hidden">
                    <div className="flex-shrink-0 relative group">
                        {stagedFile.type === 'video' ? (
                            <video src={stagedFile.previewUrl} className="h-16 w-16 object-cover rounded-lg border border-white/20 bg-black" />
                        ) : (
                            <img src={stagedFile.previewUrl} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-white/20 bg-black" />
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors rounded-lg pointer-events-none" />
                    </div>

                    <div className="flex-grow min-w-0 flex flex-col justify-center">
                        <p className="text-sm font-bold truncate text-gray-200">{stagedFile.file.name}</p>
                        <p className="text-[10px] text-cyan-400 font-mono tracking-wider uppercase">
                            {stagedFile.type === 'video' ? 'Video File' : 'Image Ready'}
                        </p>
                    </div>

                    <button
                        onClick={() => setStagedFile(null)}
                        className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex-shrink-0"
                        title="Remove file"
                    >
                        ✕
                    </button>
                </div>
            )}

            <div ref={inputAreaRef} className="relative flex items-end bg-gray-800 rounded-2xl px-3 sm:px-4 py-2 transition-all duration-300 border border-gray-700 focus-within:border-cyan-500 shadow-lg shadow-black/30">

                <div className={`transition-all duration-300 flex items-center gap-1 overflow-hidden w-auto opacity-100`}>
                    <button
                        onClick={onRefreshSession}
                        className={buttonBaseClass}
                        title="Reload Context"
                    >
                        <RefreshCcw size={18} strokeWidth={2.5} />
                    </button>

                    <input type="file" ref={fileInputRef} onChange={onFileUpload} accept="image/*,video/*" className="hidden" />

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className={buttonBaseClass}
                        title="Attach Media"
                    >
                        <Image size={18} strokeWidth={2.5} />
                    </button>
                </div>

                <textarea
                    ref={textareaRef}
                    value={userInput}
                    onFocus={() => setIsInputActive(true)}
                    onChange={handleInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    placeholder={isFrozen ? "SYSTEM OFFLINE" : `Message...`}
                    className="flex-grow bg-transparent border-none focus:ring-0 focus:outline-none text-gray-100 placeholder-gray-500/80 resize-none py-2 pr-14 max-h-32 min-h-[24px] custom-scrollbar text-[15px] leading-relaxed font-medium"
                    rows={1}
                    disabled={isFrozen || isThinking}
                />

                <div className="absolute right-3 bottom-2 flex flex-col items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowEmojiPicker(p => !p)}
                            className={buttonBaseClass}
                        >
                            <SmilePlus size={20} strokeWidth={2.5} />
                        </button>

                        {showEmojiPicker && (
                            <div
                                data-swipe-ignore
                                className="absolute bottom-12 right-0 bg-slate-900 shadow-2xl rounded-xl p-3 w-72 max-w-[calc(100vw-2rem)] z-50 border border-white/10 animate-in zoom-in-95"
                            >
                                <div className="flex justify-between gap-1 pb-2 mb-2 border-b border-white/10">
                                    {QUICK_REACTIONS.map((emoji, idx) => (
                                        <button
                                            key={`quick-${idx}`}
                                            onClick={() => handleEmojiClick(emoji)}
                                            className="hover:bg-white/10 rounded p-1.5 text-xl transition-colors flex-1"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex gap-1 overflow-x-auto pb-2 mb-2 border-b border-white/10 scrollbar-hide">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setActiveEmojiTab(tab.key)}
                                            className={`flex-shrink-0 px-2 py-1 rounded text-lg transition-colors ${activeEmojiTab === tab.key
                                                    ? 'bg-violet-600/30 border border-violet-500/50'
                                                    : 'hover:bg-white/5'
                                                }`}
                                            title={tab.label}
                                        >
                                            {tab.icon}
                                        </button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-8 gap-1 max-h-60 overflow-y-auto custom-scrollbar">
                                    {EMOJI_CATEGORIES[activeEmojiTab].map((emoji, idx) => (
                                        <button
                                            key={`${activeEmojiTab}-${idx}`}
                                            onClick={() => handleEmojiClick(emoji)}
                                            className="hover:bg-white/10 rounded p-1.5 text-xl transition-colors"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>

                                {showSpicyEmojis && (
                                    <>
                                        <div className="border-t border-red-500/30 mt-2 pt-2">
                                            <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                                🌶️ Spicy
                                            </div>
                                            <div className="grid grid-cols-10 gap-1">
                                                {SPICY_EMOJIS.map((emoji, idx) => (
                                                    <button
                                                        key={`spicy-${idx}`}
                                                        onClick={() => handleEmojiClick(emoji)}
                                                        className="hover:bg-red-500/10 rounded p-1 text-lg transition-colors"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    {/* [ZEN FIX] Explicit preventDefault on click to stop form submission */}
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            onSend();
                        }}
                        disabled={isSendDisabled}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isSendDisabled
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-violet-600 text-white hover:bg-violet-500 hover:scale-105 active:scale-95 shadow-lg shadow-violet-900/30'
                            }`}
                    >
                        <Send size={20} strokeWidth={2.5} className={isSendDisabled ? "" : "ml-0.5"} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatInput;