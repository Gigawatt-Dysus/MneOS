import React from 'react';
import { 
    HardDrive, Database, RefreshCw, Activity, FileJson, Brain, 
    Play, RefreshCw as Reload 
} from 'lucide-react';
import type { Media } from '../../../types';

interface SystemSubTabProps {
    storageStats: { used: number; total: number; percent: number; count: number };
    hydrationStatus: string;
    isHydrating: boolean;
    onHydrateMemory: () => Promise<void>;
    scanStatus: string;
    runScan: () => Promise<void>;
    brokenLinks: Media[];
    duplicates: Media[];
    executePurge: (type: 'broken' | 'dupes') => Promise<void>;
    onBackup: () => void;
    onRepair: () => void;
    isRepairing: boolean;
}

export const SystemSubTab: React.FC<SystemSubTabProps> = (props) => {
    
    const clearCache = () => {
        if (!confirm("Clear local cache (images/history)? Keys remain.")) return;
        const keep = [
            'GIGI_SEC_FIREWORKS', 'GIGI_SEC_XAI', 'GIGI_SEC_TYPESENSE_HOST', 'GIGI_SEC_TYPESENSE_KEY',
            'GIGI_SEC_MODEL_FIREWORKS', 'GIGI_SEC_MODEL_RESERVE', 'GIGI_SEC_MODEL_XAI',
            'gigi_identity_cache', 'gigi_user_settings'
        ];
        const saved: Record<string, string> = {};
        keep.forEach(k => { const v = localStorage.getItem(k); if(v) saved[k] = v; });
        localStorage.clear();
        Object.entries(saved).forEach(([k,v]) => localStorage.setItem(k, v));
        window.location.reload();
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><HardDrive className="text-blue-400" size={20}/> System Health</h3>
            
            {/* Storage Health */}
            <div className="bg-black/20 p-4 rounded-xl border border-white/10">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-sm text-slate-300">Storage Usage ({props.storageStats.count} items)</span>
                    <span className="text-xs font-mono text-slate-400">{props.storageStats.used}MB / {props.storageStats.total}MB</span>
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 ${props.storageStats.percent > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${props.storageStats.percent}%` }} />
                </div>
            </div>

            {/* Memory Hydration */}
            <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                    <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Database size={16} className="text-purple-400" />
                    Vector Memory
                </h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-300">Hydration Status: {props.hydrationStatus}</p>
                        <p className="text-[10px] text-slate-500">Syncing local context with cloud knowledge.</p>
                    </div>
                    <button onClick={props.onHydrateMemory} disabled={props.isHydrating} className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded text-xs border border-purple-500/30 flex items-center gap-2">
                        {props.isHydrating ? <RefreshCw size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
                        {props.isHydrating ? 'Hydrating...' : 'Force Hydrate'}
                    </button>
                </div>
            </div>

            {/* Maintenance Actions */}
            <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Activity size={16} className="text-amber-400" />
                    Maintenance Actions
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={props.onBackup} className="p-3 bg-black/40 hover:bg-green-900/10 border border-green-500/20 hover:border-green-500/40 rounded flex flex-col items-center gap-1 transition-colors group">
                        <FileJson size={16} className="text-green-500 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-bold text-green-200">Export Events JSON</span>
                    </button>
                    <button onClick={props.onRepair} disabled={props.isRepairing} className="p-3 bg-black/40 hover:bg-yellow-900/10 border border-yellow-500/20 hover:border-yellow-500/40 rounded flex flex-col items-center gap-1 transition-colors group disabled:opacity-50">
                        <Brain size={16} className={`text-yellow-500 ${props.isRepairing ? 'animate-spin' : 'group-hover:scale-110'} transition-transform`} />
                        <span className="text-xs font-bold text-yellow-200">{props.isRepairing ? 'Repairing...' : 'Repair Descriptions'}</span>
                    </button>
                </div>
            </div>

            {/* Database Hygiene */}
            <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                    <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                    <Activity size={16} className="text-emerald-400" />
                    Database Hygiene
                </h3>
                    <div className="flex items-center justify-between mb-4">
                    <div><p className="text-xs text-slate-300">Scan Status: {props.scanStatus}</p></div>
                    <button onClick={props.runScan} className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded text-xs border border-emerald-500/30 flex items-center gap-2">
                        <Play size={12} /> Run Diagnostics
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-black/40 rounded border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-slate-400">Broken Links</span>
                            <span className="text-xs font-bold text-red-400">{props.brokenLinks.length}</span>
                        </div>
                        <button onClick={() => props.executePurge('broken')} disabled={props.brokenLinks.length === 0} className="w-full py-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 text-[10px] rounded border border-red-900/30 disabled:opacity-50">Purge Broken</button>
                    </div>
                    <div className="p-3 bg-black/40 rounded border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs text-slate-400">Duplicates</span>
                            <span className="text-xs font-bold text-amber-400">{props.duplicates.length}</span>
                        </div>
                            <button onClick={() => props.executePurge('dupes')} disabled={props.duplicates.length === 0} className="w-full py-1 bg-amber-900/20 hover:bg-amber-900/40 text-amber-400 text-[10px] rounded border border-amber-900/30 disabled:opacity-50">Purge Dupes</button>
                    </div>
                </div>
            </div>

            {/* Browser Actions */}
            <div className="grid grid-cols-2 gap-4">
                <button onClick={clearCache} className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl flex flex-col items-center justify-center gap-2">
                    <Reload className="text-blue-400" />
                    <span className="text-sm font-bold text-slate-200">Clear Cache</span>
                </button>
                <button onClick={() => window.location.reload()} className="p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl flex flex-col items-center justify-center gap-2">
                    <Activity className="text-emerald-400" />
                    <span className="text-sm font-bold text-slate-200">Force Reload</span>
                </button>
            </div>
        </div>
    );
};