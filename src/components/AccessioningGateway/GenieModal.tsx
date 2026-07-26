import React from 'react';
import { X, Zap, FolderOpen, CheckCircle2, AlertCircle } from 'lucide-react';
import { GlassButton } from '../GlassButton';

interface GenieModalProps {
    isOpen: boolean;
    onClose: () => void;
    onIgnite: (jsonFiles: File[], htmlFiles: File[]) => void;
}

export const GenieModal: React.FC<GenieModalProps> = ({ isOpen, onClose, onIgnite }) => {
    const [jsonFiles, setJsonFiles] = React.useState<File[]>([]);
    const [htmlFiles, setHtmlFiles] = React.useState<File[]>([]);
    const [isIgniting, setIsIgniting] = React.useState(false);

    if (!isOpen) return null;

    const handleIgnite = async () => {
        if (jsonFiles.length === 0) return;
        setIsIgniting(true);
        // Small delay for UI feedback
        await new Promise(resolve => setTimeout(resolve, 500));
        onIgnite(jsonFiles, htmlFiles);
        onClose();
        setIsIgniting(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-full max-w-2xl bg-[#0f1219]/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-cyan-500/10 to-violet-600/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
                            <Zap className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight uppercase font-mono">Genie Command Center</h2>
                            <p className="text-xs text-slate-400">Configure Dual-Stream Archival Ingestion</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-8 overflow-y-auto">
                    {/* JSON Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-cyan-400 flex items-center gap-2 uppercase tracking-wider">
                            <CheckCircle2 className="w-4 h-4" /> 1. Primary Archive (JSON)
                        </label>
                        <div 
                            className={`p-6 border-2 border-dashed rounded-xl transition-all ${
                                jsonFiles.length > 0 
                                    ? 'border-green-500/50 bg-green-500/5' 
                                    : 'border-white/10 hover:border-cyan-500/30 bg-white/5'
                            }`}
                        >
                            <input 
                                type="file" 
                                id="json-folder-input"
                                className="hidden" 
                                // @ts-ignore
                                webkitdirectory="" 
                                // @ts-ignore
                                directory="" 
                                onChange={(e) => {
                                    if (e.target.files) setJsonFiles(Array.from(e.target.files));
                                }}
                            />
                            <div className="flex flex-col items-center justify-center text-center gap-3">
                                {jsonFiles.length > 0 ? (
                                    <>
                                        <div className="text-green-400 font-medium">Archive Loaded Successfully</div>
                                        <div className="text-xs text-slate-400">{jsonFiles.length} files detected in source</div>
                                        <button 
                                            onClick={() => document.getElementById('json-folder-input')?.click()}
                                            className="text-xs text-cyan-400 hover:underline mt-2"
                                        >
                                            Change Folder
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <FolderOpen className="w-10 h-10 text-slate-500 mb-2" />
                                        <p className="text-sm text-slate-300">Select the folder containing your <b>JSON</b> export</p>
                                        <GlassButton 
                                            onClick={() => document.getElementById('json-folder-input')?.click()}
                                            variant="secondary"
                                            className="mt-2"
                                        >
                                            Select JSON Folder
                                        </GlassButton>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* HTML Section */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-violet-400 flex items-center gap-2 uppercase tracking-wider">
                            <Zap className="w-4 h-4" /> 2. Recon Data (HTML) - <span className="text-slate-500 normal-case italic">Optional</span>
                        </label>
                        <div 
                            className={`p-6 border-2 border-dashed rounded-xl transition-all ${
                                htmlFiles.length > 0 
                                    ? 'border-violet-500/50 bg-violet-500/5' 
                                    : 'border-white/10 hover:border-violet-500/30 bg-white/5'
                            }`}
                        >
                            <input 
                                type="file" 
                                id="html-folder-input"
                                className="hidden" 
                                // @ts-ignore
                                webkitdirectory="" 
                                // @ts-ignore
                                directory="" 
                                onChange={(e) => {
                                    if (e.target.files) setHtmlFiles(Array.from(e.target.files));
                                }}
                            />
                            <div className="flex flex-col items-center justify-center text-center gap-3">
                                {htmlFiles.length > 0 ? (
                                    <>
                                        <div className="text-violet-400 font-medium">Recon Data Mapped</div>
                                        <div className="text-xs text-slate-400">{htmlFiles.length} HTML nodes identified for stitching</div>
                                        <button 
                                            onClick={() => document.getElementById('html-folder-input')?.click()}
                                            className="text-xs text-violet-400 hover:underline mt-2"
                                        >
                                            Change Folder
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-10 h-10 text-slate-500 mb-2 opacity-50" />
                                        <p className="text-sm text-slate-400 italic">Select HTML folder to unlock "Naming Sovereignty"</p>
                                        <GlassButton 
                                            onClick={() => document.getElementById('html-folder-input')?.click()}
                                            variant="secondary"
                                            className="mt-2 opacity-70 hover:opacity-100"
                                        >
                                            Select HTML Folder
                                        </GlassButton>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Pro Tip */}
                    <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg flex gap-3 items-start">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-200/70 leading-relaxed">
                            <b>Sovereign Tip:</b> Using both JSON and HTML exports allows GIGI to "stitch" narrative captions from the HTML onto the high-fidelity media paths in the JSON. This resolves "Imported Media" placeholders automatically.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-black/40 flex justify-end gap-4">
                    <GlassButton onClick={onClose} variant="secondary">
                        CANCEL
                    </GlassButton>
                    <GlassButton 
                        onClick={handleIgnite} 
                        variant="primary"
                        disabled={jsonFiles.length === 0 || isIgniting}
                        className="min-w-[160px] relative group"
                    >
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-violet-500 rounded-lg blur opacity-40 group-hover:opacity-100 transition duration-1000"></div>
                        <div className="relative flex items-center justify-center gap-2">
                            {isIgniting ? (
                                <Zap className="w-4 h-4 animate-pulse" />
                            ) : (
                                <Zap className="w-4 h-4" />
                            )}
                            {isIgniting ? 'IGNITING...' : 'IGNITE GENIE'}
                        </div>
                    </GlassButton>
                </div>
            </div>
        </div>
    );
};
