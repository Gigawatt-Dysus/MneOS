import React from 'react';
import ZenOrb from './ZenOrb';
import { LucideFingerprint, LucideSlidersHorizontal, LucideX } from 'lucide-react';
import type { User } from '@/types';
import type { ServiceState, TelemetryData } from './ZenShared';

export interface ZenDashboardProps {
    user: User;
    health: Record<string, ServiceState>;
    sysStatus: string;
    telemetry: TelemetryData | null;
    alertLevel: 'normal' | 'warning' | 'critical';
    selectedService: string | null;
    setSelectedService: (key: string | null) => void;
    onOpenSettings: () => void;
    onClose: () => void;
}

const getStatusColor = (status: ServiceState['status']) => {
    switch (status) {
        case 'green': return 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse'; 
        case 'yellow': return 'bg-yellow-400';
        case 'red': return 'bg-red-500 animate-pulse'; 
        default: return 'bg-gray-600';
    }
};

const getTempColor = (temp: number) => {
    if (temp > 90) return 'text-red-500';
    if (temp > 80) return 'text-orange-500';
    if (temp > 55) return 'text-yellow-400';
    if (temp > 40) return 'text-yellow-200';
    return 'text-green-400';
};

const getTempGaugeWidth = (temp: number) => Math.min(Math.max(temp, 0), 100);

export default function ZenDashboard({ 
    user, health, sysStatus, telemetry, alertLevel, selectedService, setSelectedService, onOpenSettings, onClose 
}: ZenDashboardProps) {
    return (
        <header className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center p-4 border-b border-[#00ffcc]/30 bg-[#000510]/90 backdrop-blur-sm shrink-0 gap-4">
            
            {/* Branding */}
            <div className="flex items-center gap-4">
                <div className="p-2 border border-[#00ffcc] rounded bg-[#00ffcc]/10 shadow-[0_0_15px_rgba(0,255,204,0.3)]">
                    <ZenOrb size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-[0.2em] text-[#00ffcc] drop-shadow-[0_0_5px_#00ffcc]">ZEN.WHISPERER</h1>
                    <p className="text-[10px] text-[#00ffcc]/70 tracking-widest">CLOUD-NATIVE CONTEXT DEFENSE</p>
                </div>
            </div>

            {/* Mission Control */}
            <div className="flex gap-4">
                <div className="hidden md:flex flex-col justify-center px-4 py-2 bg-slate-800/50 border border-blue-900/50 rounded-lg shadow-lg w-[600px] relative">
                    <div className="flex items-center justify-between pb-1 mb-1 gap-4">
                        {Object.entries(health).map(([key, service]) => (
                            <button 
                                key={key} 
                                onClick={() => setSelectedService(selectedService === key ? null : key)}
                                className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                            >
                                <div className={`w-2 h-2 rounded-full transition-all duration-300 ${getStatusColor(service.status)}`}></div>
                                <span className="text-[10px] font-bold tracking-widest text-blue-300">{key}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-between items-center pt-1">
                        <div className="flex items-center gap-2 overflow-hidden w-full">
                            <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest whitespace-nowrap">OPS:</span>
                            <span className={`text-xs font-mono scifi-text tracking-wide whitespace-nowrap overflow-hidden text-ellipsis ${
                                alertLevel === 'critical' ? 'text-red-500 font-bold animate-pulse' : 
                                alertLevel === 'warning' ? 'text-orange-400 font-bold animate-pulse' : 
                                'text-blue-100'
                            }`}>
                                {sysStatus}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 ml-2 whitespace-nowrap">
                            <LucideFingerprint className="w-3 h-3 text-slate-500" />
                            <span className="text-[10px] font-mono text-slate-500">{user.id?.substring(0, 6)}...</span>
                        </div>
                    </div>
                </div>

                {/* Real Telemetry Panel */}
                <div className="hidden xl:flex flex-col justify-center px-4 py-2 bg-slate-800/50 border border-blue-900/50 rounded-lg shadow-lg min-w-[300px] relative h-full gap-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold tracking-wider mb-1">
                        <span>LOCAL SYSTEM</span>
                        {/* Note: timestamp handling handled in parent */}
                        <span className="font-mono text-blue-400">SAT-LINK</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-[10px] font-mono">
                        <div className="flex flex-col">
                            <span className="text-slate-500">CPU LOAD</span>
                            <span className="text-blue-300">{telemetry?.system?.cpuLoad ?? '--'}%</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-500">MEM LOAD</span>
                            <span className="text-blue-300">{telemetry?.system?.memUsed ?? '--'}%</span>
                        </div>
                        <div className="flex flex-col relative">
                            <span className="text-slate-500">CORE TEMP</span>
                            <span className={`${getTempColor(telemetry?.system?.cpuTemp || 0)} font-bold`}>
                                {telemetry?.system?.cpuTemp ?? '--'}°C
                            </span>
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-700 mt-1 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 ${
                                        (telemetry?.system?.cpuTemp || 0) > 90 ? 'bg-red-500' : 
                                        (telemetry?.system?.cpuTemp || 0) > 80 ? 'bg-orange-500' :
                                        (telemetry?.system?.cpuTemp || 0) > 55 ? 'bg-yellow-400' : 'bg-green-400'
                                    }`}
                                    style={{ width: `${getTempGaugeWidth(telemetry?.system?.cpuTemp || 0)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <button onClick={onOpenSettings} className="p-2 border border-[#00ffcc]/50 hover:bg-[#00ffcc]/20 rounded text-[#00ffcc] transition-all"><LucideSlidersHorizontal size={20} /></button>
                <button onClick={onClose} className="p-2 border border-red-500/50 text-red-500 hover:bg-red-900/30 rounded transition-all"><LucideX size={20} /></button>
            </div>

            {/* Detail Popover */}
            {selectedService && health[selectedService] && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-80 bg-black/90 border border-[#00ffcc] p-4 text-xs shadow-[0_0_20px_rgba(0,255,204,0.2)] z-50">
                    <h3 className="font-bold border-b border-[#00ffcc]/30 pb-2 mb-2 text-[#00ffcc]">{selectedService} DIAGNOSTICS</h3>
                    <pre className="whitespace-pre-wrap text-[#00ffcc]/80 font-mono">{health[selectedService].details}</pre>
                </div>
            )}
        </header>
    );
}