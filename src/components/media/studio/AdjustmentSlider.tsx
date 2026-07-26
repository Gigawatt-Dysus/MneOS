import React from 'react';

interface AdjustmentSliderProps {
    label: string;
    icon: React.ReactNode;
    value: number;
    min: number;
    max: number;
    onChange: (val: number) => void;
    displayFormatter?: (val: number) => string;
}

const AdjustmentSlider = ({ label, icon, value, min, max, onChange, displayFormatter }: AdjustmentSliderProps) => (
    <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-slate-400">
                {icon}
                <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-500">
                {displayFormatter ? displayFormatter(value) : (value > 0 ? `+${value}` : value)}
            </span>
        </div>
        <input 
            type="range" 
            min={min} 
            max={max} 
            value={value} 
            onChange={(e) => onChange(parseInt(e.target.value))} 
            className="w-full h-1 bg-white/5 rounded-full appearance-none accent-cyan-500 cursor-pointer hover:bg-white/10 transition-all"
        />
    </div>
);

export default AdjustmentSlider;
