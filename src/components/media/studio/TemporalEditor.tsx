import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown } from 'lucide-react';

interface TemporalEditorProps {
    datePrecision: 'exact' | 'day' | 'month' | 'year' | 'unknown';
    handlePrecisionChange: (p: 'exact' | 'day' | 'month' | 'year' | 'unknown') => void;
    dateStr: string;
    setDateStr: (val: string) => void;
    setIsDirty: (val: boolean) => void;
}

const TemporalEditor = React.memo(({ 
    datePrecision, handlePrecisionChange, dateStr, setDateStr, setIsDirty 
}: TemporalEditorProps) => {
    const [isPrecisionOpen, setIsPrecisionOpen] = useState(false);
    const precisionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (precisionRef.current && !precisionRef.current.contains(e.target as Node)) setIsPrecisionOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-6 bg-violet-500/5 border border-violet-500/10 rounded-2xl space-y-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
                        <Clock size={16} className="text-violet-400" />
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest block">Temporal Coordinates</span>
                        <span className="text-[9px] text-slate-500 font-medium uppercase tracking-[0.2em]">Archival Indexing</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Precision Level</label>
                        <div className="relative" ref={precisionRef}>
                            <button 
                                className="flex items-center gap-2 bg-black/60 border border-white/10 text-violet-400 text-[10px] font-black uppercase tracking-[0.15em] rounded-full px-4 py-2 hover:border-violet-500/50 transition-all"
                                onClick={() => setIsPrecisionOpen(!isPrecisionOpen)}
                            >
                                {datePrecision}
                                <ChevronDown size={12} className={`transition-transform ${isPrecisionOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isPrecisionOpen && (
                                <div className="absolute right-0 mt-2 w-40 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-[110] animate-in fade-in zoom-in-95">
                                    {(['exact', 'day', 'month', 'year', 'unknown'] as const).map((p) => (
                                        <button
                                            key={p}
                                            className={`w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-violet-500/20 ${
                                                datePrecision === p ? 'text-violet-400 bg-violet-500/10' : 'text-slate-500'
                                            }`}
                                            onClick={() => { handlePrecisionChange(p); setIsPrecisionOpen(false); }}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Logical Date</label>
                        <input
                            type={datePrecision === 'year' ? 'number' : datePrecision === 'month' ? 'month' : datePrecision === 'day' ? 'date' : 'datetime-local'}
                            value={dateStr}
                            step={datePrecision === 'exact' ? '60' : undefined}
                            onChange={(e) => {
                                setDateStr(e.target.value);
                                setIsDirty(true);
                            }}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white text-[13px] font-mono tracking-tight outline-none focus:border-violet-500/50 transition-all shadow-inner appearance-none"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                    <p className="text-[9px] text-slate-500 italic leading-relaxed">
                        Adjusting the temporal coordinates will shift this artifact's position within the Matrix. Use 'Year' precision for Shoebox items or memory fragments where the exact day is lost to time.
                    </p>
                </div>
            </div>
        </div>
    );
});

export default TemporalEditor;
