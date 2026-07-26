import React, { useEffect, useState, useRef } from 'react';
import { Brain, Sparkles, ChevronDown, Activity, Play } from 'lucide-react';
import { fetchAllActiveSimulacrumSessions, fetchAllActiveCageMatchSessions } from '../../services/ai/generators/simulacrumGenerator';
import type { Tag, User, View } from '../../types';

interface ActiveHolodeckSessionsProps {
    user: User;
    tags: Tag[];
    onNavigate: (view: View, data?: any) => void;
}

export const ActiveHolodeckSessions: React.FC<ActiveHolodeckSessionsProps> = ({ user, tags, onNavigate }) => {
    const [simSessions, setSimSessions] = useState<any[]>([]);
    const [advSessions, setAdvSessions] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user?.id) return;
        const loadSessions = async () => {
            try {
                const [sims, advs] = await Promise.all([
                    fetchAllActiveSimulacrumSessions(user.id),
                    fetchAllActiveCageMatchSessions(user.id)
                ]);
                setSimSessions(sims);
                setAdvSessions(advs);
            } catch (e) {
                console.error("Failed to load holodeck sessions:", e);
            }
        };
        loadSessions();
    }, [user?.id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const totalSessions = simSessions.length + advSessions.length;

    if (totalSessions === 0) return null;

    const getTagName = (tagId: string) => {
        const t = tags.find(tag => tag.id === tagId);
        return t ? t.name : 'Unknown Entity';
    };

    return (
        <div className="w-full flex justify-center mb-6 relative z-50">
            <div className="relative" ref={dropdownRef}>
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-900/40 to-cyan-900/40 border border-white/10 backdrop-blur-md shadow-lg shadow-cyan-900/20 hover:border-cyan-500/50 hover:shadow-cyan-500/20 transition-all group"
                >
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                    </div>
                    <span className="text-xs font-black tracking-widest text-cyan-100 uppercase flex items-center gap-2">
                        <Brain size={14} className="text-cyan-400 group-hover:animate-pulse" /> 
                        Active Holodeck Sessions ({totalSessions})
                    </span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[400px] bg-slate-950/95 border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
                        
                        {simSessions.length > 0 && (
                            <div className="p-3">
                                <div className="text-[9px] font-black tracking-[0.2em] text-cyan-500 uppercase px-2 mb-2 flex items-center gap-2">
                                    <Sparkles size={10} /> Simulacrum
                                </div>
                                <div className="space-y-1">
                                    {simSessions.map(session => (
                                        <button
                                            key={session.id}
                                            onClick={() => {
                                                setIsOpen(false);
                                                onNavigate('tagEditor', { tagId: session.tagId, initialTab: 'simulacrum', isAdversarial: false, resumeSessionId: session.id });
                                            }}
                                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-cyan-900/20 border border-transparent hover:border-cyan-500/30 transition-all group/btn text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                                                    <Brain size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white group-hover/btn:text-cyan-300 transition-colors">
                                                        {getTagName(session.tagId)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                        <Activity size={10} /> Last Active: {new Date(session.lastActive).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <Play size={14} className="text-cyan-500 opacity-0 group-hover/btn:opacity-100 transition-opacity -translate-x-2 group-hover/btn:translate-x-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {simSessions.length > 0 && advSessions.length > 0 && (
                            <div className="h-px bg-white/5 mx-4" />
                        )}

                        {advSessions.length > 0 && (
                            <div className="p-3">
                                <div className="text-[9px] font-black tracking-[0.2em] text-red-500 uppercase px-2 mb-2 flex items-center gap-2">
                                    <Brain size={10} /> Adversarial Simulation
                                </div>
                                <div className="space-y-1">
                                    {advSessions.map(session => (
                                        <button
                                            key={session.id}
                                            onClick={() => {
                                                setIsOpen(false);
                                                onNavigate('tagEditor', { tagId: session.tagId, initialTab: 'simulacrum', isAdversarial: true, resumeSessionId: session.id });
                                            }}
                                            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-red-900/20 border border-transparent hover:border-red-500/30 transition-all group/btn text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                                                    <Brain size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-white group-hover/btn:text-red-300 transition-colors">
                                                        {session.name || 'Unknown Combatants'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                        <Activity size={10} /> Last Active: {new Date(session.lastActive).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <Play size={14} className="text-red-500 opacity-0 group-hover/btn:opacity-100 transition-opacity -translate-x-2 group-hover/btn:translate-x-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
};
