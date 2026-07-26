import React from 'react';
import { List, Save, RefreshCw, Cloud } from 'lucide-react';

interface RosterSubTabProps {
    roster: { fireworks: string; reserve: string; xai: string; };
    handleRosterChange: (k: any, v: string) => void;
    status: string;
    handleLocalSave: () => void;
    handleCloudSync: () => void;
    isSaving: boolean;
}

export const RosterSubTab: React.FC<RosterSubTabProps> = ({
    roster, handleRosterChange, status, handleLocalSave, handleCloudSync, isSaving
}) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><List className="text-blue-400" size={20}/> AI Model Roster</h3>
            </div>
            <p className="text-xs text-slate-400">Set the specific Model IDs for each slot. If a slot is empty, it will be skipped.</p>
            
            <div className="space-y-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium text-violet-300 block">1. Primary (Fireworks)</label>
                    <input type="text" value={roster.fireworks} onChange={(e) => handleRosterChange('fireworks', e.target.value)} className="w-full bg-black/40 border border-violet-500/30 rounded-lg px-4 py-2.5 text-sm focus:border-violet-500 outline-none text-white font-mono" />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-300 block">2. Reserve Slot</label>
                    <input type="text" value={roster.reserve} onChange={(e) => handleRosterChange('reserve', e.target.value)} placeholder="(Optional) e.g. accounts/fireworks/models/mixtral..." className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-slate-500 outline-none text-white font-mono" />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium text-white block">3. xAI (Grok)</label>
                    <input type="text" value={roster.xai} onChange={(e) => handleRosterChange('xai', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:border-white outline-none text-white font-mono" />
                </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <span className={`text-xs ${status.includes('❌') ? 'text-red-400' : 'text-emerald-400'}`}>{status}</span>
                <div className="flex gap-2">
                    <button onClick={handleLocalSave} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-bold flex gap-2"><Save size={14}/> Save Device</button>
                    <button onClick={handleCloudSync} disabled={isSaving} className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold flex gap-2 disabled:opacity-50">
                        {isSaving ? <RefreshCw size={14} className="animate-spin"/> : <Cloud size={14}/>} Sync Cloud
                    </button>
                </div>
            </div>
        </div>
    );
};