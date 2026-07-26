import React, { useState, useEffect } from 'react';
import type { View, Theme, User, UserStatus } from '@/types';
import { SunIcon, MoonIcon, SettingsIcon } from './icons';
import { aiStateBridge } from '../utils/aiStateBridge';
import { useAIIdentity } from '../hooks/useAIIdentity';
import { GlassAvatar } from './GlassAvatar'; // [ZEN FIX] Import GlassAvatar

interface HeaderProps {
    user: User;
    onNavigate: (view: View) => void;
    currentView: View;
    theme: Theme;
    toggleTheme: () => void;
    onLogout: () => void;
    notifications: Record<string, number>;
    userStatus: UserStatus;
    onStatusChange: (status: UserStatus) => void;
    isLocalMode: boolean;
    onOpenSettings: () => void;
    onOpenDevTools?: () => void;
}

const NavItem: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
    notificationCount?: number;
}> = ({ label, icon, isActive, onClick, notificationCount = 0 }) => {
    const activeClasses = 'scale-110 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)] brightness-110';
    const inactiveClasses = 'opacity-60 hover:opacity-100 hover:scale-105 grayscale-[0.3] hover:grayscale-0';

    return (
        <li>
            <button
                onClick={onClick}
                className={`relative flex flex-col items-center justify-center w-full px-2 transition-all duration-300 group`}
            >
                <div className="relative inline-block">
                    <div className={`transition-transform duration-300 ${isActive ? activeClasses : inactiveClasses}`}>
                        {icon}
                    </div>
                    {notificationCount > 0 && (
                        <div className="absolute -top-2 -right-4 z-50 pointer-events-none">
                            <span className="flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black text-white bg-red-600 rounded-full shadow-lg border-2 border-[#020617] min-w-[20px] animate-in zoom-in duration-300">
                                {notificationCount.toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>
                <span className={`mt-2 text-[11px] uppercase tracking-widest font-black ${isActive ? 'text-cyan-400 text-shadow-glow' : 'text-slate-500 group-hover:text-slate-300'}`}>
                    {label}
                </span>
            </button>
        </li>
    );
};

const Header: React.FC<HeaderProps> = ({
    user, onNavigate, currentView, theme, toggleTheme, onLogout, notifications,
    userStatus, onStatusChange, isLocalMode, onOpenSettings, onOpenDevTools
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
        <img src={src} alt={alt} className="w-14 h-14 object-contain" />
    );

    return (
        <header className="fixed top-0 left-0 right-0 z-[100] bg-black/20 backdrop-blur-xl border-b border-white/5 shadow-2xl">

            {/* Utility Bar */}
            <div className="px-6 py-2 flex justify-between items-center text-xs font-bold text-slate-400 font-mono tracking-widest uppercase border-b border-white/5 bg-black/40">
                <div className="flex gap-6">
                    <span className="flex items-center gap-2">System: <span className="text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">ONLINE</span></span>
                    <span className="flex items-center gap-2">AI Core: <span className={isGlobalAIThinking ? "text-amber-400 animate-pulse" : "text-cyan-500"}>{isGlobalAIThinking ? "PROCESSING..." : "IDLE"}</span></span>
                </div>
                <div className="flex items-center gap-6">
                    {isLocalMode && <span className="text-amber-500 font-black animate-pulse">⚠️ LOCAL MODE</span>}

                    <button
                        onClick={onOpenSettings}
                        onContextMenu={(e) => {
                            if (onOpenDevTools) {
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

            <div className="container mx-auto px-4">
                <nav className="py-3">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">

                        {/* Left Cluster */}
                        <ul className="flex items-center gap-4 lg:gap-8">
                            <NavItem
                                label="Composer"
                                icon={<PngIcon src="/ConsoleIcon_tr.png" alt="Composer" />}
                                isActive={currentView === 'dashboard'}
                                onClick={() => onNavigate('dashboard')}
                            />
                            <NavItem
                                label="Time Vortex"
                                icon={<PngIcon src="/TimeVortexIcon_tr.png" alt="Vortex" />}
                                isActive={currentView === 'timeVortex'}
                                onClick={() => onNavigate('timeVortex')}
                            />
                            <NavItem
                                label="Matrix Gallery"
                                icon={<PngIcon src="/MatrixIcon_tr.png" alt="Matrix" />}
                                isActive={currentView === 'theMatrix'}
                                onClick={() => onNavigate('theMatrix')}
                            />
                            <NavItem
                                label="Tags"
                                icon={<PngIcon src="/TagsIcon_tr.png" alt="Tags" />}
                                isActive={currentView === 'tags'}
                                onClick={() => onNavigate('tags')}
                            />
                        </ul>

                        {/* CENTER: LOGO */}
                        <div className="hidden xl:flex flex-col items-center justify-center mx-8 opacity-90 hover:opacity-100 transition-opacity cursor-default">
                            <svg width="180" height="60" viewBox="0 0 400 100">
                                <defs>
                                    <filter id="header-text-glow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feGaussianBlur stdDeviation="4" result="blur" />
                                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                    </filter>
                                </defs>
                                <text x="200" y="80" textAnchor="middle" fill="#ffffff" fontFamily="Impact, sans-serif" fontSize="100" letterSpacing="4" filter="url(#header-text-glow)">G.I.G.I.</text>
                            </svg>
                            <div className="h-0.5 w-full bg-cyan-500 shadow-[0_0_15px_#06b6d4] mt-[-10px]"></div>
                        </div>

                        {/* Right Cluster */}
                        <ul className="flex items-center gap-4 lg:gap-8">
                            <NavItem
                                label="AI Chat"
                                icon={<PngIcon src="/AIChatIcon_tr.png" alt="Chat" />}
                                isActive={currentView === 'interviews'}
                                onClick={() => onNavigate('interviews')}
                            />
                            <NavItem
                                label="Comlink"
                                icon={<PngIcon src="/CommsIcon_tr.png" alt="Comlink" />}
                                isActive={currentView === 'commsCenter'}
                                onClick={() => onNavigate('commsCenter')}
                                notificationCount={notifications.commsCenter}
                            />
                            <NavItem
                                label="Reflections"
                                icon={<PngIcon src="/AIJournalsIcon_tr.png" alt="Reflections" />}
                                isActive={currentView === 'gigiJournal'}
                                onClick={() => onNavigate('gigiJournal')}
                                notificationCount={notifications.gigiJournal}
                            />

                            <li className="relative">
                                <button
                                    onClick={() => setIsStatusMenuOpen(prev => !prev)}
                                    className={`relative flex flex-col items-center justify-center w-full px-2 transition-all duration-300 group`}
                                >
                                    <div className="relative inline-block">
                                        <div className={`transition-transform duration-300 ${currentView === 'profile' ? 'scale-110 drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]' : 'hover:scale-105 opacity-90'}`}>

                                            {/* [ZEN FIX] Replaced PngIcon with GlassAvatar for User Profile */}
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

                                        <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Set Status</div>
                                        {(Object.keys(statusConfig) as UserStatus[]).map(status => (
                                            <button key={status} onClick={() => { onStatusChange(status); setIsStatusMenuOpen(false); }} className={`w-full text-left flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800 transition-colors ${userStatus === status ? 'bg-slate-800/50 text-white' : 'text-slate-400'}`}>
                                                <span className={`w-2.5 h-2.5 rounded-full ${statusConfig[status].color}`}></span> {statusConfig[status].label}
                                            </button>
                                        ))}

                                        <div className="h-px bg-white/5 my-1"></div>
                                        <button
                                            onClick={() => { onNavigate('profile'); setIsStatusMenuOpen(false); }}
                                            className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-violet-400 hover:bg-violet-500/10 hover:text-violet-300 transition-all font-bold group"
                                        >
                                            <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                            </div>
                                            Manage Profile
                                        </button>
                                        <button
                                            onClick={() => { onOpenSettings(); setIsStatusMenuOpen(false); }}
                                            className="w-full text-left flex items-center gap-3 px-4 py-3 text-sm text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all font-bold group"
                                        >
                                            <SettingsIcon className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" /> Interface Settings
                                        </button>
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