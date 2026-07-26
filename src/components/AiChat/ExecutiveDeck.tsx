import React, { useRef } from 'react';
import { Sparkles, X, Save, Lock, Pin } from 'lucide-react';

const STANDARD_DIRECTIVES = [
    { label: "No Tech", value: "Strip all 1s/0s, digital, and voltage metaphors. Physical only." },
    { label: "Staccato+", value: "Force 1-in-2 staccato. Short, punchy, breathless." },
    { label: "Grit", value: "Add dirt and raw human emotion. Avoid poetic polish." },
    { label: "1985", value: "No internet-era concepts. Use 20th-century vocabulary only." }
];

interface ExecutiveDeckProps {
    executiveDirective: string;
    setExecutiveDirective: (val: string) => void; // Can be a simple setter or React.Dispatch
    isPinned: boolean;
    setIsPinned: (val: boolean) => void;
    isDeckExpanded: boolean;
    setIsDeckExpanded: (val: boolean) => void; // Maybe use this for something? Wait, index.tsx passed it but it wasn't interactive?
    // index.tsx line 972: className={`... ${isDeckExpanded ? 'mb-2' : '-mb-2 opacity-50 ...'}`}
    // It seems purely visual or state controlled? Let's pass the setter just in case we want a toggle later.
    userPresets: any[];
    onOpenPillNamer: () => void;
    onRemovePreset: (id: string, e: React.MouseEvent) => void;
}

export const ExecutiveDeck: React.FC<ExecutiveDeckProps> = ({
    executiveDirective, setExecutiveDirective,
    isPinned, setIsPinned,
    isDeckExpanded,
    userPresets,
    onOpenPillNamer,
    onRemovePreset
}) => {
    const executiveInputRef = useRef<HTMLInputElement>(null);

    // [ZEN V28] Stabilized Pill Processing
    // Memoize custom pills to prevent render thrashing
    const customPills = React.useMemo(() => {
        return userPresets.filter(p => {
            // Permissive filter: Allow 'pill' type OR items with a label (Legacy/Ghost support)
            return p.type === 'pill' || (p.label && !p.archived);
        });
    }, [userPresets]);

    // Merge with Standard Directives (Memoized)
    const allPills = React.useMemo(() => [
        ...STANDARD_DIRECTIVES.map(d => ({ ...d, isCustom: false, id: d.label })),
        ...customPills.map(p => ({
            label: p.label,
            value: p.value || p.description || p.label, // Fallback for legacy objects
            id: p.id,
            isCustom: true
        }))
    ], [customPills]);

    const handleChipClick = (msg: string, e: React.MouseEvent) => {
        // [ZEN V26] Keep focus on Executive HUD for manual editing
        if (e.shiftKey) {
            setExecutiveDirective((executiveDirective + " " + msg).trim());
        } else {
            setExecutiveDirective(msg);
        }
        setTimeout(() => executiveInputRef.current?.focus(), 10);
    };

    return (
        <div className={`relative transition-all duration-300 ${isDeckExpanded ? 'mb-2' : '-mb-2 opacity-50 hover:opacity-100'}`}>
            <div className="bg-[#0f1219]/80 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden shadow-lg transition-all hover:border-violet-500/30">

                <div className="flex items-center gap-2 p-3 pb-1">
                    <div className="relative group flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Sparkles size={12} className={`transition-colors ${executiveDirective ? 'text-[#BC13FE] animate-pulse' : 'text-slate-600'}`} />
                        </div>
                        <input
                            ref={executiveInputRef}
                            type="text"
                            value={executiveDirective}
                            onChange={(e) => setExecutiveDirective(e.target.value)}
                            onFocus={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            placeholder="EXECUTIVE DIRECTIVE (OVERRIDE)..."
                            className={`w-full bg-[#1a1d26] text-xs font-bold font-mono tracking-wider py-2 pl-9 pr-20 rounded-xl border transition-all placeholder:text-slate-600 focus:outline-none ${isPinned ? 'border-[#BC13FE] shadow-[0_0_10px_rgba(188,19,254,0.1)] text-violet-200' : 'border-white/5 text-slate-400 focus:border-violet-500/50'}`}
                        />
                        <div className="absolute inset-y-0 right-1 flex items-center gap-1">
                            {executiveDirective && (
                                <button onClick={() => setExecutiveDirective('')} className="p-1 text-slate-500 hover:text-white transition-colors"><X size={10} /></button>
                            )}
                            <div className="w-px h-4 bg-white/5 mx-1" />
                            {executiveDirective && (
                                <button
                                    onClick={onOpenPillNamer}
                                    className="p-1.5 text-green-500/50 hover:text-green-400 transition-colors bg-white/5 rounded-md"
                                    title="Store in Lab (Save Pill)"
                                >
                                    <Save size={10} />
                                </button>
                            )}
                            <button
                                onClick={() => setIsPinned(!isPinned)}
                                className={`p-1.5 transition-colors rounded-md ${isPinned ? 'bg-[#BC13FE] text-white shadow-[0_0_10px_#BC13FE]' : 'bg-white/5 text-slate-500 hover:text-white'}`}
                                title={isPinned ? "Directive Locked (Persists)" : "Auto-Clear on Send"}
                            >
                                {isPinned ? <Lock size={10} /> : <Pin size={10} />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Command Chips */}
                <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                    {allPills.map((chip, idx) => (
                        <button
                            key={chip.id || `${chip.label}-${idx}`}
                            onClick={(e) => handleChipClick(chip.value, e)}
                            className={`group relative px-2 py-1 border rounded-md text-[8px] font-bold transition-all uppercase tracking-wider tabular-nums
                                ${chip.isCustom
                                    ? 'bg-indigo-900/10 border-indigo-500/20 text-indigo-400 hover:text-indigo-200 hover:border-[#BC13FE] hover:shadow-[0_0_8px_rgba(188,19,254,0.3)] active:bg-[#BC13FE]/20'
                                    : 'bg-[#1a1d26] border-white/5 text-slate-500 hover:text-white hover:border-[#00FF41] hover:shadow-[0_0_8px_rgba(0,255,65,0.3)] active:bg-[#00FF41]/20'
                                }
                            `}
                            title={chip.value}
                        >
                            {chip.label}
                            {chip.isCustom && (
                                <span onClick={(e) => onRemovePreset(chip.id, e)} className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <X size={6} />
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
