import React from 'react';

interface GlassToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    description?: string;
}

export const GlassToggle: React.FC<GlassToggleProps> = ({ checked, onChange, label, description }) => (
    <div className="flex items-center justify-between py-3 group">
        <div className="flex flex-col pr-4">
            {label && <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">{label}</span>}
            {description && <span className="text-xs text-slate-400 mt-0.5">{description}</span>}
        </div>
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 border shrink-0 ${
                checked 
                    ? 'bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                    : 'bg-black/40 border-white/10 hover:border-white/20'
            }`}
        >
            <div 
                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${
                    checked ? 'left-[calc(100%-1.25rem)] scale-110' : 'left-1'
                }`} 
            />
        </button>
    </div>
);

interface GlassSliderProps {
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
    label: string;
    description?: string;
    formatValue?: (val: number) => string;
}

export const GlassSlider: React.FC<GlassSliderProps> = ({ 
    value, min, max, step = 1, onChange, label, description, formatValue 
}) => {
    const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

    // Local state for smooth typing
    const [inputValue, setInputValue] = React.useState<string>(
        formatValue ? formatValue(value) : value.toString()
    );
    const [isFocused, setIsFocused] = React.useState(false);

    // Sync input when slider is dragged externally (only if not actively typing)
    React.useEffect(() => {
        if (!isFocused) {
            setInputValue(formatValue ? formatValue(value) : value.toString());
        }
    }, [value, formatValue, isFocused]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!isNaN(parsed) && e.target.value !== '-') {
            onChange(parsed);
        }
    };

    const handleInputBlur = () => {
        setIsFocused(false);
        let parsed = parseFloat(inputValue);
        if (isNaN(parsed)) parsed = min;
        // Clamp the final value
        parsed = Math.max(min, Math.min(max, parsed));
        onChange(parsed);
        setInputValue(formatValue ? formatValue(parsed) : parsed.toString());
    };

    return (
        <div className="py-3 space-y-3">
            <div className="flex justify-between items-end">
                <div>
                    <label className="block text-sm font-bold text-slate-200">{label}</label>
                    {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
                </div>
                <input 
                    type="text"
                    value={inputValue}
                    onFocus={() => setIsFocused(true)}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
                    className="w-16 text-right text-xs font-mono font-bold text-cyan-400 bg-cyan-950/30 px-2 py-1 rounded border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)] outline-none focus:border-cyan-400 transition-colors"
                />
            </div>
            
            <div className="relative w-full h-6 flex items-center group cursor-pointer">
                {/* Track */}
                <div className="absolute w-full h-1.5 bg-black/60 rounded-full border border-white/10 overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 opacity-80 transition-all duration-75" 
                        style={{ width: `${percentage}%` }} 
                    />
                </div>
                
                {/* Thumb */}
                <div 
                    className="absolute h-4 w-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] border-2 border-cyan-500 pointer-events-none transition-transform duration-75 group-hover:scale-110"
                    style={{ left: `calc(${percentage}% - 8px)` }}
                />

                <input 
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>
        </div>
    );
};