import React from 'react';
import { Zap, X, Check, Search, RefreshCw } from 'lucide-react';
import { User, ChatMessage } from '../../../types';
import { RUBRIC_ITEMS } from '../types';

interface CognitiveOverrideModalProps {
    overridePointId: string | null;
    onClose: () => void;
    user: User;
    messages: ChatMessage[];
    rubricSelections: Set<string>;
    setRubricSelections: (s: Set<string>) => void;
    overrideDirective: string;
    setOverrideDirective: (d: string) => void;
    isAnalyzingBreach: boolean;
    onRunAudit: () => void;
    onApply: (directive: string, valence: 'reward' | 'penalty' | 'validation', labels: string[]) => void;
}

export const CognitiveOverrideModal: React.FC<CognitiveOverrideModalProps> = ({
    overridePointId, onClose, user, messages, rubricSelections, setRubricSelections,
    overrideDirective, setOverrideDirective, isAnalyzingBreach, onRunAudit, onApply
}) => {
    if (!overridePointId) return null;

    const isReward = rubricSelections.size === 0;
    const penaltySum = Array.from(rubricSelections).reduce((acc, id) => acc + (RUBRIC_ITEMS.find(i => i.id === id)?.penalty || 0), 0);

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-[#18191c] border border-orange-500/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_50px_rgba(249,115,22,0.15)] flex flex-col">
                <div className="p-4 border-b border-white/5 bg-black/40 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between w-24">
                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Confidence</p>
                                <p className="text-[8px] font-black text-cyan-400">{user.sovereignMemex?.neuralConfidence ?? 50}%</p>
                            </div>
                            <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${user.sovereignMemex?.neuralConfidence ?? 50}%` }} />
                            </div>
                        </div>
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400 flex items-center gap-2">
                        <Zap size={14} /> Cognitive Override
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh] custom-scrollbar">
                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Neural Rubric Audit</p>
                        <div className="grid grid-cols-1 gap-2">
                            {RUBRIC_ITEMS.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        const newSet = new Set(rubricSelections);
                                        if (newSet.has(item.id)) newSet.delete(item.id);
                                        else newSet.add(item.id);
                                        setRubricSelections(newSet);
                                    }}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${rubricSelections.has(item.id) 
                                        ? 'bg-orange-500/20 border-orange-500/50 text-orange-200' 
                                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                >
                                    <span className="text-xs font-bold">{item.label}</span>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${rubricSelections.has(item.id) ? 'bg-orange-500 border-orange-400' : 'border-white/20'}`}>
                                        {rubricSelections.has(item.id) && <Check size={10} className="text-white" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                {isReward ? '🏆 Neural Reinforcement' : '⚠️ Neural Correction'}
                            </p>
                            <div className="flex items-center gap-3">
                                {!isReward && (
                                    <button 
                                        onClick={onRunAudit}
                                        disabled={isAnalyzingBreach}
                                        className="text-[10px] font-black uppercase text-cyan-400 hover:text-cyan-300 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {isAnalyzingBreach ? <RefreshCw size={10} className="animate-spin" /> : <Search size={10} />}
                                        Run Forensic Audit
                                    </button>
                                )}
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isReward ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                    {isReward ? '+20 Points' : `-${penaltySum} Points`}
                                </span>
                            </div>
                        </div>
                        <textarea
                            value={overrideDirective}
                            onChange={(e) => setOverrideDirective(e.target.value)}
                            placeholder={isReward ? "Optional: Add a note of praise..." : "State the rule plainly..."}
                            className="w-full h-24 bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none font-mono"
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button 
                        onClick={() => onApply(overrideDirective, isReward ? 'reward' : 'penalty', RUBRIC_ITEMS.filter(i => rubricSelections.has(i.id)).map(i => i.label))}
                        className={`px-6 py-2 ${isReward ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-orange-500 hover:bg-orange-400'} text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 flex items-center gap-2`}
                    >
                        <Zap size={14} /> {isReward ? 'Award Points' : 'Apply Penalties'}
                    </button>
                </div>
            </div>
        </div>
    );
};
