
import React, { useState } from 'react';
import { GlassButton } from '../../GlassButton';
import { RevisionConfig } from '../../../services/ai/generators/daydream';
import { Feather, MessageSquare, Shield, Globe, Type, Wand2, Zap } from 'lucide-react';

interface GenieStyleModuleProps {
    onApply: (config: RevisionConfig) => void;
    onCancel: () => void;
}

const TONES = ['Neutral', 'Optimistic', 'Dark/Gritty', 'Whimsical', 'Urgent', 'Melancholic', 'Sarcastic', 'Professional'];
const PERSONAS = ['Default', 'The Expert', 'The Storyteller', 'The Marketer', 'The Poet', 'The Friend'];

export const GenieStyleModule: React.FC<GenieStyleModuleProps> = ({ onApply, onCancel }) => {

    const [tone, setTone] = useState<string>('Neutral');
    const [persona, setPersona] = useState<string>('Default');
    const [formality, setFormality] = useState<number>(5);
    const [pov, setPov] = useState<'first' | 'second' | 'third'>('third');
    const [activeVoice, setActiveVoice] = useState<boolean>(false);
    const [inclusive, setInclusive] = useState<boolean>(false);

    const handleApply = () => {
        const config: RevisionConfig = {
            mode: 'style',
            tone: tone === 'Neutral' ? undefined : tone,
            persona: persona === 'Default' ? undefined : persona,
            formality,
            pov,
            activeVoice,
            inclusive
        };
        onApply(config);
    };

    return (
        <div className="flex flex-col gap-4 animate-in slide-in-from-right duration-300">

            {/* TONE & PERSONA */}
            <div className="grid grid-cols-2 gap-2">
                <div className="bg-black/20 rounded-lg p-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Tone</label>
                    <select
                        value={tone} onChange={(e) => setTone(e.target.value)}
                        className="w-full bg-black/40 text-xs text-slate-300 border border-white/10 rounded px-2 py-1 outline-none focus:border-cyan-500"
                    >
                        {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="bg-black/20 rounded-lg p-2">
                    <label className="text-[9px] font-bold text-slate-500 uppercase mb-1 block">Persona</label>
                    <select
                        value={persona} onChange={(e) => setPersona(e.target.value)}
                        className="w-full bg-black/40 text-xs text-slate-300 border border-white/10 rounded px-2 py-1 outline-none focus:border-violet-500"
                    >
                        {PERSONAS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            {/* FORMALITY SLIDER */}
            <div className="bg-black/20 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Type size={12} /> Formality
                    </label>
                    <span className="text-[10px] font-bold text-slate-300">{formality}/10</span>
                </div>
                <input
                    type="range" min="1" max="10" value={formality}
                    onChange={(e) => setFormality(parseInt(e.target.value))}
                    className="w-full accent-violet-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[8px] text-slate-600 mt-1 uppercase font-bold tracking-wider">
                    <span>Casual</span>
                    <span>Academic</span>
                </div>
            </div>

            {/* TOGGLES */}
            <div className="flex flex-col gap-2">
                <div className="flex bg-black/20 p-1 rounded-lg">
                    {['first', 'second', 'third'].map((p) => (
                        <button
                            key={p}
                            onClick={() => setPov(p as any)}
                            className={`flex-1 py-1.5 text-[10px] uppercase font-bold rounded transition-all ${pov === p ? 'bg-white/10 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {p === 'first' ? '1st' : p === 'second' ? '2nd' : '3rd'} POV
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setActiveVoice(!activeVoice)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all flex justify-between items-center ${activeVoice ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300' : 'bg-white/5 border-white/5 text-slate-400'}`}
                >
                    <span className="flex items-center gap-2"><Feather size={12} /> Force Active Voice</span>
                    <Wand2 size={12} className={activeVoice ? 'opacity-100' : 'opacity-0'} />
                </button>

                <button
                    onClick={() => setInclusive(!inclusive)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all flex justify-between items-center ${inclusive ? 'bg-violet-500/10 border-violet-500/30 text-violet-300' : 'bg-white/5 border-white/5 text-slate-400'}`}
                >
                    <span className="flex items-center gap-2"><Globe size={12} /> Inclusive Language</span>
                    <Shield size={12} className={inclusive ? 'opacity-100' : 'opacity-0'} />
                </button>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-2 mt-2">
                <GlassButton onClick={onCancel} className="flex-1 text-xs">
                    Cancel
                </GlassButton>
                <GlassButton onClick={handleApply} variant="primary" className="flex-[2] gap-2 text-xs font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 border-none">
                    <Zap size={14} className="fill-white" /> Rewrite Style
                </GlassButton>
            </div>
        </div>
    );
};
