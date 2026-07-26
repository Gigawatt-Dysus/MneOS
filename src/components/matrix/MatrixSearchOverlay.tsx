import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Search, Zap, ScanLine } from 'lucide-react';

interface MatrixSearchOverlayProps {
    isVisible: boolean;
    searchTerm: string;
}

export const MatrixSearchOverlay: React.FC<MatrixSearchOverlayProps> = ({ isVisible, searchTerm }) => {
    if (!isVisible) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-[#0B0C10] border border-cyan-500/30 p-8 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] max-w-md w-full text-center relative overflow-hidden">
                
                {/* Scanner Bar Animation */}
                <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_15px_#06b6d4] animate-[scan_2s_linear_infinite]" />

                <div className="relative z-10 flex flex-col items-center gap-6">
                    {/* Icon Stack */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20 animate-pulse" />
                        <Loader2 className="w-16 h-16 text-cyan-400 animate-spin" />
                        <ScanLine className="w-8 h-8 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80" />
                    </div>

                    <div className="space-y-3">
                        <h2 className="text-xl font-bold font-mono text-cyan-400 tracking-widest uppercase">
                            System Processing
                        </h2>
                        <div className="text-gray-300 font-mono text-sm leading-relaxed">
                            <p className="mb-2 opacity-80">Scanning Matrix for Temporal Signatures Matching:</p>
                            <div className="bg-cyan-900/20 border border-cyan-500/30 px-4 py-2 rounded-lg text-white font-bold tracking-wide shadow-inner inline-block">
                                "{searchTerm}"
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono uppercase tracking-widest mt-2">
                        <Zap className="w-3 h-3 text-yellow-400 animate-pulse" />
                        <span>Indexing Neural Pathways...</span>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};