import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, PenTool, X, RotateCcw, Volume2, ChevronRight } from 'lucide-react';
import type { AiCompanion, ChatMessage } from '../../types';
import { GhostwriterModal } from './GhostwriterModal';

interface NeuralAgentsSidebarProps {
    agents: AiCompanion[];
    onAgentSelect: (agent: AiCompanion) => void;
    onInjectMessage: (msg: ChatMessage) => Promise<boolean>;
    onCompanionUpdate?: (companion: AiCompanion) => Promise<void>;
    deletedMessagesBuffer?: (ChatMessage & { originalIndex: number })[];
    onRestore?: () => Promise<void>;
    userId: string;
    userPresets?: any[];
    onToggleSessions?: () => void;
    isSessionsOpen?: boolean;
}

export const NeuralAgentsSidebar: React.FC<NeuralAgentsSidebarProps> = ({ 
    agents, onAgentSelect, onInjectMessage, onCompanionUpdate,
    deletedMessagesBuffer, onRestore, userId, userPresets,
    onToggleSessions, isSessionsOpen
}) => {
    const [contextMenu, setContextMenu] = useState<{ agent: AiCompanion, x: number, y: number } | null>(null);
    const [showGhostwriter, setShowGhostwriter] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<AiCompanion | null>(null);

    const handleContextMenu = (e: React.MouseEvent, agent: AiCompanion) => {
        e.preventDefault();
        setContextMenu({ agent, x: e.clientX, y: e.clientY });
    };

    const handleSwitchVoice = async (agent: AiCompanion, voiceId: string) => {
        if (!onCompanionUpdate) return;
        const updated = { ...agent, voiceId };
        await onCompanionUpdate(updated);
        setContextMenu(null);
    };

    // Close menu on click elsewhere
    useEffect(() => {
        const close = () => setContextMenu(null);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, []);

    return (
        <div className="h-full flex flex-col bg-[#0a0a0b]/80 backdrop-blur-3xl border-r border-white/5 w-[80px] items-center py-6 gap-6 z-[100]">

            <div className="mb-4 group cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20 group-hover:border-violet-500/50 transition-all shadow-[0_0_20px_rgba(139,92,246,0.1)]">
                    <Bot className="text-violet-400" size={20} />
                </div>
            </div>

            {onToggleSessions && (
                <div className="relative mb-2 group cursor-pointer" onClick={onToggleSessions}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${isSessionsOpen ? 'bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isSessionsOpen ? "text-cyan-400" : "text-slate-400"}>
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                </div>
            )}


            {agents.map((agent) => (
                <div key={agent.id} className="relative">
                    <button
                        onClick={() => onAgentSelect(agent)}
                        onContextMenu={(e) => handleContextMenu(e, agent)}
                        className={`w-14 h-14 rounded-full overflow-hidden transition-all duration-500 border-2 relative group ${
                            selectedAgent?.id === agent.id
                                ? 'border-violet-500 shadow-[0_0_30px_rgba(139,92,246,0.4)] scale-105'
                                : 'border-white/5 hover:border-white/20 grayscale hover:grayscale-0'
                        }`}
                        title={`${agent.name} (Right-click for options)`}
                    >
                        <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 rounded-full" />
                        
                        {/* Thinking Indicator Overlay */}
                        {selectedAgent?.id === agent.id && (
                           <div className="absolute inset-0 bg-violet-500/10 pointer-events-none" />
                        )}
                    </button>
                </div>
            ))}

            {/* Context Menu Portal */}
            {contextMenu && createPortal(
                <div 
                    className="fixed z-[10000] bg-[#12141c]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 min-w-[220px] animate-in fade-in zoom-in-95 duration-200"
                    style={{ left: contextMenu.x + 10, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-3 py-2 border-b border-white/5 mb-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Link</p>
                        <p className="text-xs font-bold text-white">{contextMenu.agent.name}</p>
                    </div>

                    <button
                        onClick={() => { onAgentSelect(contextMenu.agent); setContextMenu(null); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                    >
                        <Bot size={14} className="text-cyan-400" />
                        <span>Establish Uplink</span>
                    </button>

                    <button
                        onClick={() => { setSelectedAgent(contextMenu.agent); setShowGhostwriter(true); setContextMenu(null); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs text-violet-300 hover:text-violet-100 hover:bg-violet-500/20 rounded-xl transition-all"
                    >
                        <PenTool size={14} />
                        <span>Manual Narrative Input</span>
                    </button>

                    {/* Vocal Swapper Section */}
                    {contextMenu.agent.voiceProfiles && contextMenu.agent.voiceProfiles.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/5">
                            <p className="px-3 text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <Volume2 size={10} /> Vocal Identity
                            </p>
                            <div className="max-h-40 overflow-y-auto custom-scrollbar-thin">
                                {contextMenu.agent.voiceProfiles.map(profile => (
                                    <button
                                        key={profile.id}
                                        onClick={() => handleSwitchVoice(contextMenu.agent, profile.id)}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-[11px] rounded-lg transition-all ${
                                            contextMenu.agent.voiceId === profile.id 
                                                ? 'bg-cyan-500/10 text-cyan-400 font-bold' 
                                                : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex flex-col items-start text-left">
                                            <span>{profile.name}</span>
                                            <span className="text-[8px] opacity-50 font-normal">{profile.shortDesc}</span>
                                        </div>
                                        {contextMenu.agent.voiceId === profile.id && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setContextMenu(null)}
                        className="w-full mt-2 flex items-center justify-center p-2 text-slate-500 hover:text-white transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>,
                document.body
            )}

            {/* [ZEN V27] CHRONOS BUFFER (Undo) */}
            {deletedMessagesBuffer && deletedMessagesBuffer.length > 0 && onRestore && (
                <div className="mt-auto mb-4">
                    <button
                        onClick={() => onRestore()}
                        className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 flex items-center justify-center transition-all hover:scale-110 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] relative group"
                        title="Neural Vortex: Restore last signal"
                    >
                        <RotateCcw size={18} className="group-active:-rotate-180 transition-transform duration-500" />
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-lg">
                            {deletedMessagesBuffer.length}
                        </span>
                    </button>
                </div>
            )}

            {/* Ghostwriter Modal */}
            {showGhostwriter && selectedAgent && (
                <GhostwriterModal
                    agent={selectedAgent}
                    onClose={() => setShowGhostwriter(false)}
                    onSave={onInjectMessage}
                    userId={userId}
                    userPresets={userPresets}
                />
            )}
        </div>
    );
};