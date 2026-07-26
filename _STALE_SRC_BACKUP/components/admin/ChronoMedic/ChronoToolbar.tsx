import React from 'react';
import { X, Trash2, Eraser, ThumbsUp, Wand2 } from 'lucide-react';

interface ChronoToolbarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onBatchDelete: () => void;
    onBatchWipe: () => void;
    onBatchAccept: () => void;
    onBatchFix: () => void;
}

// [ZEN UI] Reusing the Matrix Studio Tooltip Button logic for consistency
const TooltipButton = ({ onClick, icon: Icon, label, variant = 'default' }: any) => {
    const gradients: Record<string, string> = {
        default: 'bg-gradient-to-b from-slate-700 to-slate-900 border-white/10 hover:border-white/30',
        danger: 'bg-gradient-to-b from-red-900 to-red-950 border-red-500/30 hover:border-red-400/60 shadow-[0_0_15px_rgba(220,38,38,0.2)]',
        success: 'bg-gradient-to-b from-emerald-900 to-emerald-950 border-emerald-500/30 hover:border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
        warning: 'bg-gradient-to-b from-amber-900 to-amber-950 border-amber-500/30 hover:border-amber-400/60',
        info: 'bg-gradient-to-b from-blue-900 to-blue-950 border-blue-500/30 hover:border-blue-400/60',
    };

    const iconColors: Record<string, string> = {
        default: 'text-slate-300',
        danger: 'text-red-300',
        success: 'text-emerald-300',
        warning: 'text-amber-300',
        info: 'text-blue-300',
    };

    return (
        <div className="group relative flex items-center justify-center">
            <button 
                onClick={(e) => { e.stopPropagation(); onClick(e); }}
                className={`
                    relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300
                    shadow-[0_4px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.2)] 
                    active:translate-y-0.5 active:shadow-none hover:scale-110 hover:-translate-y-1 hover:brightness-110
                    border ${gradients[variant] || gradients.default}
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

export const ChronoToolbar: React.FC<ChronoToolbarProps> = ({
    selectedCount, onClearSelection, onBatchDelete, onBatchWipe, onBatchAccept, onBatchFix
}) => {
    if (selectedCount === 0) return null;

    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#0f1219]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center gap-4 p-3 z-50 animate-in slide-in-from-bottom-4 duration-200 ring-1 ring-white/5">
            
            {/* Selection Counter */}
            <div className="flex items-center gap-3 pr-4 border-r border-white/10">
                <div className="bg-white/10 px-3 py-1 rounded-lg text-white font-bold text-xs font-mono">
                    {selectedCount}
                </div>
                <button 
                    onClick={onClearSelection} 
                    className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    title="Clear Selection"
                >
                    <X size={16} />
                </button>
            </div>
            
            <div className="flex items-center gap-2">
                
                {/* 1. DELETE */}
                <TooltipButton 
                    onClick={onBatchDelete}
                    icon={Trash2} 
                    label="Delete Files" 
                    variant="danger" 
                />

                {/* 2. WIPE DATES */}
                <TooltipButton 
                    onClick={onBatchWipe}
                    icon={Eraser} 
                    label="Wipe Dates" 
                    variant="warning" 
                />

                <div className="w-px h-8 bg-white/10 mx-1"/>

                {/* 3. ACCEPT CURRENT */}
                <TooltipButton 
                    onClick={onBatchAccept}
                    icon={ThumbsUp} 
                    label="Accept Current" 
                    variant="info" 
                />
                
                {/* 4. APPLY FIXES */}
                <TooltipButton 
                    onClick={onBatchFix}
                    icon={Wand2} 
                    label="Auto-Fix from Filename" 
                    variant="success" 
                />
            </div>
        </div>
    );
};