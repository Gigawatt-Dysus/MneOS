import React from 'react';
import { Sliders, X, Zap } from 'lucide-react';
import { DirectorState } from '../types';

interface SidebarProps {
    director: DirectorState;
    setDirector: React.Dispatch<React.SetStateAction<DirectorState>>;
    savedTones: string[];
    saveTone: (tone: string) => void;
    deleteTone: (tone: string) => void;
    setIsSidebarOpen: (s: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    director, setDirector, savedTones, saveTone, deleteTone, setIsSidebarOpen
}) => {
    return (
        <div className="w-80 border-l border-white/10 bg-black/20 backdrop-blur-md p-6 flex flex-col gap-8 animate-in slide-in-from-right duration-300 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Sliders size={16} className="text-violet-400" />
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Director Controls</h3>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
            </div>

            {/* Creativity Slider */}
            <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>Creativity</span>
                    <span className="text-cyan-400">{director.temperature}</span>
                </div>
                <input
                    type="range" min="0.1" max="1.5" step="0.1"
                    value={director.temperature}
                    onChange={(e) => setDirector({ ...director, temperature: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            {/* Output Length */}
            <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span>Output Length</span>
                    <span className="text-emerald-400 capitalize">{director.length}</span>
                </div>
                <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                    {['short', 'medium', 'long'].map((l) => (
                        <button
                            key={l}
                            onClick={() => setDirector({ ...director, length: l as any })}
                            className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded-md transition-all ${director.length === l ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-white'}`}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tone Instruction */}
            <div className="space-y-3">
                <div className="text-xs font-bold text-slate-400">Tone Instruction</div>
                <input
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
                    value={director.tone}
                    onChange={(e) => setDirector({ ...director, tone: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveTone(director.tone); }}
                    placeholder="e.g. Noir, Whimsical..."
                />
                <div className="flex flex-wrap gap-2">
                    {savedTones.map(t => (
                        <div key={t} className="flex items-center gap-1 bg-white/5 hover:bg-white/10 rounded-md pl-2 pr-1 py-1 transition-colors group">
                            <button onClick={() => setDirector({ ...director, tone: t })} className="text-[10px] text-slate-400 group-hover:text-violet-300 truncate max-w-[100px]">{t}</button>
                            <button onClick={() => deleteTone(t)} className="text-slate-600 hover:text-red-400"><X size={10} /></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Intensity */}
            <div className="space-y-3 pt-4 border-t border-white/5">
                <div className="flex justify-between text-xs font-bold text-slate-400">
                    <span className="flex items-center gap-1"><Zap size={12} /> Intensity</span>
                    <span className={`capitalize ${director.intensity === 'tame' ? 'text-blue-400' : director.intensity === 'feral' ? 'text-orange-400' : 'text-red-500 animate-pulse'}`}>
                        {director.intensity}
                    </span>
                </div>
                <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                    {['tame', 'feral', 'unhinged'].map((i) => (
                        <button
                            key={i}
                            onClick={() => setDirector({ ...director, intensity: i as any })}
                            className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded-md transition-all ${director.intensity === i ? 'bg-red-500/20 text-red-400' : 'text-slate-500'}`}
                        >
                            {i}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
