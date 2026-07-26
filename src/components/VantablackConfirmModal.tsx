import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface VantablackConfirmModalProps {
    mode: 'white' | 'grey' | 'black';
    count: number;
    onConfirm: () => void;
    onDismiss: () => void;
}

const getModeLabel = (mode: 'white' | 'grey' | 'black') => {
    switch (mode) {
        case 'white': return 'OPEN';
        case 'grey': return 'PASSIVE';
        case 'black': return 'BLACKOUT';
    }
};

const getModeColors = (mode: 'white' | 'grey' | 'black') => {
    switch (mode) {
        case 'white': return { bg: 'bg-white', text: 'text-black', border: 'border-slate-300', hover: 'hover:bg-slate-100' };
        case 'grey': return { bg: 'bg-gray-500', text: 'text-white', border: 'border-gray-400', hover: 'hover:bg-gray-400' };
        case 'black': return { bg: 'bg-black', text: 'text-white', border: 'border-white/30', hover: 'hover:bg-gray-900' };
    }
};

const VantablackConfirmModal: React.FC<VantablackConfirmModalProps> = ({ mode, count, onConfirm, onDismiss }) => {
    const colors = getModeColors(mode);
    const label = getModeLabel(mode);

    return (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6 border border-cyan-500/50 animate-toastIn">
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-full ${colors.bg} ${colors.text} ${colors.border} border`}>
                        <ShieldCheck size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Engage {label} Protocol?</h2>
                        <div className="mt-2 text-sm">
                            <p className="text-gray-300 mb-2">
                                You are about to apply <strong className="text-cyan-400">{label}</strong> exposure mode to <strong className="text-cyan-400">{count}</strong> entities.
                            </p>
                            <p className="text-gray-400 mt-2 text-xs">
                                {mode === 'black' && "BLACKOUT: These entities will be completely hidden from Creative Mode AI."}
                                {mode === 'grey' && "PASSIVE: AI will only access these entities if explicitly mentioned."}
                                {mode === 'white' && "OPEN: Full AI access restored for these entities."}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onDismiss}
                        className="px-4 py-2 text-gray-400 hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-6 py-2 ${colors.bg} ${colors.text} ${colors.border} border rounded-lg text-sm font-bold shadow-lg transition-all transform hover:scale-105 ${colors.hover}`}
                    >
                        Confirm {label}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VantablackConfirmModal;
