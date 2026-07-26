import React from 'react';
import { RefreshCw, Database } from 'lucide-react';

export class BridgeLockedBoundary extends React.Component<{
    children: React.ReactNode,
    onReset: () => void,
    title?: string
}, { hasError: boolean, error: any }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }
    componentDidCatch(error: any, errorInfo: any) {
        console.error(`[Bridge Locked] 🧊 Diagnostic Pulse:`, error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="flex-1 w-full flex flex-col items-center justify-center p-12 bg-[#0a0a0b]/95 backdrop-blur-2xl border border-red-500/20 rounded-[2.5rem] text-center space-y-8 animate-in fade-in zoom-in-95 duration-500 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30 animate-pulse">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/40">
                            <span className="text-red-500 font-black text-2xl">!</span>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-white">{this.props.title || 'Bridge Locked'}</h2>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Stability Issue Detected</p>
                    </div>
                    <div className="p-6 bg-black/60 border border-white/5 rounded-2xl font-mono text-[10px] text-red-400/80 max-w-sm break-all leading-relaxed shadow-inner">
                        {this.state.error?.message || 'FATAL: UNKNOWN_STABILITY_ERROR'}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                this.props.onReset();
                            }}
                            className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-[11px] font-black uppercase rounded-xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-red-500/20 group"
                        >
                            <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                            Manual Reset & Sync
                        </button>
                        <button
                            onClick={() => {
                                sessionStorage.clear();
                                localStorage.removeItem('gigi_identity_cache');
                                window.dispatchEvent(new Event('gigi-hard-reset'));
                            }}
                            className="px-8 py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-black uppercase rounded-xl border border-white/10 transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                            <Database size={14} />
                            Clear Neural Cache
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
