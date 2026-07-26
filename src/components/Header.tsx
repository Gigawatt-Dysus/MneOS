import React, { useState, useEffect } from 'react';
import type { View, Theme, User, UserStatus, Settings } from '../types';
import { SunIcon, MoonIcon, SettingsIcon } from './icons';
import { aiStateBridge } from '../utils/aiStateBridge';
import { useAIIdentity } from '../hooks/useAIIdentity';
import { GlassAvatar } from './GlassAvatar';
import MneOSLogo from './MneOSLogo';
import { Shield, Activity, Radio, Book, Search, MessageSquare, Signal } from 'lucide-react';
import { isRootUser } from '../utils/rbac';

import ConsoleIcon from '../assets/ConsoleIcon_tr.png';
import TimeVortexIcon from '../assets/TimeVortexIcon_tr.png';
import MatrixIcon from '../assets/MatrixIcon_tr.png';
import TagsIcon from '../assets/TagsIcon_tr.png';
import AIJournalsIcon from '../assets/AIJournalsIcon_tr.png';
import AIChatIcon from '../assets/AIChatIcon_tr.png';
import CommsIcon from '../assets/CommsIcon_tr.png';
import SignalsIcon from '../assets/SignalsIcon_tr.png';
import VertsIcon from '../assets/VertsIcon_tr.png';

interface HeaderProps {
    user: User;
    onNavigate: (view: View) => void;
    currentView: View;
    theme: Theme;
    toggleTheme: () => void;
    onLogout: () => void;
    notifications: Record<string, any>; // [ZEN FIX] Allow complex notification objects
    userStatus: UserStatus;
    onStatusChange: (status: UserStatus) => void;
    isLocalMode: boolean;
    onOpenSettings: () => void;
    onOpenDevTools?: () => void;
    onOpenAirlock: () => void;
    settings: Settings;
}

const SignalPopover: React.FC<{ data: any }> = ({ data }) => {
    if (!data) return null;
    return (
        <div className="absolute top-full mb-2 w-48 bg-[#0f172a]/95 border border-white/10 rounded-xl shadow-2xl p-3 z-[100] animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none">
            <div className="text-[10px] font-black text-cyan-400 tracking-[0.2em] mb-2 border-b border-white/5 pb-1 uppercase italic">Terminal Feed</div>
            <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-300 text-[10px] font-bold">
                        <Radio size={12} className="text-cyan-500" /> SIGNALS
                    </div>
                    <span className="text-white font-mono text-[10px]">{data.signals || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-300 text-[10px] font-bold">
                        <Book size={12} className="text-violet-500" /> LOGS
                    </div>
                    <span className="text-white font-mono text-[10px]">{data.logs || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-300 text-[10px] font-bold">
                        <Search size={12} className="text-blue-500" /> RESEARCH
                    </div>
                    <span className="text-white font-mono text-[10px]">{data.research || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-300 text-[10px] font-bold">
                        <MessageSquare size={12} className="text-emerald-500" /> TRANSCRIPTS
                    </div>
                    <span className="text-white font-mono text-[10px]">{data.transcripts || 0}</span>
                </div>
            </div>
            <div className="mt-3 pt-2 border-t border-white/5 text-[9px] text-slate-500 font-mono italic">
                {">"} SIGNAL LOCK SECURE
            </div>
        </div>
    );
};

const NavItem: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
    notificationCount?: number;
    isSignalDot?: boolean; // [ZEN NEW]
    commsData?: any; // [ZEN NEW]
    hint?: string; // [ZEN NEW]
    }> = ({ label, icon, isActive, onClick, notificationCount = 0, isSignalDot = false, commsData, hint }) => {
        const [isHovered, setIsHovered] = useState(false);
        const activeClasses = 'scale-110 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)] brightness-110';
        const inactiveClasses = 'opacity-60 hover:opacity-100 hover:scale-105 grayscale-[0.3] hover:grayscale-0';
    
        return (
            <li>
                <button
                    onClick={onClick}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className={`relative flex flex-col items-center justify-center w-full px-2 transition-all duration-300 group`}
                    title={hint}
                >
                    <div className="relative inline-block">
                        <div className={`transition-transform duration-300 ${isActive ? activeClasses : inactiveClasses}`}>
                            {icon}
                        </div>
                        {isSignalDot ? (
                            notificationCount > 0 && (
                                <div className="absolute -top-1 -right-1 z-50 pointer-events-none">
                                    <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_#ef4444] animate-pulse border-2 border-[#020617]" />
                                </div>
                            )
                        ) : (
                            notificationCount > 0 && (
                                <div className="absolute -top-2 -right-4 z-50 pointer-events-none">
                                    <span className="flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black text-white bg-red-600 rounded-full shadow-lg border-2 border-[#020617] min-w-[20px] animate-in zoom-in animate-pulse duration-300">
                                        {notificationCount.toLocaleString()}
                                    </span>
                                </div>
                            )
                        )}
                    </div>
                    <span className={`mt-2 text-[11px] uppercase tracking-widest font-black h-4 flex items-center justify-center text-center w-full transition-colors ${isActive ? 'text-cyan-400 text-shadow-glow' : 'text-slate-500 group-hover:text-slate-300'}`}>
                        {label}
                    </span>
    
                    {isSignalDot && isHovered && <SignalPopover data={commsData} />}
                </button>
            </li>
        );
    };
    
    const Header: React.FC<HeaderProps> = ({
        user, onNavigate, currentView, theme, toggleTheme, onLogout, notifications,
        userStatus, onStatusChange, isLocalMode, onOpenSettings, onOpenDevTools, onOpenAirlock,
        settings
    }) => {
        const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
        const [isGlobalAIThinking, setIsGlobalAIThinking] = useState(false);
        useAIIdentity();
    
        useEffect(() => {
            const unsubscribe = aiStateBridge.subscribe(setIsGlobalAIThinking);
            return () => unsubscribe();
        }, []);
    
        const statusConfig: Record<UserStatus, { color: string, label: string }> = {
            online: { color: 'bg-green-500', label: 'Online' },
            away: { color: 'bg-yellow-500', label: 'Away' },
            busy: { color: 'bg-red-500', label: 'Busy' },
        };
    
        const PngIcon = ({ src, alt }: { src: string, alt: string }) => (
            <div className="w-14 h-14 flex items-center justify-center">
                <img src={src} alt={alt} className="w-[50px] h-[50px] object-contain" />
            </div>
        );
    
        return (
            <header className="relative z-50 bg-[#020617]/95 border-b border-white/5 shadow-2xl h-auto md:h-[148px] flex flex-col w-full">
    
                <div className="px-6 py-1.5 flex justify-between items-center text-xs font-bold text-slate-400 font-mono tracking-widest uppercase border-b border-white/5 bg-black/40 shrink-0">
                    <div className="flex gap-6">
                        <span className="flex items-center gap-2">System: <span className="text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">ONLINE</span></span>
                        <span className="flex items-center gap-2">AI Core: <span className={isGlobalAIThinking ? "text-amber-400 animate-pulse" : "text-cyan-500"}>{isGlobalAIThinking ? "PROCESSING..." : "IDLE"}</span></span>
                        <span className="flex items-center gap-2 cursor-help group relative">
                            MIND: <span className="text-fuchsia-400 font-black">G.I.G.I.</span>
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-900 border border-slate-700 text-slate-300 text-[10px] p-2 rounded-lg shadow-xl normal-case font-sans z-50 pointer-events-none">
                                Guided Intelligence Generational Intuition
                            </div>
                        </span>
                    </div>
                    <div className="flex items-center gap-6">
                        {isLocalMode && <span className="text-amber-500 font-black animate-pulse">⚠️ LOCAL MODE</span>}
    
                        <button
                            onClick={onOpenSettings}
                            onContextMenu={(e) => {
                                if (onOpenDevTools && isRootUser(user)) {
                                    e.preventDefault();
                                    onOpenDevTools();
                                }
                            }}
                            className="hover:text-cyan-400 transition-colors flex items-center gap-2 group"
                            title="Settings (Right-click for God Mode)"
                        >
                            <SettingsIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
                            <span className="hidden sm:inline">SETTINGS</span>
                        </button>
    
                        <button onClick={toggleTheme} className="hover:text-white transition-colors" title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
                            {theme === 'light' ? <MoonIcon className="w-4 h-4 inline" /> : <SunIcon className="w-4 h-4 inline" />}
                        </button>
                        <button onClick={onLogout} className="hover:text-white hover:underline transition-colors text-slate-300">LOGOUT</button>
                    </div>
                </div>
    
                <div className="container mx-auto px-4 flex-1 flex flex-col justify-center">
                    <nav className="py-4 pb-6">
                        <div className="max-w-7xl mx-auto flex justify-start items-center gap-6 lg:gap-12">
    
                            {/* LifeOS Logo (Left Justified) */}
                            <div className="hidden lg:flex flex-col items-center justify-center opacity-90 hover:opacity-100 transition-opacity cursor-default shrink-0 w-[160px]">
                                <MneOSLogo variant="full" size={160} />
                            </div>
    
                            {/* Navigation Sequence (All Icons Right of Logo) */}
                            <ul className="flex-1 flex items-center justify-between gap-[clamp(4px,1vw,28px)] min-w-0">
                                <NavItem
                                    label="Composer"
                                    icon={<PngIcon src={ConsoleIcon} alt="Composer" />}
                                    isActive={currentView === 'dashboard'}
                                    onClick={() => onNavigate('dashboard')}
                                    hint="Log a new event or memory"
                                />
                                <NavItem
                                    label="Vortex"
                                    icon={<PngIcon src={TimeVortexIcon} alt="Vortex" />}
                                    isActive={currentView === 'timeVortex'}
                                    onClick={() => onNavigate('timeVortex')}
                                    hint="Your curated timeline of chronological events"
                                />
                                <NavItem
                                    label="Matrix"
                                    icon={<PngIcon src={MatrixIcon} alt="Matrix" />}
                                    isActive={currentView === 'theMatrix'}
                                    onClick={() => onNavigate('theMatrix')}
                                    hint="Your unified multimedia artifact gallery"
                                />
                                <NavItem
                                    label="Tags"
                                    icon={<PngIcon src={TagsIcon} alt="Tags" />}
                                    isActive={currentView === 'tags'}
                                    onClick={() => onNavigate('tags')}
                                    hint="Browse and manage people, places, and things"
                                />
                                <NavItem
                                    label="Daydream"
                                    icon={<PngIcon src={AIJournalsIcon} alt="Daydream" />}
                                    isActive={currentView === 'daydream'}
                                    onClick={() => onNavigate('daydream')}
                                    hint="AI-generated journals and reflections"
                                />
                                <NavItem
                                    label="Chat"
                                    icon={<PngIcon src={AIChatIcon} alt="Chat" />}
                                    isActive={currentView === 'interviews'}
                                    onClick={() => onNavigate('interviews')}
                                    notificationCount={notifications.interviews || 0}
                                    hint="Interactive conversation with GIGI"
                                />
                                <NavItem
                                    label="Comms"
                                    icon={<PngIcon src={CommsIcon} alt="Comms" />}
                                    isActive={currentView === 'commsCenter'}
                                    onClick={() => onNavigate('commsCenter')}
                                    notificationCount={notifications.commsCenter || 0}
                                    isSignalDot={true}
                                    commsData={notifications.comms}
                                    hint="System transmissions and terminal feeds"
                                />
                                <NavItem
                                    label="Signals"
                                    icon={<PngIcon src={SignalsIcon} alt="Signals" />}
                                    isActive={currentView === 'airlock'}
                                    onClick={onOpenAirlock}
                                    notificationCount={notifications.airlockRequests}
                                    hint="Inbound communication and requests"
                                />
                                <NavItem
                                    label="Social"
                                    icon={<PngIcon src={VertsIcon} alt="Social" />}
                                    isActive={currentView === 'archivists'}
                                    onClick={() => onNavigate('archivists')}
                                    hint="Discover and connect with other archivists"
                                />

                            <li className="relative">
                                <button
                                    onClick={() => setIsStatusMenuOpen(prev => !prev)}
                                    className={`relative flex flex-col items-center justify-center w-full px-2 transition-all duration-300 group`}
                                >
                                    <div className="relative inline-block">
                                        <div className={`transition-transform duration-300 ${currentView === 'profile' ? 'scale-110 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'hover:scale-105 opacity-90'}`}>

                                            <GlassAvatar
                                                imageUrl={user.profilePictureUrl}
                                                altText="Profile"
                                                fallbackChar={user.displayName}
                                                size="w-14 h-14"
                                                className="shadow-md"
                                            />

                                            <span className={`absolute bottom-0 right-0 block h-3.5 w-3.5 rounded-full ring-2 ring-[#020617] ${statusConfig[userStatus].color} z-10`}></span>
                                        </div>
                                    </div>
                                    <span className={`mt-2 text-[11px] uppercase tracking-widest font-black ${currentView === 'profile' ? 'text-cyan-400 text-shadow-glow' : 'text-slate-500 group-hover:text-slate-300'}`}>Profile</span>
                                </button>

                                {isStatusMenuOpen && (
                                    <div className="absolute top-full right-0 mt-2 w-56 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                                        <div className="px-4 py-2 border-b border-slate-800 mb-1">
                                            <p className="text-white font-bold truncate">{user.displayName}</p>
                                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                        </div>

                                        <div className="p-2 space-y-1 border-b border-slate-800 mb-2">
                                            <button
                                                onClick={() => { onNavigate('profile'); setIsStatusMenuOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                My Profile
                                            </button>
                                            <button
                                                onClick={() => { onOpenSettings(); setIsStatusMenuOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                System Settings
                                            </button>
                                        </div>

                                        <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Set Status</div>
                                        {(Object.keys(statusConfig) as UserStatus[]).map(status => (
                                            <button key={status} onClick={() => { onStatusChange(status); setIsStatusMenuOpen(false); }} className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800 transition-colors ${userStatus === status ? 'bg-slate-800/50 text-white' : 'text-slate-400'}`}>
                                                <span className={`w-2.5 h-2.5 rounded-full ${statusConfig[status].color}`}></span> {statusConfig[status].label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </li>
                        </ul>
                    </div>
                </nav>
            </div>
        </header>
    );
};

export default Header;
