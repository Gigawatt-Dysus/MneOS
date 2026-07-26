import React, { ReactNode, useRef, useState, useEffect } from 'react';
import Header from '../Header';
import { Sidebar } from './Sidebar';
import { SystemStatusRibbon } from './SystemStatusRibbon';
import { aiStateBridge } from '../../utils/aiStateBridge';
import type { User, View, Theme, UserStatus, Settings } from '../../types';
import { GlassAvatar } from '../GlassAvatar';
import MneOSLogo from '../MneOSLogo';
import { Settings as SettingsIcon, User as UserIcon, LogOut, Shield, Activity, Radio, Book, Search, MessageSquare, X as CloseIcon } from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { SessionsDrawer } from './SessionsDrawer';
import { useChatSessions } from '../../context/ChatSessionContext';
import { EratosPalaceModal } from '../matrix/EratosPalaceModal';

import ConsoleIcon from '../../assets/ConsoleIcon_tr.png';
import TimeVortexIcon from '../../assets/TimeVortexIcon_tr.png';
import MatrixIcon from '../../assets/MatrixIcon_tr.png';
import TagsIcon from '../../assets/TagsIcon_tr.png';
import AIJournalsIcon from '../../assets/AIJournalsIcon_tr.png';
import AIChatIcon from '../../assets/AIChatIcon_tr.png';
import CommsIcon from '../../assets/CommsIcon_tr.png';
import SignalsIcon from '../../assets/SignalsIcon_tr.png';
import VertsIcon from '../../assets/VertsIcon_tr.png';

interface MainLayoutProps {
    user: User;
    currentView: View;
    children: ReactNode;
    onNavigate: (view: View, data?: any) => void;
    theme: Theme;
    toggleTheme: () => void;
    onLogout: () => void;
    notifications: Record<string, number>;
    userStatus: UserStatus;
    onStatusChange: (status: UserStatus) => void;
    isLocalMode: boolean;
    onOpenSettings: () => void;
    onOpenDevTools: () => void;
    onOpenAirlock: () => void;
    settings: Settings;
}

const PngIcon = ({ src, className = "", isMuse = false }: { src: string, className?: string, isMuse?: boolean }) => (
    <div className={`flex items-center justify-center ${className}`}>
        <img
            src={src}
            alt="nav-icon"
            className={isMuse 
                ? "w-[120%] h-[120%] object-cover pointer-events-none select-none transition-all duration-300" 
                : "w-[90%] h-[90%] object-contain pointer-events-none select-none"}
            style={isMuse ? { clipPath: 'circle(38% at 50% 41.5%)' } : {}}
        />
    </div>
);

const MainLayout: React.FC<MainLayoutProps> = ({
    user, currentView, children, onNavigate, theme, toggleTheme, onLogout, notifications,
    userStatus, onStatusChange, isLocalMode, onOpenSettings, onOpenDevTools, onOpenAirlock,
    settings
}) => {
    const [activeCommsPopover, setActiveCommsPopover] = useState(false); // [ZEN NEW]
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isGlobalAIThinking, setIsGlobalAIThinking] = useState(false);
    const [isEratosPalaceOpen, setIsEratosPalaceOpen] = useState(false);
    
    // Check if useChatSessions is available (we might not be inside ChatSessionProvider if not logged in, but MainLayout is conditionally wrapped)
    const chatSessionContext = useChatSessions();
    const { isSessionsDrawerOpen, setIsSessionsDrawerOpen } = chatSessionContext || { isSessionsDrawerOpen: false, setIsSessionsDrawerOpen: () => {} };

    useEffect(() => {
        const unsubscribe = aiStateBridge.subscribe(setIsGlobalAIThinking);
        return () => unsubscribe();
    }, []);

    const isAppView = ['interviews', 'theMatrix', 'commsCenter', 'gigiJournal', 'timeVortex', 'tags', 'staging', 'airlock', 'loom'].includes(currentView);

    const touchStart = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);

    const viewOrder: View[] = [
        'dashboard', 'timeVortex', 'theMatrix', 'tags', 'interviews', 'commsCenter', 'gigiJournal', 'loom'
    ];

    const shouldIgnoreSwipe = (target: EventTarget | null): boolean => {
        if (!(target instanceof Element)) return false;
        const ignoredElement = (target as Element).closest('[data-swipe-ignore]');
        if (ignoredElement) return true;
        const scrollableParent = (target as Element).closest('.overflow-x-auto, .overflow-y-auto, .overflow-auto');
        if (scrollableParent) return true;
        if ((target as Element).matches('input, textarea, select')) return true;
        return false;
    };

    const onTouchStart = (e: React.TouchEvent) => {
        if (shouldIgnoreSwipe(e.target)) {
            touchStart.current = null;
            touchStartY.current = null;
            return;
        }
        touchStart.current = e.targetTouches[0].clientX;
        touchStartY.current = e.targetTouches[0].clientY;
    };

    const onTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart.current || !touchStartY.current) return;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const distanceX = touchStart.current - endX;
        const distanceY = Math.abs(touchStartY.current - endY);
        const minSwipeDistance = 75;

        if (Math.abs(distanceX) > minSwipeDistance && Math.abs(distanceX) > distanceY * 1.5) {
            const currentIndex = viewOrder.indexOf(currentView);
            const safeIndex = currentIndex === -1 ? 0 : currentIndex;
            let nextIndex = 0;
            if (distanceX > 0) {
                nextIndex = safeIndex === viewOrder.length - 1 ? 0 : safeIndex + 1;
            } else {
                nextIndex = safeIndex === 0 ? viewOrder.length - 1 : safeIndex - 1;
            }
            onNavigate(viewOrder[nextIndex]);
        }
        touchStart.current = null;
        touchStartY.current = null;
    };

    const dockItems = [
        { id: 'dashboard', src: '/assets/muses/set1/set1_0.png', isMuse: true, label: 'Composer', isMain: true, hint: "Calliope: Log a new event or memory", isWindow: true },
        { id: 'timeVortex', src: '/assets/muses/set1/set1_1.png', isMuse: true, label: 'Vortex', hint: "Clio: Your curated timeline of chronological events" },
        { id: 'theMatrix', src: '/assets/muses/set1/set1_2.png', isMuse: true, label: 'Matrix', hint: "Mnemosyne: Explore the repository of all recorded knowledge" },
        { id: 'tags', src: '/assets/muses/set1/set1_3.png', isMuse: true, label: 'Tags', hint: "Polyhymnia: Manage and sanitize the global tag ontology" },
        { id: 'daydream', src: '/assets/muses/set1/set1_4.png', isMuse: true, label: 'Daydream', hint: "Urania: AI journals and cosmic reflections" },
        { id: 'interviews', src: '/assets/muses/set1/set1_5.png', isMuse: true, label: 'Chat', hint: "Erato: Interactive AI Chat and companion interface" },
        { id: 'loom', src: '/assets/muses/set1/set1_9.png', isMuse: true, label: 'Loom', hint: "Clotho: Infinite Canvas Generative Studio" },
        { id: 'airlock', src: '/assets/muses/set1/set1_6.png', isMuse: true, label: 'Signals', isAirlock: true, hint: "Terpsichore: Inbound gateway airlock and external signals" },
        { id: 'commsCenter', src: '/assets/muses/set1/set1_7.png', isMuse: true, label: 'Comms', hint: "Melpomene: System transmission logs and tragedy reports" },
        { id: 'archivists', src: '/assets/muses/set1/set1_8.png', isMuse: true, label: 'Social', isSocial: true, hint: "Euterpe: Discover other archivists and harmonious connections" },
    ];

    const mainPaddingClass = "pt-0";

    return (
        <div className="flex flex-col md:flex-row h-[100dvh] bg-transparent text-slate-200 overflow-hidden font-sans selection:bg-cyan-500/30">

            {/* LEGACY SIDEBAR REMOVED - Replaced by WDE Springboard */}

            {/* Global Sessions Drawer */}
            <SessionsDrawer 
                isOpen={isSessionsDrawerOpen} 
                onClose={() => setIsSessionsDrawerOpen(false)} 
            />

            {/* Main Content Area Container */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">

                <div className="md:hidden relative h-20 z-[70] px-4 pt-4 pb-2 bg-[#0f1219] border-b border-white/5 transition-all duration-300 w-full flex-none">
                    <div className="flex items-center justify-between pointer-events-auto h-full">

                        <div
                            className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                            onClick={() => onNavigate('dashboard')}
                        >
                            <div className="relative w-8 h-8 flex items-center justify-center backdrop-blur-md">
                                <MneOSLogo variant="icon" size={32} className="drop-shadow-[0_0_10px_rgba(0,210,255,0.8)]" />
                            </div>
                            <span className="font-bold text-lg text-white tracking-widest font-['Orbitron'] drop-shadow-md ml-1">MneOS</span>
                        </div>

                        <div className="relative">
                            <div className="relative active:scale-90 transition-all focus:outline-none">
                                <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-9 h-9 border-2 border-white/20 shadow-xl" } }} />
                                <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-black ${userStatus === 'online' ? 'bg-emerald-500' : 'bg-slate-500'
                                    } pointer-events-none`} />
                            </div>

                            {isMobileMenuOpen && (
                                <div className="absolute top-full right-0 mt-3 w-64 bg-[#0f1219] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 origin-top-right">
                                    <div className="p-4 border-b border-white/5 bg-white/5">
                                        <h3 className="font-bold text-white truncate leading-none">{user?.displayName || 'User'}</h3>
                                        <p className="text-xs text-slate-400 font-mono truncate mt-1.5">{user?.email || ''}</p>
                                        <div className="mt-2.5 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_lime]"></span>
                                            <span className="text-[10px] font-bold text-emerald-400 tracking-wider font-mono">SYSTEM ONLINE</span>
                                        </div>
                                    </div>

                                    <div className="p-2 space-y-1">
                                        <button
                                            onClick={() => { onNavigate('profile'); setIsMobileMenuOpen(false); }}
                                            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-sm font-medium"
                                        >
                                            <UserIcon size={18} className="text-cyan-400" /> My Profile
                                        </button>

                                        <button
                                            onClick={() => { onOpenSettings(); setIsMobileMenuOpen(false); }}
                                            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors text-sm font-medium"
                                        >
                                            <SettingsIcon size={18} className="text-violet-400" /> System Settings
                                        </button>

                                        <div className="h-px bg-white/5 my-1 mx-2"></div>

                                        <button
                                            onClick={() => { onLogout(); setIsMobileMenuOpen(false); }}
                                            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-900/20 text-slate-300 hover:text-red-400 transition-colors text-sm font-medium"
                                        >
                                            <LogOut size={18} className="text-red-500" /> Disconnect
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isMobileMenuOpen && (
                                <div className="fixed inset-0 z-[-1]" onClick={() => setIsMobileMenuOpen(false)} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Desktop Top Status Ribbon */}
                <SystemStatusRibbon
                    isGlobalAIThinking={isGlobalAIThinking}
                    isLocalMode={isLocalMode}
                />

                <main
                    className={`flex-1 relative w-full bg-transparent ${mainPaddingClass} ${isAppView ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'
                        }`}
                    onTouchStart={onTouchStart}
                    onTouchEnd={onTouchEnd}
                >
                    <div className={`w-full h-full ${isAppView ? 'h-full' : 'min-h-full pb-[100px] md:pb-0'}`}>
                        {children}
                    </div>
                </main>

            {/* Unified Springboard Taskbar (WDE) */}
            <div className="flex-none fixed bottom-0 left-0 right-0 h-20 bg-black/60 backdrop-blur-xl border-t border-cyan-900/50 z-[100] flex items-center justify-center px-4 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
                <div className="flex items-end h-full pb-3 gap-2">
                    {dockItems.map(item => {
                        const isActive = currentView === item.id;
                        const notificationCount = (item as any).isAirlock ? (notifications.airlockRequests || 0) : (notifications[item.id] || 0);

                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    if (item.id === 'commsCenter') {
                                        setActiveCommsPopover(!activeCommsPopover);
                                        return;
                                    }
                                    if ((item as any).isAirlock) {
                                        onOpenAirlock();
                                    } else {
                                        onNavigate(item.id as View);
                                        setActiveCommsPopover(false);
                                    }
                                }}
                                onContextMenu={(e) => {
                                    if (item.id === 'interviews') {
                                        e.preventDefault();
                                        setIsEratosPalaceOpen(true);
                                    }
                                }}
                                className={`group relative flex flex-col items-center justify-end gap-1 px-3 h-full transition-all duration-300 active:scale-95 focus:outline-none ${isActive ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                                title={item.hint}
                            >
                                <div className={`relative transition-all duration-300 flex flex-col items-center justify-center ${isActive ? '-translate-y-2' : 'group-hover:-translate-y-2'}`}>
                                    <PngIcon
                                        src={item.src}
                                        isMuse={(item as any).isMuse}
                                        className={`w-12 h-12 transition-all duration-300 ${isActive ? 'drop-shadow-[0_0_15px_rgba(34,211,238,0.8)] brightness-125' : 'opacity-70 grayscale-[0.3]'}`}
                                    />
                                    {isActive && (
                                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_cyan]" />
                                    )}
                                    {notificationCount > 0 && (
                                        <div className="absolute -top-1 -right-2 z-50">
                                            {item.id === 'commsCenter' ? (
                                                <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_10px_#ef4444] animate-pulse border-2 border-[#0f1219]" />
                                            ) : (
                                                <span className="flex items-center justify-center w-4 h-4 text-[9px] font-black text-white bg-red-600 rounded-full shadow-lg border border-[#0f1219] animate-pulse">
                                                    {notificationCount > 9 ? '9+' : notificationCount}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="absolute left-6 text-cyan-600/50 font-black tracking-[0.3em] text-[10px] uppercase bottom-6 hidden md:block">
                    MneOS Own Self
                </div>
            </div>

            <EratosPalaceModal 
                isOpen={isEratosPalaceOpen} 
                onClose={() => setIsEratosPalaceOpen(false)} 
                userId={user?.id || 'system'} 
            />

            </div> {/* [ZEN] Close Main Content Area Container */}
        </div>
    );
};

export default MainLayout;
