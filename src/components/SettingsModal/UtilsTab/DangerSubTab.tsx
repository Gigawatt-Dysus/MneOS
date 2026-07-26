import React from 'react';
import { AlertTriangle, Trash2, Download } from 'lucide-react';

interface DangerSubTabProps {
    factoryReset: () => void;
    onExport?: () => void;
}

export const DangerSubTab: React.FC<DangerSubTabProps> = ({ factoryReset, onExport }) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-center gap-4">
                <AlertTriangle className="text-red-500" size={24} />
                <div>
                    <h3 className="text-sm font-bold text-red-400">Destructive Actions</h3>
                    <p className="text-xs text-red-300/70">Proceed with caution.</p>
                </div>
            </div>
            <div className="flex justify-between items-center bg-black/20 p-4 rounded-lg border border-red-900/20">
                <div>
                    <h4 className="text-sm font-medium text-white">Factory Reset <span className="text-[10px] text-red-500 ml-2 border border-red-500/30 px-1 rounded">LOCKED</span></h4>
                    <p className="text-xs text-slate-400">Wipe all data & keys. (Disabled by AI Safety Protocol)</p>
                </div>
                <button 
                    onClick={() => alert("🚨 SOVEREIGN LOCKOUT: This destructive action has been hard-locked to prevent autonomous AI misfires.")} 
                    disabled={true} 
                    className="px-3 py-2 bg-red-900/50 text-white/50 rounded text-xs font-bold flex items-center gap-2 cursor-not-allowed border border-red-900"
                    title="Locked by AI Safety Protocol"
                >
                    <Trash2 size={14} /> Wipe Device
                </button>
            </div>
            <div className="flex justify-between items-center bg-black/20 p-4 rounded-lg border border-white/5">
                <div>
                    <h4 className="text-sm font-medium text-white">Export Debug Dump</h4>
                    <p className="text-xs text-slate-400">Download logs & config.</p>
                </div>
                <button onClick={onExport} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-bold flex items-center gap-2">
                    <Download size={14} /> Export JSON
                </button>
            </div>
        </div>
    );
};