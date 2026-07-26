import React, { useState } from 'react';
import { Volume2, X, Search, Check } from 'lucide-react';
import { NeuralTag } from '../types';

interface VocalHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    vocalTags: NeuralTag[];
    tagSearchQuery: string;
    setTagSearchQuery: (q: string) => void;
    onApplyTag: (tagName: string) => void;
}

export const VocalHelpModal: React.FC<VocalHelpModalProps> = ({ 
    isOpen, onClose, vocalTags, tagSearchQuery, setTagSearchQuery, onApplyTag 
}) => {
    const [manualTab, setManualTab] = useState<'syntax' | 'library'>('syntax');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#18191c] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                        <Volume2 size={16} /> Neural Palette Glossary
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex border-b border-white/5">
                    <button 
                        onClick={() => setManualTab('syntax')}
                        className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider transition-colors ${manualTab === 'syntax' ? 'text-cyan-400 bg-cyan-500/10 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        How To Use
                    </button>
                    <button 
                        onClick={() => setManualTab('library')}
                        className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider transition-colors ${manualTab === 'library' ? 'text-cyan-400 bg-cyan-500/10 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Tag Library ({vocalTags.length})
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {manualTab === 'syntax' ? (
                        <div className="space-y-6">
                            <div className="p-4 bg-white/[0.02] border border-cyan-500/20 rounded-2xl space-y-2 shadow-[0_0_15px_rgba(34,211,238,0.05)]">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-cyan-400 font-mono">{"[ Vocal Tag ]"}</span>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-cyan-600">Instruction Layer</span>
                                </div>
                                <p className="text-[11px] text-slate-400 leading-relaxed">Direct instructions for the Eleven v3 engine. Modulates emotion, delivery, and accents. These are <b>never</b> spoken.</p>
                            </div>
                            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500 font-mono">{"(( Meta Commentary ))"}</span>
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">System Layer</span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed italic">Out-of-Character messages or technical notes. These are completely ignored by the vocal engine.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input 
                                    type="text"
                                    placeholder="Search tag library..."
                                    value={tagSearchQuery}
                                    onChange={(e) => setTagSearchQuery(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {vocalTags
                                    .filter(t => 
                                        t.name.toLowerCase().includes(tagSearchQuery.toLowerCase()) ||
                                        t.category.toLowerCase().includes(tagSearchQuery.toLowerCase()) ||
                                        t.description?.toLowerCase().includes(tagSearchQuery.toLowerCase())
                                    )
                                    .slice(0, 50)
                                    .map((tag) => (
                                        <div key={tag.name} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between group hover:bg-white/[0.04] transition-colors">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-bold text-cyan-400 font-mono">[{tag.name}]</span>
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">{tag.category}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 leading-tight">{tag.description}</p>
                                            </div>
                                            <button 
                                                onClick={() => onApplyTag(tag.name)}
                                                className="p-2 text-slate-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Check size={16} />
                                            </button>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
