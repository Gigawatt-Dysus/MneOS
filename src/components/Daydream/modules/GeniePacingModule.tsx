
import React, { useState } from 'react';
import { GlassButton } from '../../GlassButton';
import { RevisionConfig } from '../../../services/ai/generators/daydream';
import { FastForward, Pause, Activity, Maximize2, Minimize2, Zap, Play } from 'lucide-react';

interface GeniePacingModuleProps {
    onApply: (config: RevisionConfig) => void;
    onCancel: () => void;
}

export const GeniePacingModule: React.FC<GeniePacingModuleProps> = ({ onApply, onCancel }) => {

    // PACING STATE
    const [speed, setSpeed] = useState<'fast' | 'slow' | 'balanced'>('balanced');
    const [density, setDensity] = useState<'expand' | 'condense' | undefined>(undefined);
    const [energy, setEnergy] = useState<number>(5);
    const [waistLine, setWaistLine] = useState<boolean>(false);

    const handleApply = () => {
        const config: RevisionConfig = {
            mode: 'pacing',
            speed,
            density,
            energy,
            waistLine
        };
        onApply(config);
    };

    return (
        <div className="flex flex-col gap-4 animate-in slide-in-from-right duration-300">

            {/* SPEED CONTROL */}
            <div className="bg-black/20 rounded-lg p-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Narrative Speed</label>
                <div className="flex gap-1 bg-black/40 p-1 rounded-lg">
                    <button onClick={() => setSpeed('slow')} className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${speed === 'slow' ? 'bg-indigo-500/20 text-indigo-300 shadow' : 'text-slate-500 hover:text-white'}`}>
                        <Pause size={12} /> Slow
                    </button>
                    <button onClick={() => setSpeed('balanced')} className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all ${speed === 'balanced' ? 'bg-cyan-500/20 text-cyan-300 shadow' : 'text-slate-500 hover:text-white'}`}>
                        Balanced
                    </button>
                    <button onClick={() => setSpeed('fast')} className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${speed === 'fast' ? 'bg-pink-500/20 text-pink-300 shadow' : 'text-slate-500 hover:text-white'}`}>
                        Fast <FastForward size={12} />
                    </button>
                </div>
            </div>

            {/* DENSITY CONTROL */}
            <div className="flex gap-2">
                <button
                    onClick={() => setDensity(density === 'expand' ? undefined : 'expand')}
                    className={`flex-1 p-3 rounded-lg border ${density === 'expand' ? 'bg-violet-500/20 border-violet-500/50 text-violet-300' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'} transition-all`}
                >
                    <Maximize2 size={16} className="mb-1" />
                    <div className="text-[10px] font-bold uppercase">Expand</div>
                    <div className="text-[9px] opacity-60">Add Detail</div>
                </button>
                <button
                    onClick={() => setDensity(density === 'condense' ? undefined : 'condense')}
                    className={`flex-1 p-3 rounded-lg border ${density === 'condense' ? 'bg-orange-500/20 border-orange-500/50 text-orange-300' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'} transition-all`}
                >
                    <Minimize2 size={16} className="mb-1" />
                    <div className="text-[10px] font-bold uppercase">Condense</div>
                    <div className="text-[9px] opacity-60">Summarize</div>
                </button>
            </div>

            {/* ENERGY SLIDER */}
            <div className="bg-black/20 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Activity size={12} /> Energy Level
                    </label>
                    <span className={`text-[10px] font-bold ${energy > 7 ? 'text-red-400' : energy < 4 ? 'text-blue-300' : 'text-slate-300'}`}>
                        {energy === 10 ? 'MAXIMUM' : energy}
                    </span>
                </div>
                <input
                    type="range" min="1" max="10" value={energy}
                    onChange={(e) => setEnergy(parseInt(e.target.value))}
                    className="w-full accent-cyan-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[8px] text-slate-600 mt-1 uppercase font-bold tracking-wider">
                    <span>Serene</span>
                    <span>Dynamic</span>
                    <span>Chaotic</span>
                </div>
            </div>

            {/* ACTIONS */}
            <div className="flex gap-2 mt-2">
                <GlassButton onClick={onCancel} className="flex-1 text-xs">
                    Cancel
                </GlassButton>
                <GlassButton onClick={handleApply} variant="primary" className="flex-[2] gap-2 text-xs font-bold bg-gradient-to-r from-cyan-600 to-violet-600 border-none">
                    <Zap size={14} className="fill-white" /> Rewrite Scene
                </GlassButton>
            </div>
        </div>
    );
};
