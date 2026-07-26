import React from 'react';
import { Loader2, Wrench, RefreshCw, Play, X } from 'lucide-react';
import { GlassButton } from '../../GlassButton';

interface ChronoHeaderProps {
    isLoading: boolean;
    scanForAnomalies: () => void;
    startReview: () => void;
    hasPending: boolean;
    isReviewing: boolean;
    onClose?: () => void;
}

export const ChronoHeader: React.FC<ChronoHeaderProps> = ({ 
    isLoading, scanForAnomalies, startReview, hasPending, isReviewing, onClose 
}) => {
    return (
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <Wrench size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        Chrono-Medic <span className="text-[10px] bg-red-900/50 text-red-300 px-2 py-0.5 rounded border border-red-500/30">SURGEON MODE</span>
                    </h2>
                    <p className="text-slate-400 text-xs font-mono">Manual Review & Repair Console</p>
                </div>
            </div>
            
            <div className="flex gap-2">
                <GlassButton onClick={scanForAnomalies} disabled={isLoading || isReviewing} variant="secondary">
                    {isLoading ? <Loader2 className="animate-spin" /> : <RefreshCw size={16} className="mr-2" />}
                    Scan Matrix
                </GlassButton>
                {!isReviewing && hasPending && (
                    <GlassButton 
                        onClick={startReview} 
                        variant="primary"
                        className="bg-emerald-600 hover:bg-emerald-500 border-emerald-400 animate-pulse"
                    >
                        <Play size={16} className="mr-2 fill-current" />
                        Start Review
                    </GlassButton>
                )}
                {onClose && (
                    <GlassButton onClick={onClose} variant="ghost" className="hover:bg-red-500/20 hover:text-red-400">
                        <X size={20} />
                    </GlassButton>
                )}
            </div>
        </div>
    );
};