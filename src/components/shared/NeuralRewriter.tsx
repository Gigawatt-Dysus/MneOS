import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Check, Save, RefreshCw, Zap, Pin, Plus, Trash2, RotateCcw, Sliders, ChevronRight } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import { rewriteMessage } from '../../services/ai/editorial';
import { PRIMARY_MODEL_ID } from '../../services/ai/config';
import { appDataService } from '../../services/serviceManager';

interface NeuralRewriterProps {
    initialText: string;
    onApply: (newText: string) => void;
    onClose: () => void;
    userId: string;
    userPresets?: any[];
    mode?: string;
    addToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    authorRole?: 'user' | 'model' | 'assistant' | 'system';
    chatHistory?: any[];
    anteContext?: any[];
    subContext?: any[];
    isChameleonEnabled?: boolean; // [ZEN V36]
    title?: string;
    showPreview?: boolean;
}

const STANDARD_DIRECTIVES = [
    { label: "No Tech", value: "Strip all 1s/0s, digital, and voltage metaphors. Physical only." },
    { label: "Staccato+", value: "Force 1-in-2 staccato. Short, punchy, breathless." },
    { label: "Grit", value: "Add dirt and raw human emotion. Avoid poetic polish." },
    { label: "1985", value: "No internet-era concepts. Use 20th-century vocabulary only." }
];

export const NeuralRewriter: React.FC<NeuralRewriterProps> = ({
    initialText, onApply, onClose, userId, userPresets = [], title = "Neural Rewriter", showPreview = true, addToast, authorRole = 'model', chatHistory = [],
    anteContext = [], subContext = []
}) => {
    const [isRewriting, setIsRewriting] = useState(false);
    const [currentText, setCurrentText] = useState(initialText);
    const [preAiContent, setPreAiContent] = useState<string | null>(null);
    
    // Sliders
    const [tone, setTone] = useState(50);
    const [spice, setSpice] = useState(50);
    const [stinger, setStinger] = useState(0);
    const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
    
    // Executive Directive
    const [executiveDirective, setExecutiveDirective] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    
    // [ZEN V36] Chameleon Circuit State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isChameleonActive, setIsChameleonActive] = useState(true);
    const [showManualOverride, setShowManualOverride] = useState(false);
    
    // Custom Presets
    const [customDirectives, setCustomDirectives] = useState<{ label: string, value: string, isCloud?: boolean, id?: string }[]>([]);

    const lastAnalyzedText = useRef<string | null>(null);
    const hasInitialSync = useRef(false);

    useEffect(() => {
        // [ZEN V36] Chameleon Circuit Execution with Stability Delay
        let isMounted = true;
        const runChameleonScan = async () => {
            if (!isChameleonActive || !initialText.trim()) return;
            if (lastAnalyzedText.current === initialText && hasInitialSync.current) return;
            
            // [ZEN FIX] Quiet Period: Wait for UI hydration/shutter to settle
            await new Promise(resolve => setTimeout(resolve, 1500));
            if (!isMounted) return;

            lastAnalyzedText.current = initialText;
            hasInitialSync.current = true;
            setIsAnalyzing(true);
            try {
                const { analyzeStyle } = await import('../../services/ai/editorial');
                const analysis = await analyzeStyle(initialText, anteContext, subContext);
                if (!isMounted) return;

                setTone(analysis.tone);
                setSpice(analysis.spice);
                setStinger(analysis.stinger);
                setLength(analysis.length);
                
                if (typeof addToast === 'function') {
                    addToast("Chameleon Circuit synchronized with context.", "info");
                } else {
                    console.log("[Chameleon] Calibration synchronized.");
                }
            } catch (e) {
                console.error("[Chameleon] Calibration failed:", e);
            } finally {
                if (isMounted) setIsAnalyzing(false);
            }
        };

        runChameleonScan();
        return () => { isMounted = false; };
    }, [initialText, isChameleonActive]);

    useEffect(() => {
        // Merge cloud and local presets
        const local = JSON.parse(localStorage.getItem('gigi_custom_directives') || '[]');
        const cloud = userPresets
            .filter(p => p.type === 'pill' || (p.label && !p.archived))
            .map(p => ({
                label: p.label || 'Unknown',
                value: p.value || p.description || p.label,
                isCloud: true,
                id: p.id
            }));

        const all = [...cloud, ...local];
        const seen = new Set();
        setCustomDirectives(all.filter(el => {
            const duplicate = seen.has(el.value);
            seen.add(el.value);
            return !duplicate;
        }));
    }, [userPresets]);

    const handleAiRewrite = async () => {
        if (!currentText.trim()) return;
        if (!preAiContent) setPreAiContent(currentText);
        setIsRewriting(true);
        try {
            const rewritten = await rewriteMessage({
                tone,
                spice,
                length,
                stinger,
                text: currentText,
                authorRole,
                executiveDirective: executiveDirective.trim() || undefined,
                chatHistory,
                anteContext,
                subContext
            }, PRIMARY_MODEL_ID);
            setCurrentText(rewritten);
        } catch (e: any) {
            console.error("[NeuralBridge] Rewrite failed", e);
            if (typeof addToast === 'function') {
                addToast(`Neural Link Severed: ${e.message}`, "error");
            }
        } finally {
            setIsRewriting(false);
        }
    };

    const handleSaveCustom = () => {
        if (!executiveDirective.trim()) return;
        const words = executiveDirective.split(' ');
        const label = words.length > 1 ? `${words[0]} ${words[1]}...` : words[0].substring(0, 10);
        if (customDirectives.some(d => d.value === executiveDirective.trim())) return;
        
        const newDirective = { label, value: executiveDirective.trim() };
        setCustomDirectives(prev => [...prev, newDirective]);
        
        const local = JSON.parse(localStorage.getItem('gigi_custom_directives') || '[]');
        localStorage.setItem('gigi_custom_directives', JSON.stringify([...local, newDirective]));

        if (typeof addToast === 'function') {
            addToast("Directive preserved in local lab.", "success");
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6 bg-[#1a1c24] border border-white/10 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 w-full max-w-lg">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-600/20 rounded-lg border border-violet-500/30">
                        <Sparkles className="text-violet-400" size={18} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">Neural Spark</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${authorRole === 'user' ? 'bg-cyan-400' : 'bg-fuchsia-400'} animate-pulse`} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                Calibration Mode: <span className={authorRole === 'user' ? 'text-cyan-400' : 'text-fuchsia-400'}>{authorRole === 'user' ? 'Operator (Eric)' : 'Companion (Brita)'}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Chameleon Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-500 ${isChameleonActive ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                <RotateCcw size={12} className={isAnalyzing ? "animate-spin" : (isChameleonActive ? "animate-pulse" : "")} />
                <span className="text-[9px] font-black uppercase tracking-widest flex-1">
                    {isAnalyzing ? "Analyzing Temporal Context..." : isChameleonActive ? "Chameleon Circuit Active: Auto-Calibrating" : "Manual Override Active"}
                </span>
                {isChameleonActive && (
                    <div className="flex gap-1">
                        <div className="w-1 h-3 bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1 h-3 bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1 h-3 bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                )}
            </div>

            {/* Main Text Area (The "Signal") */}
            <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Signal</label>
                <textarea
                    value={currentText}
                    onChange={(e) => setCurrentText(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-sm focus:border-violet-500/50 outline-none h-32 resize-none custom-scrollbar leading-relaxed"
                />
            </div>

            {/* Manual Override Accordion */}
            <div className="border border-white/5 rounded-2xl overflow-hidden bg-black/20">
                <button 
                    onClick={() => setShowManualOverride(!showManualOverride)}
                    className="w-full p-4 flex justify-between items-center bg-white/[0.02] hover:bg-white/[0.05] transition-all"
                >
                    <div className="flex items-center gap-2">
                        <Sliders size={14} className={showManualOverride ? "text-violet-400" : "text-slate-500"} />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Manual Override</span>
                    </div>
                    <ChevronRight size={14} className={`text-slate-600 transition-transform ${showManualOverride ? 'rotate-90' : ''}`} />
                </button>

                {showManualOverride && (
                    <div className="p-6 space-y-8 animate-in slide-in-from-top-2 duration-200">
                        {/* Executive Directive */}
                        <div className="space-y-3">
                            <div className="relative group">
                                <textarea
                                    value={executiveDirective}
                                    onChange={(e) => { setExecutiveDirective(e.target.value); setIsChameleonActive(false); }}
                                    placeholder="Executive Directive (Override)..."
                                    className={`w-full bg-violet-500/5 hover:bg-violet-500/10 border ${isPinned ? 'border-[#BC13FE] shadow-[0_0_10px_rgba(188,19,254,0.15)]' : 'border-violet-500/20'} rounded-xl p-3 pr-10 text-[11px] text-violet-100 focus:border-violet-500 outline-none h-20 resize-none placeholder:text-violet-500/30 transition-all custom-scrollbar`}
                                />
                                <div className="absolute top-3 right-3 flex flex-col gap-2">
                                    <button onClick={() => setIsPinned(!isPinned)} className={`${isPinned ? 'text-[#BC13FE]' : 'text-slate-600 hover:text-white'} transition-colors`} title="Pin Directive">
                                        <Pin size={14} />
                                    </button>
                                    {executiveDirective && (
                                        <button onClick={handleSaveCustom} className="text-green-500/50 hover:text-green-400 transition-colors" title="Save Preset">
                                            <Plus size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Directive Library Chips */}
                            <div className="flex flex-wrap gap-2">
                                {STANDARD_DIRECTIVES.map(chip => (
                                    <button key={chip.label} onClick={() => { setExecutiveDirective(chip.value); setIsChameleonActive(false); }} className="px-3 py-1 bg-slate-800 border border-white/5 rounded text-[9px] font-bold text-slate-400 hover:text-white hover:border-[#00FF41] transition-all uppercase tracking-wider">{chip.label}</button>
                                ))}
                                {customDirectives.map((chip, idx) => (
                                    <button key={idx} onClick={() => { setExecutiveDirective(chip.value); setIsChameleonActive(false); }} className={`px-3 py-1 border rounded text-[9px] font-bold transition-all uppercase tracking-wider ${chip.isCloud ? 'bg-fuchsia-900/20 border-fuchsia-500/30 text-fuchsia-300' : 'bg-indigo-900/20 border-indigo-500/30 text-indigo-300'}`}>{chip.label}</button>
                                ))}
                            </div>
                        </div>

                        {/* Sliders */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest"><span className="text-slate-500">Casual</span><span className="text-violet-400">{tone}%</span><span className="text-white">Formal</span></div>
                                <input type="range" value={tone} onChange={(e) => { setTone(parseInt(e.target.value)); setIsChameleonActive(false); }} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500" />
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest"><span className="text-slate-500">Tame</span><span className="text-rose-400">{spice}%</span><span className="text-white">Spicy</span></div>
                                <input type="range" value={spice} onChange={(e) => { setSpice(parseInt(e.target.value)); setIsChameleonActive(false); }} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500" />
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest"><span className="text-slate-500">Flowing</span><span className="text-orange-400">{stinger}%</span><span className="text-white">Staccato</span></div>
                                <input type="range" value={stinger} onChange={(e) => { setStinger(parseInt(e.target.value)); setIsChameleonActive(false); }} className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                            </div>
                            <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                                {(['short', 'medium', 'long'] as const).map(l => (
                                    <button key={l} onClick={() => { setLength(l); setIsChameleonActive(false); }} className={`flex-1 py-1.5 text-[9px] uppercase font-bold rounded-lg transition-all ${length === l ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{l}</button>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={() => setIsChameleonActive(true)}
                            className="w-full py-2 bg-cyan-500/5 hover:bg-cyan-500/10 text-cyan-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-cyan-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={12} /> Reactivate Chameleon Circuit
                        </button>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                <GlassButton
                    onClick={handleAiRewrite}
                    disabled={isRewriting || !currentText.trim()}
                    variant="primary"
                    className="w-full justify-center py-4 text-sm font-bold tracking-[0.2em] uppercase"
                >
                    {isRewriting ? <RefreshCw size={18} className="animate-spin" /> : <><Zap size={18} /> Rewrite Signal</>}
                </GlassButton>
                
                <div className="flex gap-2">
                    {preAiContent && (
                        <button onClick={() => { setCurrentText(preAiContent); setPreAiContent(null); }} className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase rounded-xl border border-red-500/20 transition-all flex items-center justify-center gap-2">
                            <RotateCcw size={14} /> Revert
                        </button>
                    )}
                    <button onClick={() => onApply(currentText)} className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                        <Check size={18} strokeWidth={3} /> Commit Change
                    </button>
                </div>
            </div>
        </div>
    );
};
