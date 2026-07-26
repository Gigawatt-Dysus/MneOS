import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom'; // [ZEN FIX] Required for Portal
import { Bold, Italic, Code, Quote, Eye, EyeOff, Smile, Sparkles, RefreshCw, Check, X, RotateCcw } from 'lucide-react';
import { rewriteMessage } from '../../services/ai/editorial';
import MarkdownRenderer from '../ai/MarkDownRenderer';
import { GlassButton } from '../GlassButton';
import { EMOJI_CATEGORIES } from '@/types';

interface MarkdownEditorProps {
    value: string;
    onChange: (val: string) => void;
    onSave?: (content: string) => void;
    onCancel?: () => void;
    saveLabel?: string;
    autoFocus?: boolean;
    className?: string;
    hideFooter?: boolean;
    placeholder?: string;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value, onChange, onSave, onCancel, saveLabel = "Save", autoFocus = false, className = "", hideFooter = false, placeholder = "Type something..."
}) => {
    const [isPreview, setIsPreview] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeEmojiTab, setActiveEmojiTab] = useState<keyof typeof EMOJI_CATEGORIES>('smileys');

    // --- AI SPARK STATE ---
    const [showAiSpark, setShowAiSpark] = useState(false);
    const [isRewriting, setIsRewriting] = useState(false);
    const [tone, setTone] = useState(50);
    const [spice, setSpice] = useState(50);
    const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
    const [preAiContent, setPreAiContent] = useState<string | null>(null);

    // [ZEN FIX] Positioning Refs
    const sparkButtonRef = useRef<HTMLButtonElement>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);
    const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Calculate position when opening popups
    useEffect(() => {
        if (showAiSpark && sparkButtonRef.current) {
            const rect = sparkButtonRef.current.getBoundingClientRect();
            const isMobile = window.innerWidth < 768;

            setPopupPos({
                top: rect.bottom + window.scrollY + 10,
                // On mobile, center it. On desktop, align with button but prevent overflow.
                left: isMobile ? (window.innerWidth / 2) - 144 : Math.min(rect.left + window.scrollX, window.innerWidth - 300)
            });
        }
    }, [showAiSpark]);

    // Handle closing on scroll/resize to keep UI clean
    useEffect(() => {
        const handleScroll = () => { if (showAiSpark) setShowAiSpark(false); if (showEmojiPicker) setShowEmojiPicker(false); };
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [showAiSpark, showEmojiPicker]);

    const insertFormatting = (prefix: string, suffix: string) => {
        if (!textAreaRef.current) return;
        const start = textAreaRef.current.selectionStart;
        const end = textAreaRef.current.selectionEnd;
        const text = value;
        const newText = text.substring(0, start) + prefix + text.substring(start, end) + suffix + text.substring(end);
        onChange(newText);
        setTimeout(() => {
            if (textAreaRef.current) {
                textAreaRef.current.focus();
                const newCursor = start + prefix.length + (end - start);
                textAreaRef.current.setSelectionRange(newCursor, newCursor);
            }
        }, 0);
    };

    const handleAiRewrite = async () => {
        if (!value.trim()) return;
        if (!preAiContent) setPreAiContent(value);
        setIsRewriting(true);
        try {
            const rewritten = await rewriteMessage({ tone, spice, length, text: value });
            onChange(rewritten);
        } catch (e) {
            console.error(e);
        } finally {
            setIsRewriting(false);
        }
    };

    const handleRevert = () => {
        if (preAiContent !== null) {
            onChange(preAiContent);
            setPreAiContent(null);
        }
    };

    const handleKeep = () => {
        setPreAiContent(null);
        setShowAiSpark(false);
    };

    const TABS = [
        { key: 'smileys' as const, icon: '😀' },
        { key: 'gestures' as const, icon: '👋' },
        { key: 'hearts' as const, icon: '❤️' },
        { key: 'nature' as const, icon: '🐶' },
        { key: 'food' as const, icon: '🍕' },
        { key: 'activities' as const, icon: '⚽' },
        { key: 'objects' as const, icon: '💡' },
        { key: 'symbols' as const, icon: '✨' }
    ];

    return (
        <div className={`flex flex-col gap-0 ${className}`}>

            {/* TOOLBAR */}
            {!isPreview && (
                <div className="flex items-center justify-between bg-black/20 rounded-t-xl p-2 border border-white/5 border-b-0 shrink-0">
                    <div className="flex items-center gap-1">
                        <button onClick={() => insertFormatting('**', '**')} className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title="Bold"><Bold size={14} /></button>
                        <button onClick={() => insertFormatting('*', '*')} className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title="Italic"><Italic size={14} /></button>
                        <button onClick={() => insertFormatting('`', '`')} className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title="Code"><Code size={14} /></button>
                        <button onClick={() => insertFormatting('> ', '')} className="p-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors" title="Quote"><Quote size={14} /></button>

                        <div className="w-px h-4 bg-white/10 mx-1" />

                        {/* EMOJI PICKER */}
                        <div className="relative">
                            <button
                                ref={emojiButtonRef}
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className={`p-1.5 rounded transition-colors ${showEmojiPicker ? 'bg-white/10 text-yellow-400' : 'text-slate-400 hover:text-yellow-400'}`}
                            >
                                <Smile size={14} />
                            </button>

                            {/* [ZEN FIX] Portal Emoji Picker too */}
                            {showEmojiPicker && createPortal(
                                <div
                                    className="fixed bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-2 z-[10000] animate-in zoom-in-95"
                                    style={{
                                        top: (emojiButtonRef.current?.getBoundingClientRect().bottom || 0) + 10,
                                        left: Math.min((emojiButtonRef.current?.getBoundingClientRect().left || 0), window.innerWidth - 270),
                                        width: '260px'
                                    }}
                                >
                                    <div className="flex gap-1 overflow-x-auto pb-2 mb-2 border-b border-white/10 scrollbar-hide">
                                        {TABS.map(tab => (
                                            <button key={tab.key} onClick={() => setActiveEmojiTab(tab.key)} className={`flex-shrink-0 px-1.5 py-1 rounded text-sm transition-colors ${activeEmojiTab === tab.key ? 'bg-violet-600/30 border border-violet-500/50' : 'hover:bg-white/5'}`}>
                                                {tab.icon}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto custom-scrollbar">
                                        {EMOJI_CATEGORIES[activeEmojiTab].map((emoji, idx) => (
                                            <button key={`${activeEmojiTab}-${idx}`} onClick={() => { insertFormatting(emoji, ''); setShowEmojiPicker(false); }} className="hover:bg-white/10 rounded p-1 text-lg">
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="fixed inset-0 -z-10" onClick={() => setShowEmojiPicker(false)} />
                                </div>,
                                document.body
                            )}
                        </div>

                        <div className="w-px h-4 bg-white/10 mx-1" />

                        {/* AI SPARK */}
                        <div className="relative">
                            <button
                                ref={sparkButtonRef}
                                onClick={() => setShowAiSpark(!showAiSpark)}
                                className={`p-1.5 rounded transition-colors flex items-center gap-1 ${showAiSpark ? 'bg-violet-500/20 text-violet-300' : 'text-slate-400 hover:text-violet-400'}`}
                                title="AI Assistant"
                            >
                                <Sparkles size={14} />
                                {preAiContent && <span className="text-[10px] font-bold text-violet-400 animate-pulse">Draft</span>}
                            </button>

                            {/* [ZEN FIX] Portal the Spark Modal to Body */}
                            {showAiSpark && createPortal(
                                <>
                                    {/* Backdrop for click-away */}
                                    <div className="fixed inset-0 z-[9999]" onClick={() => setShowAiSpark(false)} />

                                    <div
                                        className="fixed w-72 bg-slate-900 border border-violet-500/30 rounded-xl shadow-2xl p-4 z-[10000] animate-in slide-in-from-top-2"
                                        style={{ top: popupPos.top, left: popupPos.left }}
                                    >
                                        <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                                            <Sparkles size={12} className="text-violet-400" /> Neural Rewriter
                                        </h4>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Casual</span><span>Formal</span></div>
                                                <input type="range" min="0" max="100" value={tone} onChange={e => setTone(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[10px] text-slate-400 mb-1"><span>Tame</span><span>Spicy</span></div>
                                                <input type="range" min="0" max="100" value={spice} onChange={e => setSpice(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500" />
                                            </div>
                                            <div className="flex bg-black/40 rounded p-1">
                                                {['short', 'medium', 'long'].map((l) => (
                                                    <button key={l} onClick={() => setLength(l as any)} className={`flex-1 text-[10px] py-1 rounded capitalize transition-colors ${length === l ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{l}</button>
                                                ))}
                                            </div>
                                            <div className="flex gap-2 pt-2 border-t border-white/5">
                                                {!preAiContent ? (
                                                    <GlassButton onClick={handleAiRewrite} disabled={isRewriting} variant="primary" className="w-full justify-center text-xs">
                                                        {isRewriting ? <RefreshCw size={12} className="animate-spin" /> : 'Rewrite'}
                                                    </GlassButton>
                                                ) : (
                                                    <div className="flex gap-1 w-full">
                                                        <button onClick={handleRevert} className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 py-1.5 rounded text-xs flex items-center justify-center gap-1"><RotateCcw size={12} /> Revert</button>
                                                        <button onClick={handleAiRewrite} className="flex-1 bg-black/40 hover:bg-black/60 text-white py-1.5 rounded text-xs flex items-center justify-center gap-1"><RefreshCw size={12} /> Retry</button>
                                                        <button onClick={handleKeep} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-200 py-1.5 rounded text-xs flex items-center justify-center gap-1"><Check size={12} /> Keep</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>
                    </div>

                    <button onClick={() => setIsPreview(!isPreview)} className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-colors">
                        {isPreview ? <><EyeOff size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
                    </button>
                </div>
            )}

            {/* EDITOR SURFACE */}
            <div className="relative flex-1 bg-slate-800 border border-white/10 rounded-b-xl rounded-tr-xl overflow-hidden shadow-inner flex flex-col min-h-0">
                {isPreview ? (
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-slate-900/50">
                        <MarkdownRenderer content={value} onNavigate={() => { }} />
                    </div>
                ) : (
                    <textarea
                        ref={textAreaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full h-full bg-transparent text-slate-200 p-4 text-lg focus:outline-none resize-none custom-scrollbar font-light leading-relaxed ${isRewriting ? 'opacity-50 animate-pulse' : ''}`}
                        placeholder={placeholder}
                        autoFocus={autoFocus}
                        disabled={isRewriting}
                    />
                )}
            </div>

            {/* OPTIONAL FOOTER ACTIONS */}
            {!hideFooter && onSave && (
                <div className="flex justify-end gap-2 mt-2">
                    {onCancel && <button onClick={onCancel} className="p-1.5 hover:bg-white/10 rounded-full text-white/70 hover:text-red-400 transition-colors" title="Cancel"><X size={18} /></button>}
                    <button onClick={() => onSave(value)} className="p-1.5 bg-green-500/20 hover:bg-green-500/40 text-green-200 hover:text-white rounded-full transition-colors flex items-center gap-2 px-3" title="Save">
                        <Check size={18} />
                        <span className="text-xs font-bold">{saveLabel}</span>
                    </button>
                </div>
            )}
        </div>
    );
};