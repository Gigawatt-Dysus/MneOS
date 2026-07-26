import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Code, Quote, Eye, EyeOff, Smile, Sparkles, RefreshCw, Check, X, RotateCcw, Columns, Link, ArrowRight, Pin, Plus, Trash2 } from 'lucide-react';
import { NeuralRewriter } from './NeuralRewriter';
import { rewriteMessage } from '../../services/ai/editorial';
import MarkdownRenderer from '../ai/MarkDownRenderer';
import { GlassButton } from '../GlassButton';
import { EMOJI_CATEGORIES } from '../../types';
// [ZEN FIX] Import specific model ID to force the correct provider
import { PRIMARY_MODEL_ID } from '../../services/ai/config';

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
    mode?: 'inline' | 'modal'; // [ZEN V14]
    initialFictionStatus?: boolean; // [ZEN V15]
    onFictionStatusChange?: (status: boolean) => void;
    userPresets?: any[]; // [ZEN EWO #120] Injected Presets (Firestore)
    userId?: string; // [ZEN V2.1] AI Context
    authorRole?: 'user' | 'model' | 'assistant' | 'system'; // [ZEN FIX] Identity Pass-through
    anteContext?: any[]; // [ZEN FIX] Atmospheric Sync
    subContext?: any[]; // [ZEN FIX] Atmospheric Sync
}

const ToolButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-1 group">
        <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 text-white transition-colors">
            {icon}
        </div>
        <span className="text-[10px] text-white/40 group-hover:text-white/70 transition-colors font-medium">{label}</span>
    </button>
);

const STANDARD_DIRECTIVES = [
    { label: "No Tech", value: "Strip all 1s/0s, digital, and voltage metaphors. Physical only." },
    { label: "Staccato+", value: "Force 1-in-2 staccato. Short, punchy, breathless." },
    { label: "Grit", value: "Add dirt and raw human emotion. Avoid poetic polish." },
    { label: "1985", value: "No internet-era concepts. Use 20th-century vocabulary only." }
];

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
    value, onChange, onSave, onCancel, saveLabel = "Save", autoFocus = false, className = "", hideFooter = false, placeholder = "Type something...", mode = 'inline',
    initialFictionStatus, onFictionStatusChange, userPresets = [], userId = "anonymous", authorRole = 'model',
    anteContext = [], subContext = []
}) => {
    const [isPreview, setIsPreview] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [activeEmojiTab, setActiveEmojiTab] = useState<keyof typeof EMOJI_CATEGORIES>('smileys');

    // [ZEN V15] Memory Profile State
    const [fictionStatus, setFictionStatus] = useState<boolean | undefined>(initialFictionStatus);

    // [ZEN V16] Bifrost Split-View State
    const [showSplitView, setShowSplitView] = useState(mode === 'modal');
    const [syncScroll, setSyncScroll] = useState(true);
    const [originalSnapshot, setOriginalSnapshot] = useState<string>('');
    const leftPaneRef = useRef<HTMLDivElement>(null);

    // [ZEN V23] Custom Directives Persistence (Local + Cloud)
    // [ZEN EWO #120] Merged Logic
    const [customDirectives, setCustomDirectives] = useState<{ label: string, value: string, isCloud?: boolean, id?: string }[]>(() => {
        try {
            // 1. Get Local Storage
            const saved = localStorage.getItem('gigi_custom_directives');
            const local = saved ? JSON.parse(saved) : [];

            // 2. Map Cloud Presets (from Prop)
            // Filter only 'pill' or valid legacy types
            const cloud = userPresets
                .filter(p => p.type === 'pill' || (p.label && !p.archived))
                .map(p => ({
                    label: p.label || 'Unknown',
                    value: p.value || p.description || p.label,
                    isCloud: true,
                    id: p.id
                }));

            // 3. Merge (Deduping by value)
            const all = [...cloud, ...local];
            // Simple de-dupe by value
            const seen = new Set();
            return all.filter(el => {
                const duplicate = seen.has(el.value);
                seen.add(el.value);
                return !duplicate;
            });

        } catch { return []; }
    });

    const [isPinned, setIsPinned] = useState(false);

    // [ZEN FIX] React to Prop Updates (if Firestore loads later)
    useEffect(() => {
        if (userPresets && userPresets.length > 0) {
            setCustomDirectives(prev => {
                const cloud = userPresets
                    .filter(p => p.type === 'pill' || (p.label && !p.archived))
                    .map(p => ({
                        label: p.label || 'Unknown',
                        value: p.value || p.description || p.label,
                        isCloud: true,
                        id: p.id
                    }));



                // Merge with existing local (keeping local edits if any?)
                // Actually, just append new cloud ones that aren't there.
                // Or simplified: Re-run full merge.
                // We want to preserve user-added local ones that are in state but not LS yet?
                // For safety, let's just re-merge current state + new cloud.
                const all = [...cloud, ...prev];
                const seen = new Set();
                const merged = all.filter(el => {
                    const duplicate = seen.has(el.value);
                    seen.add(el.value);
                    return !duplicate;
                });


                return merged;
            });
        }
    }, [userPresets]);

    useEffect(() => {
        // [ZEN FIX] Only save NON-CLOUD items to LocalStorage
        const localOnly = customDirectives.filter(d => !d.isCloud);
        localStorage.setItem('gigi_custom_directives', JSON.stringify(localOnly));
    }, [customDirectives]);

    useEffect(() => {
        // Capture initial state for "Source" pane
        setOriginalSnapshot(value);
    }, []);

    // Sync Scroll Logic
    const handleScroll = (source: 'left' | 'right', e: React.UIEvent) => {
        if (!syncScroll) return;
        const target = source === 'left' ? textAreaRef.current : leftPaneRef.current;
        const srcEl = e.target as HTMLElement;
        if (target && srcEl) {
            const percent = srcEl.scrollTop / (srcEl.scrollHeight - srcEl.clientHeight);
            if (!isNaN(percent)) {
                target.scrollTop = percent * (target.scrollHeight - target.clientHeight);
            }
        }
    };

    // Helper to insert text from Left Pane
    const insertText = (textToInsert: string) => {
        if (!textAreaRef.current) return;
        const start = textAreaRef.current.selectionStart;
        const end = textAreaRef.current.selectionEnd;
        const text = value;
        const newText = text.substring(0, start) + textToInsert + text.substring(end);
        onChange(newText);
        // Regain focus (?)
    };

    // Token Estimation
    const wordCount = value.trim().split(/\s+/).length;
    const tokenEst = Math.ceil(wordCount * 1.3);
    const limit = 2000000; // [ZEN V20] Grok 4.1 2M Context Window
    const usagePercent = Math.min((tokenEst / limit) * 100, 100);

    const [showAiSpark, setShowAiSpark] = useState(false);

    // Positioning Refs
    const sparkButtonRef = useRef<HTMLButtonElement>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);
    const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (showAiSpark && sparkButtonRef.current) {
            const rect = sparkButtonRef.current.getBoundingClientRect();
            const isMobile = window.innerWidth < 768;
            setPopupPos({
                top: rect.bottom + window.scrollY + 10,
                left: isMobile ? (window.innerWidth / 2) - 144 : Math.min(rect.left + window.scrollX, window.innerWidth - 300)
            });
        }
    }, [showAiSpark]);

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

    // [ZEN V14] MODAL RENDER
    if (mode === 'modal') {
        return createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200 font-sans">
                <div className="w-[95%] max-w-[1600px] h-[90vh] bg-[#0f1012] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200">

                    {/* 1. STICKY HEADER */}
                    <div className="bg-[#16171a] border-b border-white/5 p-4 flex items-center justify-between shrink-0 z-10 shadow-lg">
                        <div className="flex gap-6 items-center pl-4">
                            <ToolButton icon={<Bold size={24} />} label="Bold" onClick={() => insertFormatting('**', '**')} />
                            <ToolButton icon={<Italic size={24} />} label="Italic" onClick={() => insertFormatting('*', '*')} />
                            <ToolButton icon={<Code size={24} />} label="Code" onClick={() => insertFormatting('`', '`')} />
                            <ToolButton icon={<Quote size={24} />} label="Quote" onClick={() => insertFormatting('> ', '')} />

                            <div className="w-px h-8 bg-white/10 mx-2" />

                            <div className="flex gap-4">
                                <ToolButton
                                    icon={<Columns size={24} className={showSplitView ? "text-violet-400" : "text-white/40"} />}
                                    label="Bifrost"
                                    onClick={() => setShowSplitView(!showSplitView)}
                                />
                                {showSplitView && (
                                    <ToolButton
                                        icon={<Link size={24} className={syncScroll ? "text-green-400" : "text-white/40"} />}
                                        label="Sync"
                                        onClick={() => setSyncScroll(!syncScroll)}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-white/20 font-bold uppercase tracking-widest text-xs">Signal Editor</span>
                            
                            {onSave && (
                                <button 
                                    onClick={() => onSave(value)} 
                                    className="px-6 py-2.5 bg-[#00FF41]/20 hover:bg-[#00FF41]/40 border border-[#00FF41]/40 text-[#00FF41] rounded-full text-xs font-black uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-[0_0_20px_rgba(0,255,65,0.1)]"
                                >
                                    <Check size={16} strokeWidth={3} /> {saveLabel}
                                </button>
                            )}

                            <button onClick={onCancel} className="p-3 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white" title="Close Without Saving">
                                <X size={32} />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-1 min-h-0 bg-[#0f1012]">
                        {/* 2. WRITING CANVAS */}
                        <div className="flex-1 relative flex w-full">

                            {/* LEFT PANE (Source) */}
                            {showSplitView && (
                                <div
                                    ref={leftPaneRef}
                                    onScroll={(e) => handleScroll('left', e)}
                                    className="flex-1 border-r border-white/5 overflow-y-auto custom-scrollbar bg-black/20 opacity-70"
                                >
                                    <div className="p-8 pb-32 max-w-3xl mx-auto">
                                        <h5 className="text-white/20 font-bold uppercase tracking-widest text-xs mb-6 sticky top-0 bg-[#0f1012]/0 backdrop-blur-none z-10">Original Source</h5>
                                        <div className="space-y-6 text-slate-400 font-serif text-lg leading-relaxed opacity-80">
                                            {originalSnapshot.split(/\n\n+/).map((para, idx) => (
                                                <div key={idx} className="group relative hover:bg-white/5 p-4 rounded-xl transition-colors -ml-4 border border-transparent hover:border-white/5">
                                                    <p>{para}</p>
                                                    <button
                                                        onClick={() => insertText(para)}
                                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all p-2 bg-violet-600 text-white rounded-full hover:scale-110 shadow-lg z-20"
                                                        title="Copy to Right"
                                                    >
                                                        <ArrowRight size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* RIGHT PANE (Spark) */}
                            <div className="flex-1 relative flex flex-col bg-slate-900/10">
                                <textarea
                                    ref={textAreaRef}
                                    onScroll={(e) => handleScroll('right', e)}
                                    value={value}
                                    onChange={(e) => onChange(e.target.value)}
                                    className="w-full h-full bg-transparent text-slate-200 p-12 pb-32 text-xl font-light leading-loose resize-none focus:outline-none custom-scrollbar font-sans tracking-wide selection:bg-violet-500/30"
                                    placeholder={placeholder}
                                    autoFocus={autoFocus}
                                    spellCheck={false}
                                />
                            </div>
                        </div>

                        {/* 3. SIDEBAR (AI CONTROLS) */}
                        <div className="w-80 bg-[#131416] border-l border-white/5 p-0 flex flex-col shrink-0 pb-0">
                            <NeuralRewriter
                                initialText={value}
                                userId={userId}
                                userPresets={userPresets}
                                authorRole={authorRole}
                                anteContext={anteContext}
                                subContext={subContext}
                                onClose={() => {}} // Integrated in sidebar
                                onApply={(newText) => {
                                    onChange(newText);
                                }}
                                title="Neural Spark"
                                mode="sidebar"
                            />
                        </div>
                    </div>

                </div>
            </div>,
            document.body
        );
    }

    return (
        <div className={`flex flex-col gap-0 w-full ${className} rounded-xl overflow-hidden border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.05)] focus-within:border-cyan-400 focus-within:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all duration-300`}>

            {/* TOOLBAR */}
            {!isPreview && (
                <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-md p-2 border-b border-cyan-500/30 shrink-0 relative z-10">
                    <div className="flex items-center gap-1">
                        <button onClick={() => insertFormatting('**', '**')} className="p-1.5 hover:bg-cyan-500/20 rounded text-cyan-500/70 hover:text-cyan-300 hover:shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all" title="Bold"><Bold size={14} /></button>
                        <button onClick={() => insertFormatting('*', '*')} className="p-1.5 hover:bg-cyan-500/20 rounded text-cyan-500/70 hover:text-cyan-300 hover:shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all" title="Italic"><Italic size={14} /></button>
                        <button onClick={() => insertFormatting('`', '`')} className="p-1.5 hover:bg-cyan-500/20 rounded text-cyan-500/70 hover:text-cyan-300 hover:shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all" title="Code"><Code size={14} /></button>
                        <button onClick={() => insertFormatting('> ', '')} className="p-1.5 hover:bg-cyan-500/20 rounded text-cyan-500/70 hover:text-cyan-300 hover:shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all" title="Quote"><Quote size={14} /></button>

                        <div className="w-px h-4 bg-cyan-500/30 mx-1" />

                        {/* EMOJI PICKER */}
                        <div className="relative">
                            <button
                                ref={emojiButtonRef}
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className={`p-1.5 rounded transition-all ${showEmojiPicker ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-cyan-500/70 hover:text-cyan-300 hover:bg-cyan-500/20 hover:shadow-[0_0_10px_rgba(6,182,212,0.5)]'}`}
                            >
                                <Smile size={14} />
                            </button>

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

                        <div className="w-px h-4 bg-cyan-500/30 mx-1" />

                        {/* AI SPARK */}
                        <div className="relative">
                            <button
                                ref={sparkButtonRef}
                                onClick={() => setShowAiSpark(!showAiSpark)}
                                className={`p-1.5 rounded transition-all flex items-center gap-1 ${showAiSpark ? 'bg-violet-500/20 text-violet-300 shadow-[0_0_10px_rgba(139,92,246,0.5)]' : 'text-cyan-500/70 hover:text-violet-400 hover:bg-violet-500/20 hover:shadow-[0_0_10px_rgba(139,92,246,0.5)]'}`}
                                title="AI Assistant"
                            >
                                <Sparkles size={14} />
                            </button>

                            {showAiSpark && (
                                <NeuralRewriter
                                    initialText={value}
                                    userId={userId}
                                    userPresets={userPresets}
                                    authorRole={authorRole}
                                    anteContext={anteContext}
                                    subContext={subContext}
                                    onClose={() => setShowAiSpark(false)}
                                    onApply={(newText) => {
                                        onChange(newText);
                                        setShowAiSpark(false);
                                    }}
                                    title="Neural Spark"
                                />
                            )}
                        </div>
                    </div>

                    <button onClick={() => setIsPreview(!isPreview)} className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 transition-colors">
                        {isPreview ? <><EyeOff size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
                    </button>
                </div>
            )}

            {/* EDITOR SURFACE */}
            <div className="relative flex-1 bg-black/40 backdrop-blur-md overflow-hidden shadow-[inset_0_0_30px_rgba(6,182,212,0.05)] flex flex-col min-h-0 group">
                
                {/* Tactical Grid Background */}
                <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(to_right,#06b6d41a_1px,transparent_1px),linear-gradient(to_bottom,#06b6d41a_1px,transparent_1px)] bg-[size:2rem_2rem] z-0 mix-blend-screen transition-opacity group-focus-within:opacity-40"></div>

                {isPreview ? (
                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-transparent relative z-10">
                        <MarkdownRenderer content={value} onNavigate={() => { }} />
                    </div>
                ) : (
                    <textarea
                        ref={textAreaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full h-full bg-transparent text-cyan-50 p-4 text-lg focus:outline-none resize-none custom-scrollbar font-light leading-relaxed relative z-10 placeholder-cyan-500/40 selection:bg-cyan-500/30`}
                        placeholder={placeholder}
                        disabled={showAiSpark}
                    />
                )}

                {/* [ZEN V35] MOBILE SAVE ANCHOR */}
                {onSave && !isPreview && (
                    <div className="p-4 bg-slate-900/80 backdrop-blur-md border-t border-white/5 shrink-0 animate-in slide-in-from-bottom-2 duration-300">
                        <button 
                            onClick={() => onSave(value)} 
                            className="w-full py-4 bg-[#00FF41]/20 hover:bg-[#00FF41]/40 border border-[#00FF41]/40 text-[#00FF41] rounded-2xl text-sm font-black uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(0,255,65,0.1)] group"
                        >
                            <Check size={20} strokeWidth={3} className="group-hover:animate-bounce" />
                            COMMIT TO ARCHIVE
                        </button>
                    </div>
                )}
            </div>

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