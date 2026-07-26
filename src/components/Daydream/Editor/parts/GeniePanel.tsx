import React from 'react';
import { Zap, X, Trash2, Eye, Check, Wand2, BookOpen, RefreshCw, Feather, MessageSquare } from 'lucide-react';
import { GenieInsight } from '../types';
import { GeniePacingModule } from '../../modules/GeniePacingModule';
import { GenieStyleModule } from '../../modules/GenieStyleModule';
import { RevisionConfig } from '../../../../services/ai/generators/daydream';

interface GeniePanelProps {
    critique: GenieInsight[];
    genieThinking: boolean;
    setShowGenie: (s: boolean) => void;
    handleIgnoreCritique: (i: number) => void;
    handleShowIssue: (q: string) => void;
    handleFixIssue: (q: string, f: string, i: number) => void;
    activeRevision: number | null;
    setActiveRevision: (i: number | null) => void;
    handleGenieRevision: (cfg: RevisionConfig, i: number) => void;
}

export const GeniePanel: React.FC<GeniePanelProps> = ({
    critique, genieThinking, setShowGenie, handleIgnoreCritique, handleShowIssue, handleFixIssue,
    activeRevision, setActiveRevision, handleGenieRevision
}) => {
    return (
        <div className="w-80 border-r border-white/10 bg-black/20 backdrop-blur-md p-6 flex flex-col gap-4 animate-in slide-in-from-left duration-300 overflow-y-auto custom-scrollbar z-50">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Zap size={16} className="text-yellow-400" />
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Writing Genie</h3>
                </div>
                <button onClick={() => setShowGenie(false)} className="hover:text-white text-slate-500"><X size={14} /></button>
            </div>

            {genieThinking ? (
                <div className="space-y-3 animate-pulse">
                    <div className="h-2 bg-white/10 rounded w-full"></div>
                    <p className="text-xs text-yellow-500/80 italic text-center">Reading your masterpiece...</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3 pb-20">
                    {critique.map((card, idx) => {
                        let Icon = Zap;
                        if (card.type === 'grammar') Icon = BookOpen;
                        if (card.type === 'pacing') Icon = RefreshCw;
                        if (card.type === 'style') Icon = Feather;
                        if (card.type === 'voice') Icon = MessageSquare;
                        if (card.type === 'sensory') Icon = Eye;

                        const colorClass = card.level === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                            card.level === 'praise' ? 'border-green-500/30 bg-green-500/5' : 'border-yellow-500/30 bg-yellow-500/5';

                        const textClass = card.level === 'critical' ? 'text-red-300' :
                            card.level === 'praise' ? 'text-green-300' : 'text-yellow-300';

                        return (
                            <div key={idx} className={`rounded-xl border p-4 ${colorClass} group animate-in slide-in-from-bottom-2`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <Icon size={14} className={textClass} />
                                        <span className={`text-[10px] uppercase font-bold ${textClass}`}>{card.type}</span>
                                    </div>
                                    <button onClick={() => handleIgnoreCritique(idx)} className="p-1 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed mb-3">{card.critique}</p>
                                <div className="bg-black/20 rounded p-2 mb-3">
                                    <p className="text-[11px] text-slate-400 italic">"{card.suggestion}"</p>
                                </div>

                                {card.level !== 'praise' && (
                                    <div className="relative">
                                        {(card.type === 'grammar' && card.quote) ? (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleShowIssue(card.quote!)} className="flex-1 bg-white/5 py-2 text-[10px] font-bold rounded">Show</button>
                                                <button onClick={() => handleFixIssue(card.quote!, card.correction || card.suggestion, idx)} className="flex-[2] bg-emerald-500/10 text-emerald-300 py-2 text-[10px] font-bold rounded">Fix This</button>
                                            </div>
                                        ) : (
                                            <>
                                                {activeRevision === idx ? (
                                                    <div className="mt-3 border-t border-white/5 pt-3">
                                                        {card.type === 'pacing' ? 
                                                            <GeniePacingModule onApply={(cfg: RevisionConfig) => handleGenieRevision(cfg, idx)} onCancel={() => setActiveRevision(null)} /> :
                                                            <GenieStyleModule onApply={(cfg: RevisionConfig) => handleGenieRevision(cfg, idx)} onCancel={() => setActiveRevision(null)} />
                                                        }
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setActiveRevision(idx)} className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-violet-500/10 rounded-lg text-[10px] font-bold text-slate-300">
                                                        <span>Open Genie Controls...</span>
                                                        <Wand2 size={12} />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
