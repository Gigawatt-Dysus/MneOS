import React, { useState, useEffect } from 'react';
import type { View, User, UserStatus } from '../../types';
import { GlassAvatar } from '../GlassAvatar';
import MneOSLogo from '../MneOSLogo';
import { Settings as SettingsIcon, LogOut, Radio, Book, Search, MessageSquare, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isRootUser } from '../../utils/rbac';
import { UserButton } from '@clerk/clerk-react';

import ConsoleIcon from '../../assets/ConsoleIcon_tr.png';
import TimeVortexIcon from '../../assets/TimeVortexIcon_tr.png';
import MatrixIcon from '../../assets/MatrixIcon_tr.png';
import TagsIcon from '../../assets/TagsIcon_tr.png';
import AIJournalsIcon from '../../assets/AIJournalsIcon_tr.png';
import AIChatIcon from '../../assets/AIChatIcon_tr.png';
import CommsIcon from '../../assets/CommsIcon_tr.png';
import SignalsIcon from '../../assets/SignalsIcon_tr.png';
import VertsIcon from '../../assets/VertsIcon_tr.png';

interface SidebarProps {
    user: User;
    currentView: View;
    onNavigate: (view: View) => void;
    notifications: Record<string, any>;
    userStatus: UserStatus;
    onStatusChange: (status: UserStatus) => void;
    onOpenSettings: () => void;
    onOpenDevTools?: () => void;
    onOpenAirlock: () => void;
    onLogout: () => void;
    isGlobalAIThinking: boolean;
}

const PngIcon = ({ src, alt, className = "" }: { src: string, alt: string, className?: string }) => (
    <div className={`w-10 h-10 flex items-center justify-center ${className}`}>
        <img src={src} alt={alt} className="w-[85%] h-[85%] object-contain pointer-events-none select-none" />
    </div>
);

const CommsSignalPopover: React.FC<{ data: any }> = ({ data }) => {
    if (!data) return null;
    return (
        <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 w-48 bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl p-4 z-[100] animate-in fade-in slide-in-from-left-2 duration-200 pointer-events-none">
            <div className="text-[10px] font-black text-cyan-400 tracking-[0.2em] mb-2.5 border-b border-white/5 pb-1.5 uppercase italic">Terminal Feed</div>
            <div className="space-y-2">
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

const SidebarItem: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
    notificationCount?: number;
    isSignalDot?: boolean;
    commsData?: any;
    hint?: string;
}> = ({ label, icon, isActive, onClick, notificationCount = 0, isSignalDot = false, commsData, hint }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="relative group w-full flex justify-center py-1">
            <button
                onClick={onClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 active:scale-95 focus:outline-none"
                title={hint}
            >
                {isActive && (
                    <motion.div 
                        layoutId="sidebarActiveBackground"
                        className="absolute inset-0 bg-cyan-500/10 border border-cyan-500/20 rounded-xl"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                )}
                
                <div className={`relative transition-all duration-300 ${
                    isActive 
                        ? 'scale-105 drop-shadow-[0_0_12px_rgba(6,182,212,0.6)] brightness-110' 
                        : 'opacity-50 group-hover:opacity-100 group-hover:scale-105 grayscale-[0.2] group-hover:grayscale-0'
                }`}>
                    {icon}
                </div>

                {/* Notifications badge */}
                {isSignalDot ? (
                    notificationCount > 0 && (
                        <div className="absolute top-1 right-1 z-50 pointer-events-none">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                        </div>
                    )
                ) : (
                    notificationCount > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 z-50 pointer-events-none">
                            <span className="flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black text-white bg-red-600 rounded-full shadow-lg border border-slate-950 min-w-[18px] animate-pulse">
                                {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                        </div>
                    )
                )}

                {/* Hover Label Tooltip */}
                <div className="absolute left-full ml-4 px-3 py-1.5 rounded-lg bg-slate-950/95 border border-white/5 text-[9px] font-bold text-white uppercase tracking-widest pointer-events-none opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 z-50 shadow-xl whitespace-nowrap">
                    {label}
                </div>
            </button>

            {isSignalDot && isHovered && <CommsSignalPopover data={commsData} />}
        </div>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({
    user, currentView, onNavigate, notifications, userStatus, onStatusChange,
    onOpenSettings, onOpenDevTools, onOpenAirlock, onLogout, isGlobalAIThinking
}) => {
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

    const statusConfig: Record<UserStatus, { color: string, label: string }> = {
        online: { color: 'bg-green-500', label: 'Online' },
        away: { color: 'bg-yellow-500', label: 'Away' },
        busy: { color: 'bg-red-500', label: 'Busy' },
    };

    return (
        <aside className="w-20 bg-slate-950/50 backdrop-blur-2xl border-r border-white/5 flex flex-col items-center justify-between py-6 shrink-0 z-50 relative h-full">
            
            {/* Static logo orb at the top */}
            <div className="relative mb-8 cursor-pointer group" onClick={() => onNavigate('dashboard')}>
                <div className="absolute -inset-2 bg-gradient-to-r from-violet-600 to-cyan-500 rounded-full opacity-10 group-hover:opacity-25 transition-opacity blur-md" />
                <div className="relative transition-transform duration-300 group-hover:scale-105">
                    <MneOSLogo variant="icon" size={42} className="drop-shadow-[0_0_15px_rgba(139,92,246,0.5)]" />
                </div>
            </div>

            {/* Navigation List */}
            <nav className="flex-1 flex flex-col gap-2 w-full items-center justify-start overflow-y-auto no-scrollbar py-2">
                <SidebarItem
                    label="Composer"
                    icon={<PngIcon src={ConsoleIcon} alt="Composer" />}
                    isActive={currentView === 'dashboard'}
                    onClick={() => onNavigate('dashboard')}
                    hint="Log a new event or memory"
                />
                <SidebarItem
                    label="Vortex"
                    icon={<PngIcon src={TimeVortexIcon} alt="Vortex" />}
                    isActive={currentView === 'timeVortex'}
                    onClick={() => onNavigate('timeVortex')}
                    hint="Your chronological timeline"
                />
                <SidebarItem
                    label="Matrix"
                    icon={<PngIcon src={MatrixIcon} alt="Matrix" />}
                    isActive={currentView === 'theMatrix'}
                    onClick={() => onNavigate('theMatrix')}
                    hint="Your unified media gallery"
                />
                <SidebarItem
                    label="Tags"
                    icon={<PngIcon src={TagsIcon} alt="Tags" />}
                    isActive={currentView === 'tags'}
                    onClick={() => onNavigate('tags')}
                    hint="Manage people, places, things"
                />
                <SidebarItem
                    label="Daydream"
                    icon={<PngIcon src={AIJournalsIcon} alt="Daydream" />}
                    isActive={currentView === 'daydream'}
                    onClick={() => onNavigate('daydream')}
                    hint="AI journals and reflections"
                />
                <SidebarItem
                    label="Chat"
                    icon={<PngIcon src={AIChatIcon} alt="Chat" />}
                    isActive={currentView === 'interviews'}
                    onClick={() => onNavigate('interviews')}
                    notificationCount={notifications.interviews || 0}
                    hint="Interactive AI Chat"
                />
                <SidebarItem
                    label="Comms"
                    icon={<PngIcon src={CommsIcon} alt="Comms" />}
                    isActive={currentView === 'commsCenter'}
                    onClick={() => onNavigate('commsCenter')}
                    notificationCount={notifications.commsCenter || 0}
                    isSignalDot={true}
                    commsData={notifications.comms}
                    hint="System transmission logs"
                />
                <SidebarItem
                    label="Staging"
                    icon={<Database size={24} className="text-emerald-500" />}
                    isActive={currentView === 'staging'}
                    onClick={() => onNavigate('staging')}
                    hint="Sovereign Data Staging"
                />
                <SidebarItem
                    label="Signals"
                    icon={<PngIcon src={SignalsIcon} alt="Signals" />}
                    isActive={currentView === 'airlock'}
                    onClick={onOpenAirlock}
                    notificationCount={notifications.airlockRequests}
                    hint="Inbound gateway airlock"
                />
                <SidebarItem
                    label="Social"
                    icon={<PngIcon src={VertsIcon} alt="Social" />}
                    isActive={currentView === 'archivists'}
                    onClick={() => onNavigate('archivists')}
                    hint="Discover other archivists"
                />
            </nav>

            {/* Bottom Actions Stack */}
            <div className="flex flex-col items-center gap-5 w-full mt-auto relative z-50">
                
                {/* Settings button */}
                <button
                    onClick={onOpenSettings}
                    onContextMenu={(e) => {
                        if (onOpenDevTools && user && isRootUser(user)) {
                            e.preventDefault();
                            onOpenDevTools();
                        }
                    }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-all duration-300 group"
                    title="Settings (Right-click for God Mode)"
                >
                    <SettingsIcon size={18} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>

                {/* Profile Selector with Dropdown */}
                <div className="relative">
                    <div className="relative flex items-center justify-center transition-transform hover:scale-105 active:scale-95 focus:outline-none">
                        <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-11 h-11 border-2 border-white/10" } }} />
                        <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-slate-950 ${statusConfig[userStatus].color} z-10 pointer-events-none`}></span>
                    </div>

                    <AnimatePresence>
                        {isStatusMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, x: 20 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95, x: 20 }}
                                className="absolute bottom-0 left-full ml-4 w-56 bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl py-2.5 z-50"
                            >
                                <div className="px-4 py-2 border-b border-white/5 mb-1.5">
                                    <p className="text-white font-bold truncate leading-none mb-1">{user?.displayName || 'User'}</p>
                                    <p className="text-[10px] font-mono text-slate-500 truncate leading-none">{user?.email || ''}</p>
                                </div>

                                <div className="p-1 space-y-0.5 border-b border-white/5 mb-2">
                                    <button
                                        onClick={() => { onNavigate('profile'); setIsStatusMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                    >
                                        My Profile
                                    </button>
                                    <button
                                        onClick={() => { onOpenSettings(); setIsStatusMenuOpen(false); }}
                                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                    >
                                        System Settings
                                    </button>
                                </div>

                                <div className="px-4 py-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest">Set Status</div>
                                {(Object.keys(statusConfig) as UserStatus[]).map(status => (
                                    <button
                                        key={status}
                                        onClick={() => { onStatusChange(status); setIsStatusMenuOpen(false); }}
                                        className={`w-full text-left flex items-center gap-3 px-4 py-2 text-xs hover:bg-white/5 transition-colors ${
                                            userStatus === status ? 'bg-cyan-500/5 text-cyan-400 font-bold' : 'text-slate-400'
                                        }`}
                                    >
                                        <span className={`w-2.5 h-2.5 rounded-full ${statusConfig[status].color}`}></span>
                                        {statusConfig[status].label}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Disconnect button */}
                <button
                    onClick={onLogout}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all duration-300"
                    title="Disconnect Session"
                >
                    <LogOut size={18} />
                </button>
            </div>
        </aside>
    );
};
