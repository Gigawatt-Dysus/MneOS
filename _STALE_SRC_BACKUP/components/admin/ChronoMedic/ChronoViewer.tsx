import React from 'react';
import { Calendar, FileText, AlertTriangle, Eye, SkipForward, Save, Trash2, RotateCcw } from 'lucide-react';
import { Patient } from './types';

interface ChronoViewerProps {
    patient: Patient | null;
    dateInput: string;
    setDateInput: (val: string) => void;
    onResetDate: () => void;
    onSkip: () => void;
    onDelete: () => void;
    onApprove: () => void;
    onClose: () => void;
    hasPatients: boolean;
    safeDateStr: (val: any) => string;
}

// Reusing local tooltip component for self-containment
const TooltipButton = ({ onClick, icon: Icon, label, variant = 'default', customClass }: any) => {
    const gradients: Record<string, string> = {
        default: 'bg-gradient-to-b from-slate-700 to-slate-900 border-white/10 hover:border-white/30',
        danger: 'bg-gradient-to-b from-red-900 to-red-950 border-red-500/30 hover:border-red-400/60 shadow-[0_0_15px_rgba(220,38,38,0.2)]',
        success: 'bg-gradient-to-b from-emerald-900 to-emerald-950 border-emerald-500/30 hover:border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
        warning: 'bg-gradient-to-b from-amber-900 to-amber-950 border-amber-500/30 hover:border-amber-400/60',
    };

    const iconColors: Record<string, string> = {
        default: 'text-slate-300',
        danger: 'text-red-300',
        success: 'text-emerald-300',
        warning: 'text-amber-300',
    };

    return (
        <div className="group relative flex items-center justify-center">
            <button
                onClick={(e) => { e.stopPropagation(); onClick(e); }}
                className={`
                    relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300
                    shadow-[0_4px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] 
                    active:translate-y-0.5 active:shadow-none hover:scale-110 hover:-translate-y-1 hover:brightness-110
                    border ${gradients[variant] || gradients.default} ${customClass}
                `}
            >
                <Icon size={18} className={iconColors[variant]} strokeWidth={2} />
            </button>

            <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] flex flex-col items-center">
                <div className="bg-black/90 backdrop-blur-xl border border-white/20 px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest text-white shadow-2xl uppercase whitespace-nowrap">
                    {label}
                </div>
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black/90 mt-[-1px]"></div>
            </div>
        </div>
    );
};

export const ChronoViewer: React.FC<ChronoViewerProps> = ({
    patient, dateInput, setDateInput, onResetDate, onSkip, onDelete, onApprove, safeDateStr
}) => {
    if (!patient) return null;

    return (
        <div className="w-full h-full flex flex-col relative animate-in zoom-in-95 duration-300">

            {/* --- VISUAL STAGE --- */}
            {/* [ZEN FIX] Added pb-24 to prevent image from being covered by the pill */}
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden pb-24">
                <img
                    src={patient.url}
                    alt="Evidence"
                    className="max-w-full max-h-full object-contain shadow-2xl select-none"
                />

                {/* HUD: Metadata Overlay */}
                <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-xl border border-white/10 p-4 rounded-2xl max-w-sm shadow-2xl">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText size={14} className="text-cyan-400" />
                        <span className="text-xs font-bold text-white truncate">{patient.originalName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono bg-black/40 px-2 py-1 rounded border border-white/5">
                        <AlertTriangle size={10} className="text-red-500" />
                        Current: <span className="text-red-400 font-bold tracking-wider">{safeDateStr(patient.currentDate)}</span>
                    </div>
                </div>
            </div>

            {/* --- COMMAND DECK (Floating Bottom Center) --- */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-3 rounded-2xl bg-[#0f1219]/90 backdrop-blur-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] ring-1 ring-white/5 z-50">

                {/* SECTION 1: Time Circuit (Date Picker) */}
                <div className="relative group flex items-center bg-white/5 rounded-xl border border-white/5 focus-within:border-emerald-500/50 focus-within:bg-white/10 transition-all">
                    <div className="pl-3 pr-1 text-slate-400">
                        <Calendar size={16} />
                    </div>
                    <input
                        type="datetime-local"
                        value={dateInput}
                        onChange={(e) => setDateInput(e.target.value)}
                        className="bg-transparent border-none text-white text-xs font-mono py-2.5 pr-3 focus:ring-0 outline-none w-[180px] uppercase tracking-wider"
                    />
                    {/* Reset Date Mini-Button */}
                    <button
                        onClick={onResetDate}
                        className="absolute -top-2 -right-2 bg-slate-700 text-slate-300 rounded-full p-1 border border-white/10 shadow hover:bg-slate-600 transition-colors opacity-0 group-hover:opacity-100"
                        title="Reset to Suggested"
                    >
                        <RotateCcw size={10} />
                    </button>
                </div>

                <div className="w-px h-8 bg-white/10 mx-1" />

                {/* SECTION 2: Action Buttons */}
                <div className="flex items-center gap-2">
                    <TooltipButton
                        onClick={onSkip}
                        icon={SkipForward}
                        label="Skip"
                        variant="default"
                    />

                    <TooltipButton
                        onClick={onDelete}
                        icon={Trash2}
                        label="Delete Artifact"
                        variant="danger"
                    />

                    <div className="w-px h-8 bg-white/10 mx-1" />

                    <TooltipButton
                        onClick={onApprove}
                        icon={Save}
                        label="Confirm Fix"
                        variant="success"
                        customClass="ring-1 ring-emerald-500/50"
                    />
                </div>
            </div>
        </div>
    );
};