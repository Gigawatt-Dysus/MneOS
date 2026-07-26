import React from 'react';
import { Loader2, DownloadCloud, ExternalLink, X, StopCircle } from 'lucide-react';
import { ImportStep } from '../../hooks/useGooglePhotos';

interface ImportModalProps {
    isOpen: boolean;
    step: ImportStep;
    errorMsg: string;
    onLaunch: () => void;
    onCancel: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, step, errorMsg, onLaunch, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-[#0f1219] max-w-md w-full rounded-2xl border border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.2)] p-8 text-center">
                
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <DownloadCloud className="text-blue-500" /> Import Photos
                    </h2>
                    <button onClick={onCancel} className="text-gray-500 hover:text-white"><X size={20}/></button>
                </div>

                {step === 'init' && (
                    <div className="py-8 flex flex-col items-center">
                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                        <p className="text-blue-300">Initializing Secure Link...</p>
                    </div>
                )}

                {step === 'ready' && (
                    <div className="py-4">
                        <p className="text-slate-300 mb-6">Link established. Click below to open the secure Google Picker in a new window.</p>
                        <button 
                            onClick={onLaunch}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] shadow-lg"
                        >
                            <ExternalLink /> LAUNCH PICKER
                        </button>
                    </div>
                )}

                {step === 'polling' && (
                    <div className="py-8 flex flex-col items-center">
                        <div className="w-16 h-16 relative mb-6">
                            <div className="absolute inset-0 border-4 border-blue-500/30 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Waiting for selection...</h3>
                        <p className="text-sm text-slate-400 mb-6">Select photos in the popup window and click 'Done'.</p>
                        <button 
                            onClick={onCancel}
                            className="flex items-center gap-2 px-4 py-2 border border-red-500/50 text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg text-sm mx-auto"
                        >
                            <StopCircle size={16}/> Cancel Import
                        </button>
                    </div>
                )}

                {step === 'downloading' && (
                    <div className="py-8 flex flex-col items-center">
                        <Loader2 className="w-12 h-12 text-green-500 animate-spin mb-4" />
                        <h3 className="text-lg font-bold text-white">Transferring Artifacts...</h3>
                        <p className="text-sm text-green-400 mt-2">Finalizing download to Staging Area...</p>
                    </div>
                )}

                {step === 'error' && (
                    <div className="py-4">
                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6 text-left">
                            <p className="text-red-400 text-sm font-mono">{errorMsg}</p>
                        </div>
                        <button onClick={onCancel} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white">Close</button>
                    </div>
                )}
            </div>
        </div>
    );
};