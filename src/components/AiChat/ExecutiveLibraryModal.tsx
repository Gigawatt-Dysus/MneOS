import React from 'react';
import { createPortal } from 'react-dom';
import { Save, X, RefreshCw } from 'lucide-react';
import { cleanLabel } from '../../utils/formatters';

interface ExecutiveLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    pillNameInput: string;
    setPillNameInput: (val: string) => void;
    onSave: () => void;
    isSavingPill: boolean;
    executiveDirective: string;
}

export const ExecutiveLibraryModal: React.FC<ExecutiveLibraryModalProps> = ({
    isOpen, onClose, pillNameInput, setPillNameInput, onSave, isSavingPill, executiveDirective
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[20000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-[#131416] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8 space-y-8 animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-600/20 rounded-lg border border-emerald-500/30">
                            <Save className="text-emerald-400" size={18} />
                        </div>
                        <h2 className="text-lg font-bold uppercase tracking-widest text-white leading-none">Pill Laboratory</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Pill Assignment</label>
                        <input
                            autoFocus
                            type="text"
                            value={pillNameInput}
                            onChange={(e) => setPillNameInput(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && onSave()}
                            placeholder="ENTER PILL LABEL..."
                            className="w-full bg-black border border-white/5 rounded-xl px-4 py-4 text-xs font-bold text-emerald-400 placeholder:text-slate-700 tracking-[0.2em] focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                        />
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block mb-2">Encoded Directive</span>
                        <p className="text-[10px] text-slate-400 font-mono leading-relaxed line-clamp-3">"{executiveDirective}"</p>
                    </div>
                </div>

                <button
                    disabled={!cleanLabel(pillNameInput) || isSavingPill}
                    onClick={onSave}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold uppercase tracking-widest rounded-xl shadow-xl transition-all flex items-center justify-center gap-2"
                >
                    {isSavingPill ? (
                        <>
                            <RefreshCw size={16} className="animate-spin" />
                            <span>Sealing...</span>
                        </>
                    ) : (
                        "Seal Directive"
                    )}
                </button>
            </div>
        </div>,
        document.body
    );
};
