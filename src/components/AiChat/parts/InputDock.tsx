import React from 'react';
import { Sliders, Sparkles, ImageIcon, Smile, Zap, Send, RefreshCw, Slash, Check, X } from 'lucide-react';
import { NeuralTag } from '../types';
import { AVAILABLE_MODELS } from '../../../services/ai/config';

interface InputDockProps {
    userInput: string;
    setUserInput: (v: string) => void;
    textAreaRef: React.RefObject<HTMLTextAreaElement>;
    stagedFile: any;
    setStagedFile: (f: any) => void;
    isEnhancingInput: boolean;
    isThinking: boolean;
    chatMode: 'ai' | 'peer';
    inputProcessMode: 'enhance' | 'polish' | 'raw';
    setInputProcessMode: (m: 'enhance' | 'polish' | 'raw') => void;
    showDirectiveTray: boolean;
    setShowDirectiveTray: (s: boolean) => void;
    showEmojiPicker: boolean;
    setShowEmojiPicker: (s: boolean) => void;
    showFidelityPopover: boolean;
    setShowFidelityPopover: (s: boolean) => void;
    tagSuggestions: NeuralTag[];
    suggestionIndex: number;
    setSuggestionIndex: (i: number) => void;
    applyTag: (t: string) => void;
    handleExecutiveSubmit: () => void;
    handlePeerMessageSubmit: (v: string) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
}

export const InputDock: React.FC<InputDockProps> = (props) => {
    return (
        <div className="shrink-0 p-4 pb-2 md:pb-4 relative z-50 flex flex-col items-center">
            <div className="w-full max-w-3xl command-dock flex flex-col gap-2 p-2 shadow-2xl">
                <div className="relative flex items-center gap-2">
                    {props.stagedFile && (
                        <div className="absolute bottom-full left-0 mb-4 z-50 animate-in slide-in-from-bottom-2 duration-300">
                            <div className="relative group/thumb shadow-2xl">
                                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] bg-black/40 backdrop-blur-md">
                                    {props.stagedFile.type === 'image' ? (
                                        <img src={props.stagedFile.previewUrl} className="w-full h-full object-cover" alt="Preview" />
                                    ) : props.stagedFile.type === 'document' ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-cyan-400 font-mono text-xs shadow-inner">
                                            <span className="font-bold text-sm">DOC</span>
                                            <span className="text-[8px] truncate px-1 text-slate-500 mt-1">{props.stagedFile.file?.name}</span>
                                        </div>
                                    ) : (
                                        <video src={props.stagedFile.previewUrl} className="w-full h-full object-cover" />
                                    )}
                                    <button onClick={() => props.setStagedFile(null)} className="absolute -top-1 -right-1 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-500 transition-colors text-[10px]">X</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={() => props.setShowDirectiveTray(!props.showDirectiveTray)} 
                        className={`p-3 rounded-xl transition-all ${props.showDirectiveTray ? 'text-fuchsia-400 bg-fuchsia-500/10' : 'text-slate-500 hover:text-fuchsia-400 hover:bg-fuchsia-500/5'}`}
                        title="Toggle Directives HUD"
                    >
                        <Sliders size={20} />
                    </button>

                    <textarea
                        ref={props.textAreaRef}
                        value={props.userInput}
                        onChange={(e) => props.setUserInput(e.target.value)}
                        disabled={props.isEnhancingInput}
                        placeholder={props.isEnhancingInput ? "Rewriting Signal (Limbic Mode)..." : "Neural Uplink Active..."}
                        rows={1}
                        className={`flex-1 bg-transparent py-3 px-1 focus:outline-none custom-scrollbar resize-none font-sans text-base transition-all ${props.isEnhancingInput ? 'text-violet-400 placeholder-violet-500/60 animate-pulse' : 'text-slate-100 placeholder-slate-600'}`}
                        onKeyDown={(e) => {
                            if (props.tagSuggestions.length > 0) {
                                if (e.key === 'ArrowDown') { e.preventDefault(); props.setSuggestionIndex((props.suggestionIndex + 1) % props.tagSuggestions.length); }
                                if (e.key === 'ArrowUp') { e.preventDefault(); props.setSuggestionIndex((props.suggestionIndex - 1 + props.tagSuggestions.length) % props.tagSuggestions.length); }
                                if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); props.applyTag(props.tagSuggestions[props.suggestionIndex].name); }
                            } else if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (props.chatMode === 'ai') props.handleExecutiveSubmit();
                                else props.handlePeerMessageSubmit(props.userInput);
                            }
                        }}
                    />

                    {props.tagSuggestions.length > 0 && (
                        <div className="absolute bottom-full left-14 mb-4 z-[100] w-64 bg-[#0a0a0b]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                            {props.tagSuggestions.map((tag, idx) => (
                                <div key={tag.name} onClick={() => props.applyTag(tag.name)} className={`px-3 py-2 cursor-pointer ${idx === props.suggestionIndex ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:bg-white/5'}`}>
                                    <div className="flex items-center justify-between"><span className="text-xs font-bold">{tag.name}</span><span className="text-[7px] font-black uppercase opacity-40">{tag.category}</span></div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-1 relative">
                        <button onClick={() => props.fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-violet-400"><ImageIcon size={20} /></button>
                        <button onClick={() => props.setShowEmojiPicker(!props.showEmojiPicker)} className={`p-2 rounded-xl ${props.showEmojiPicker ? 'text-yellow-400' : 'text-slate-500 hover:text-yellow-400'}`}><Smile size={20} /></button>
                        
                        <div className="relative">
                            <button 
                                onClick={() => props.setShowFidelityPopover(!props.showFidelityPopover)} 
                                className={`p-2 rounded-xl transition-all ${props.inputProcessMode === 'enhance' ? 'text-violet-400 bg-violet-500/5' : props.inputProcessMode === 'polish' ? 'text-emerald-400 bg-emerald-500/5' : 'text-slate-500 hover:text-white'}`}
                                title="Change Input Fidelity Mode"
                            >
                                {props.inputProcessMode === 'enhance' ? <Sparkles size={20} /> : props.inputProcessMode === 'polish' ? <Zap size={20} /> : <Slash size={20} />}
                            </button>

                            {props.showFidelityPopover && (
                                <div className="absolute bottom-full right-0 mb-2 z-[100] w-48 bg-[#0a0a0b]/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl p-1.5 animate-in slide-in-from-bottom-2 duration-200 flex flex-col gap-0.5">
                                    <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Input Fidelity</div>
                                    <button 
                                        onClick={() => { props.setInputProcessMode('raw'); props.setShowFidelityPopover(false); }}
                                        className={`flex items-center w-full px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${props.inputProcessMode === 'raw' ? 'bg-white/5 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                    >
                                        <Slash size={14} className="mr-2" />
                                        <span>Raw (Direct Send)</span>
                                    </button>
                                    <button 
                                        onClick={() => { props.setInputProcessMode('polish'); props.setShowFidelityPopover(false); }}
                                        className={`flex items-center w-full px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${props.inputProcessMode === 'polish' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                    >
                                        <Zap size={14} className="mr-2 text-emerald-400" />
                                        <span>Polish (Format)</span>
                                    </button>
                                    <button 
                                        onClick={() => { props.setInputProcessMode('enhance'); props.setShowFidelityPopover(false); }}
                                        className={`flex items-center w-full px-2.5 py-2 rounded-lg text-xs font-semibold transition-all ${props.inputProcessMode === 'enhance' ? 'bg-violet-500/10 text-violet-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                    >
                                        <Sparkles size={14} className="mr-2 text-violet-400" />
                                        <span>Enhance (AI Polish)</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => { if (props.chatMode === 'ai') props.handleExecutiveSubmit(); else props.handlePeerMessageSubmit(props.userInput); }}
                            disabled={Boolean((!props.userInput.trim() && !props.stagedFile && !props.isEnhancingInput) || props.isThinking)}
                            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${(props.userInput.trim() || props.stagedFile || props.isEnhancingInput) ? 'bg-cyan-600 text-white' : 'text-slate-700'}`}
                        >
                            {props.isEnhancingInput ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
