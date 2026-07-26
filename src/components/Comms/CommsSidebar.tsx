import React from 'react';
import { Inbox, Send, Shield, Book, FileText, MessageSquare, Filter, X, Radio, Share2 } from 'lucide-react';
import GigiLogo from '../GigiLogo';

interface CommsSidebarProps {
    systemMode: 'signals' | 'logs';
    activeChannel: string;
    onChannelSelect: (id: string) => void;
    onModeSwitch: (mode: 'signals' | 'logs') => void;
    isMobileOpen: boolean;
    onCloseMobile: () => void;
    counts: {
        inbox: number;
        sent: number;
        encrypted: number;
        all_logs: number;
        reflections: number;
        research: number;
        transcripts: number;
        requests: number;
    };
}

const SidebarItem = ({ id, icon: Icon, label, count, activeChannel, onSelect, colorClass = "text-slate-500" }: any) => (
    <button
        onClick={() => onSelect(id)}
        title={`Switch to ${label}`}
        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 group ${activeChannel === id
                ? 'bg-white/10 border border-white/20 text-white shadow-lg'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
            }`}
    >
        <div className="flex items-center gap-3">
            <Icon size={16} className={activeChannel === id ? 'text-white' : colorClass} />
            <span className="text-xs font-bold tracking-widest uppercase">{label}</span>
        </div>
        {count !== undefined && (
            <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full border border-white/10 font-mono">
                {count}
            </span>
        )}
    </button>
);

export const CommsSidebar: React.FC<CommsSidebarProps> = ({
    systemMode, activeChannel, onChannelSelect, onModeSwitch, isMobileOpen, onCloseMobile, counts
}) => {

    const handleSelect = (id: string) => {
        onChannelSelect(id);
        if (window.innerWidth < 768) onCloseMobile();
    };

    return (
        <>
            {isMobileOpen && (
                <div className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm" onClick={onCloseMobile} />
            )}

            <div className={`
                fixed inset-y-0 left-0 w-72 z-40 bg-[#0f1219] border-r border-white/10 shadow-2xl flex flex-col
                transform transition-transform duration-300 ease-in-out
                md:relative md:transform-none md:w-auto md:bg-black/20 md:backdrop-blur-md md:rounded-2xl md:border md:shadow-none md:z-auto md:col-span-2 md:flex
                ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>

                <div className="p-4 md:hidden border-b border-white/5 space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <GigiLogo size={24} />
                            <span className="text-sm font-bold text-white uppercase tracking-widest">Menu</span>
                        </div>
                        <button onClick={onCloseMobile} className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-white"><X size={18} /></button>
                    </div>

                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                        <button
                            onClick={() => onModeSwitch('signals')}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${systemMode === 'signals'
                                    ? 'bg-cyan-900/50 text-cyan-100 border border-cyan-500/30'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Radio size={14} /> Signals
                        </button>
                        <button
                            onClick={() => onModeSwitch('logs')}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${systemMode === 'logs'
                                    ? 'bg-violet-900/50 text-violet-100 border border-violet-500/30'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <Book size={14} /> Logs
                        </button>
                    </div>
                </div>

                <div className="flex-1 p-3 overflow-y-auto">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-2">
                        {systemMode === 'signals' ? 'Channels' : 'Database'}
                    </div>

                    {systemMode === 'signals' ? (
                        <>
                            <SidebarItem id="inbox" icon={Inbox} label="Incoming" count={counts.inbox} activeChannel={activeChannel} onSelect={handleSelect} colorClass="text-cyan-500" />
                            <SidebarItem id="sent" icon={Send} label="Outbound" count={counts.sent} activeChannel={activeChannel} onSelect={handleSelect} />
                            <SidebarItem id="requests" icon={Share2} label="Vertex Requests" count={counts.requests} activeChannel={activeChannel} onSelect={handleSelect} colorClass="text-amber-400" />
                            <SidebarItem id="encrypted" icon={Shield} label="Encrypted" count={counts.encrypted} activeChannel={activeChannel} onSelect={handleSelect} />

                            {/* [ZEN FIX] Removed the dangerous "Purge" button */}
                        </>
                    ) : (
                        <>
                            <SidebarItem id="all_logs" icon={Book} label="All Entries" count={counts.all_logs} activeChannel={activeChannel} onSelect={handleSelect} colorClass="text-violet-500" />
                            <SidebarItem id="reflections" icon={FileText} label="Letters" count={counts.reflections} activeChannel={activeChannel} onSelect={handleSelect} />
                            <SidebarItem id="research" icon={Filter} label="Research" count={counts.research} activeChannel={activeChannel} onSelect={handleSelect} />
                            <SidebarItem id="transcripts" icon={MessageSquare} label="Message Logs" count={counts.transcripts} activeChannel={activeChannel} onSelect={handleSelect} />
                        </>
                    )}
                </div>
            </div>
        </>
    );
};