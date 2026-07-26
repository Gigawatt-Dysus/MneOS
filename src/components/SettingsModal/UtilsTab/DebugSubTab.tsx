import React from 'react';
import { Terminal, Cpu, ToggleRight, ToggleLeft, Activity, AlertTriangle, Server, Wifi } from 'lucide-react';

interface DebugSubTabProps {
    debugSettings: { showThinking: boolean; verboseLogging: boolean; mockMode: boolean; logNetwork: boolean; showSystemPrompts: boolean; };
    toggleDebug: (k: any) => void;
}

export const DebugSubTab: React.FC<DebugSubTabProps> = ({ debugSettings, toggleDebug }) => {
    const Option = ({ label, desc, icon: Icon, color, field }: any) => (
        <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex gap-3">
                <div className={`p-2 rounded-lg h-fit bg-white/5 ${color}`}><Icon size={18} /></div>
                <div><h4 className="text-sm font-medium text-white">{label}</h4><p className="text-xs text-slate-400">{desc}</p></div>
            </div>
            <button onClick={() => toggleDebug(field)} className={`text-2xl transition-colors ${(debugSettings as any)[field] ? color : 'text-slate-700'}`}>
                {(debugSettings as any)[field] ? <ToggleRight /> : <ToggleLeft />}
            </button>
        </div>
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Terminal className="text-amber-400" size={20}/> Developer Config</h3>
            <div className="grid gap-3">
                <Option label="Show Thinking" desc="Display internal monologue." icon={Cpu} color="text-emerald-400" field="showThinking" />
                <Option label="Verbose Logging" desc="Raw API payloads to console." icon={Activity} color="text-blue-400" field="verboseLogging" />
                <Option label="Mock Mode" desc="Simulate API responses." icon={AlertTriangle} color="text-amber-400" field="mockMode" />
                <Option label="Reveal System Prompts" desc="Show hidden instructions." icon={Server} color="text-purple-400" field="showSystemPrompts" />
                <Option label="Log Network Traffic" desc="Log detailed fetch/XHR." icon={Wifi} color="text-pink-400" field="logNetwork" />
            </div>
        </div>
    );
};