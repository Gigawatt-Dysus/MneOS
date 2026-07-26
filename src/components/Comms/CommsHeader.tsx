import React from 'react';
import { Radio, Book, Wifi, Search, RefreshCw, Plus, Menu, X } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import { SubHeader, SubHeaderAction } from '../SubHeader';

interface CommsHeaderProps {
    systemMode: 'signals' | 'logs';
    searchTerm: string;
    isMobileMenuOpen: boolean;
    onToggleMobileMenu: () => void;
    onModeSwitch: (mode: 'signals' | 'logs') => void;
    onSearchChange: (term: string) => void;
    onCreateNew: () => void;
    onExit?: () => void; // [ZEN NEW]
}

export const SignalBars = () => (
    <div className="flex items-end gap-0.5 h-3 opacity-60">
        {[...Array(4)].map((_, i) => (
            <div
                key={i}
                className="w-0.5 bg-cyan-500/80 animate-pulse"
                style={{ height: `${Math.random() * 100}%`, animationDuration: `${0.5 + Math.random()}s` }}
            />
        ))}
    </div>
);

export const CommsHeader: React.FC<CommsHeaderProps> = ({
    systemMode, searchTerm, isMobileMenuOpen, onToggleMobileMenu,
    onModeSwitch, onSearchChange, onCreateNew, onExit
}) => {
    return (
        <SubHeader
            left={
                <div className="flex items-center gap-2">
                    {onExit && (
                        <button
                            onClick={onExit}
                            className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/5 transition-all"
                            title="Return to Dashboard"
                        >
                            <X size={20} />
                        </button>
                    )}
                    <button
                        onClick={onToggleMobileMenu}
                        title={isMobileMenuOpen ? "Close Channels Menu" : "Open Channels Menu"}
                        className="md:hidden p-2 text-slate-400 hover:text-white bg-white/5 rounded-lg border border-white/5"
                    >
                        {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-black/30 rounded-lg border border-white/5" title="Connection Status: Secure AES-256">
                        <Wifi size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider">ONLINE</span>
                        <SignalBars />
                    </div>
                </div>
            }
            right={
                <div className="flex items-center gap-2 w-full lg:w-auto">
                    {/* Mode Switch (Consolidated) */}
                    <div className="hidden sm:flex bg-black/40 p-0.5 rounded-xl border border-white/10 mr-2">
                        <button
                            onClick={() => onModeSwitch('signals')}
                            title="Switch to Incoming Signals"
                            className={`p-1.5 rounded-lg transition-all ${systemMode === 'signals'
                                ? 'bg-cyan-950/40 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Radio size={14} />
                        </button>
                        <button
                            onClick={() => onModeSwitch('logs')}
                            title="Switch to Journal Logs"
                            className={`p-1.5 rounded-lg transition-all ${systemMode === 'logs'
                                ? 'bg-violet-950/40 text-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.2)]'
                                : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Book size={14} />
                        </button>
                    </div>

                    <div className="relative group flex-grow lg:w-48 xl:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-white transition-colors" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder={systemMode === 'signals' ? "Scan transmissions..." : "Search logs..."}
                            title={systemMode === 'signals' ? "Filter through signals" : "Search within logs"}
                            className="w-full bg-black/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:border-white/30 outline-none transition-all"
                        />
                    </div>
                    <SubHeaderAction onClick={() => { }} icon={<RefreshCw size={16} />} title="Rescan Hub for updates" className="!p-2 min-w-[36px] sm:min-w-[40px]" />
                    <SubHeaderAction onClick={onCreateNew} variant="primary" icon={<Plus size={16} />} title={systemMode === 'signals' ? "Compose new transmission" : "Create new journal entry"} className="!p-2 min-w-[36px] sm:min-w-[40px]" />
                </div>
            }
        />
    );
};