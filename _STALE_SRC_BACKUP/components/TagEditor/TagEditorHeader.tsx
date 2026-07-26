import React from 'react';
import { X, RefreshCcw } from 'lucide-react';

interface TagEditorHeaderProps {
    title: string;
    description: string;
    saveState: 'idle' | 'saving' | 'saved';
    onClose: () => void;
}

export const TagEditorHeader: React.FC<TagEditorHeaderProps> = ({ title, description, saveState, onClose }) => {
    return (
        <div className="flex justify-between items-start p-6 border-b border-white/5 bg-[#13161f] relative">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">{title}</h2>
                <p className="text-slate-400 text-sm">{description}</p>
                
                {saveState === 'saving' && (
                    <div className="absolute top-6 right-16 px-3 py-1 bg-black/40 rounded-full border border-cyan-500/30 flex items-center gap-2">
                        <RefreshCcw className="w-3 h-3 text-cyan-400 animate-spin"/> 
                        <span className="text-[10px] text-cyan-400 font-mono uppercase tracking-wider">Saving...</span>
                    </div>
                )}
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                <X size={24}/>
            </button>
        </div>
    );
};