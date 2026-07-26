import React, { useState, useRef, useEffect } from 'react';
import { getApiLogs, clearApiLogs } from '../../../services/aiOrchestrator';
import type { ApiLogEntry } from '../../../types';
import { RefreshCcw, Trash2, Terminal, AlertTriangle, CheckCircle, XCircle, Shield } from 'lucide-react';
import { GlassButton } from '../../GlassButton';

export const LogConsole: React.FC = () => {
    const [logs, setLogs] = useState<ApiLogEntry[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const loadLogs = () => setLogs([...getApiLogs()]);

    useEffect(() => {
        loadLogs();
        const handleUpdate = () => loadLogs();
        window.addEventListener('gigi-api-log-update', handleUpdate);
        return () => window.removeEventListener('gigi-api-log-update', handleUpdate);
    }, []);

    const formatTime = (d: Date) => {
        return new Date(d).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 } as any);
    };

    const getIcon = (type: ApiLogEntry['type']) => {
        switch(type) {
            case 'error': return <XCircle size={14} className="text-red-500" />;
            case 'warning': return <AlertTriangle size={14} className="text-amber-500" />;
            case 'safety_block': return <Shield size={14} className="text-orange-500" />;
            case 'success': return <CheckCircle size={14} className="text-emerald-500" />;
            default: return <Terminal size={14} className="text-slate-500" />;
        }
    };

    return (
        <div className="flex flex-col h-[600px] bg-black/40 rounded-xl border border-white/10 font-mono text-xs shadow-inner backdrop-blur-sm overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-white/5 border-b border-white/5">
                <span className="text-slate-400 font-bold flex items-center gap-2">
                    <Terminal size={14} /> SYSTEM DIAGNOSTICS
                </span>
                <div className="flex gap-2">
                    <GlassButton onClick={loadLogs} variant="ghost" className="h-6 w-6 p-0 flex items-center justify-center">
                        <RefreshCcw size={12}/>
                    </GlassButton>
                    <GlassButton onClick={clearApiLogs} variant="ghost" className="h-6 w-6 p-0 flex items-center justify-center text-red-400 hover:bg-red-900/20">
                        <Trash2 size={12}/>
                    </GlassButton>
                </div>
            </div>
            
            <div className="flex-grow overflow-y-auto p-2 custom-scrollbar space-y-1" ref={scrollRef}>
                {logs.length === 0 ? (
                    <div className="text-slate-600 text-center mt-20 italic flex flex-col items-center gap-2">
                        <Terminal size={32} className="opacity-20"/>
                        <span>No logs recorded this session.</span>
                    </div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} className="group border-b border-white/5 pb-1 last:border-0">
                            <div 
                                className={`flex gap-3 cursor-pointer hover:bg-white/5 p-2 rounded transition-colors ${expandedId === log.id ? 'bg-white/5' : ''}`} 
                                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            >
                                <span className="text-slate-500 flex-shrink-0 w-20">{formatTime(log.timestamp)}</span>
                                <span className="flex-shrink-0 mt-0.5">{getIcon(log.type)}</span>
                                <span className="text-cyan-600 w-32 flex-shrink-0 truncate" title={log.model}>{log.model}</span>
                                <span className="text-slate-300 truncate flex-grow">{log.message}</span>
                            </div>
                            
                            {expandedId === log.id && log.details && (
                                <div className="pl-24 pr-2 pb-2 mt-1 animate-in slide-in-from-top-1">
                                    <pre className="whitespace-pre-wrap break-words bg-black/60 p-3 rounded border border-white/10 text-slate-400 select-all shadow-inner">
                                        {JSON.stringify(log.details, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            <div className="p-2 bg-white/5 border-t border-white/5 text-[10px] text-slate-500 flex justify-between">
                <span>STATUS: ONLINE</span>
                <span>logs::mem_store</span>
            </div>
        </div>
    );
};