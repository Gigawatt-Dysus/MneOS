import React from 'react';
import { FileText, Tag as TagIcon, X } from 'lucide-react';
import { GlassButton } from '../../GlassButton';

interface InspectorHeaderProps {
    mode: 'meta' | 'tags';
    onClose: () => void;
}

export const InspectorHeader: React.FC<InspectorHeaderProps> = ({ mode, onClose }) => {
    return (
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-black/20 shrink-0">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${mode === 'meta' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {mode === 'meta' ? <FileText size={18}/> : <TagIcon size={18}/>}
                </div>
                <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest leading-none">
                        {mode === 'meta' ? 'Inspector' : 'Entities'}
                    </h2>
                    <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                        {mode === 'meta' ? 'METADATA & FORENSICS' : 'LINKED ASSETS'}
                    </span>
                </div>
            </div>
            <GlassButton onClick={onClose} variant="ghost" className="p-2 h-auto rounded-full">
                <X size={16}/>
            </GlassButton>
        </div>
    );
};