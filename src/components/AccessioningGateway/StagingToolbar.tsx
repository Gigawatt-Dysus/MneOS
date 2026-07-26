import React from 'react';
import { Upload, Save, Trash2, RotateCw, ArrowUpDown, Zap, Activity } from 'lucide-react';
import { GlassButton } from '../GlassButton';

export interface StagingToolbarProps {
    assetCount: number;
    isSaving: boolean;
    sortOrder?: 'asc' | 'desc';
    onToggleSort?: () => void;
    onClear: () => void;
    onPurgeNoise?: () => void;
    onSave: () => void;
    onImport?: (files: File[]) => void;
    onGenieImport?: (files: File[]) => void;
    onToggleTelemetry?: () => void;
}

export const StagingToolbar: React.FC<StagingToolbarProps> = ({
    assetCount,
    isSaving,
    sortOrder,
    onToggleSort,
    onClear,
    onPurgeNoise,
    onSave,
    onImport,
    onGenieImport,
    onToggleTelemetry
}) => {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-white/10 pb-4 shrink-0">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                    <Upload className="w-6 h-6 text-cyan-400" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold font-mono text-cyan-400 tracking-wider uppercase">
                    ACCESSIONING GATEWAY // <span className="text-slate-400 font-normal">{assetCount} ARTIFACTS</span>
                </h2>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
                {onToggleTelemetry && (
                    <GlassButton
                        onClick={onToggleTelemetry}
                        variant="secondary"
                        className="flex-1 sm:flex-none border-[#45A29E]/30 text-[#45A29E] hover:bg-[#45A29E]/10"
                    >
                        <Activity className="w-4 h-4" /> TELEMETRY
                    </GlassButton>
                )}

                {onImport && (
                    <div className="relative group flex-1 sm:flex-none">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-violet-600 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
                        <GlassButton 
                            onClick={() => onGenieImport?.([])} 
                            variant="primary" 
                            className="w-full justify-center relative bg-[#0f1219] hover:bg-black/40 border-cyan-500/50"
                        >
                            <Zap className="mr-2 text-cyan-400 w-4 h-4" /> ACTIVATE GENIE
                        </GlassButton>
                    </div>
                )}

                {onToggleSort && (
                    <GlassButton
                        onClick={onToggleSort}
                        variant="secondary"
                        className="flex-1 sm:flex-none border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                        title={sortOrder === 'desc' ? 'Showing Newest First' : 'Showing Oldest First'}
                    >
                        <ArrowUpDown className={`w-4 h-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                        {sortOrder === 'desc' ? 'NEWEST' : 'OLDEST'}
                    </GlassButton>
                )}

                <GlassButton
                    onClick={onClear}
                    variant="secondary"
                    className="flex-1 sm:flex-none border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                    <Trash2 className="w-4 h-4" /> CLEAR ALL
                </GlassButton>

                {onPurgeNoise && (
                    <GlassButton
                        onClick={onPurgeNoise}
                        variant="secondary"
                        className="flex-1 sm:flex-none border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                        title="Vaporize Noise (Likes/Reactions)"
                    >
                        <Zap className="w-4 h-4" /> VAPORIZE NOISE
                    </GlassButton>
                )}

                <GlassButton
                    onClick={onSave}
                    disabled={isSaving || assetCount === 0}
                    variant="primary"
                    className="flex-1 sm:flex-none"
                >
                    {isSaving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isSaving ? 'COMMITTING...' : 'COMMIT TO MATRIX'}
                </GlassButton>
            </div>
        </div>
    );
};