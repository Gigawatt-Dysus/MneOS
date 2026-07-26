import React from 'react';
import { Save, Loader2, Copy, X } from 'lucide-react';
import { UniversalMedia } from '../MediaStudioModal';
import { WikiText } from '../../shared/WikiText';

interface StudioHeaderProps {
    asset: UniversalMedia;
    viewMode: 'original' | 'polished' | 'split';
    setViewMode: (mode: 'original' | 'polished' | 'split') => void;
    handleSave: (mode: 'replace' | 'version') => void;
    isSaving: boolean;
    isDirty: boolean;
    migrationStatus: string | null;
    handleAttemptClose: () => void;
}

const StudioHeader = ({ 
    asset, 
    viewMode, 
    setViewMode, 
    handleSave, 
    isSaving, 
    isDirty,
    migrationStatus, 
    handleAttemptClose 
}: StudioHeaderProps) => {
    return (
        <div className="h-16 border-b border-white/5 bg-black/40 flex items-center justify-between px-6 z-50">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">LifeOS Studio</span>
                </div>
                <div className="h-4 w-[1px] bg-white/10" />
                <span 
                    className="text-[10px] font-medium text-slate-500 uppercase tracking-widest truncate max-w-[280px] lg:max-w-[400px] block"
                    title={asset.title || 'Accession Artifact'}
                >
                    <WikiText text={asset.title || 'Accession Artifact'} className="!whitespace-nowrap !leading-none" />
                </span>
            </div>

            {/* View Switcher (Horizontal Center) */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-full border border-white/10">
                <button onClick={() => setViewMode('original')} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'original' ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}>Original</button>
                <button onClick={() => setViewMode('polished')} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'polished' ? 'bg-cyan-500 text-black' : 'text-slate-500 hover:text-white'}`}>Polished</button>
                <button onClick={() => setViewMode('split')} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'split' ? 'bg-violet-500 text-black' : 'text-slate-500 hover:text-white'}`}>Split</button>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center bg-cyan-500 rounded-full shadow-[0_0_30px_rgba(6,182,212,0.2)] overflow-hidden">
                    <button 
                        onClick={() => handleSave('replace')} 
                        disabled={isSaving || !!migrationStatus} 
                        className="px-6 py-2.5 hover:bg-cyan-400 disabled:bg-slate-800 text-black font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-3 transition-all active:scale-95 border-r border-black/10"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                        {migrationStatus ? migrationStatus : 'Replace Master'}
                    </button>
                    <button 
                        onClick={() => handleSave('version')}
                        disabled={isSaving || !!migrationStatus}
                        title="Save as New Version"
                        className="px-4 py-2.5 hover:bg-cyan-400 disabled:bg-slate-800 text-black transition-all active:scale-95 flex items-center justify-center"
                    >
                        <Copy size={14} />
                    </button>
                </div>
                <button onClick={handleAttemptClose} className="p-2 text-slate-500 hover:text-white transition-colors">
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};

export default StudioHeader;
