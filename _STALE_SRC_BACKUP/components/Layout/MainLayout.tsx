import React, { ReactNode, useRef } from 'react';
import Header from '../Header';
import type { User, View, Theme, UserStatus } from '@/types';
import { GlassAvatar } from '../GlassAvatar';
import GigiLogo from '../GigiLogo';
import { Settings } from 'lucide-react';

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
}

// Helper for your PNG Icons
const PngIcon = ({ src, className = "" }: { src: string, className?: string }) => (
    <img src={src} alt="nav-icon" className={`object-contain pointer-events-none select-none ${className}`} />
);

const MainLayout: React.FC<MainLayoutProps> = ({
    user, currentView, children, onNavigate, theme, toggleTheme, onLogout, notifications,
    userStatus, onStatusChange, isLocalMode, onOpenSettings, onOpenDevTools
}) => {

    // --- VIEW CONFIGURATION ---
    // "App Views" handle their own scrolling (e.g. Chat, Matrix)
    // "Page Views" need the layout to provide scrolling (e.g. Dashboard, Bio)
    const isAppView = ['interviews', 'theMatrix', 'commsCenter', 'gigiJournal', 'timeVortex'].includes(currentView);

    // --- SWIPE LOGIC ---
    const touchStart = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);

    // The Round-Robin Sequence
    const viewOrder: View[] = [
        'dashboard',    // Home
        'timeVortex',
        'theMatrix',
        'tags',
        'interviews',   // Chat
        'commsCenter',
        'gigiJournal'
    ];

    // [ZEN FIX] Smart Context Detection
    const shouldIgnoreSwipe = (target: EventTarget | null): boolean => {
        if (!(target instanceof Element)) return false;

        // Check if the touch started inside an element with data-swipe-ignore
        const ignoredElement = (target as Element).closest('[data-swipe-ignore]');
        if (ignoredElement) return true;

        // Check if touch started inside any scrollable container
        const scrollableParent = (target as Element).closest('.overflow-x-auto, .overflow-y-auto, .overflow-auto');
        if (scrollableParent) return true;

        // Check if inside input/textarea
        if ((target as Element).matches('input, textarea, select')) return true;

        return false;
    };

    const onTouchStart = (e: React.TouchEvent) => {
        // [ZEN FIX] Don't track swipes if touch starts in interactive zones
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
        const minSwipeDistance = 75; // px

        // [ZEN FIX] Only trigger horizontal swipe if it's more horizontal than vertical
        // This prevents accidental navigation when scrolling vertically
        if (Math.abs(distanceX) > minSwipeDistance && Math.abs(distanceX) > distanceY * 1.5) {
            const currentIndex = viewOrder.indexOf(currentView);
            const safeIndex = currentIndex === -1 ? 0 : currentIndex;
            let nextIndex = 0;

            if (distanceX > 0) { // Swipe Left -> Next
                nextIndex = safeIndex === viewOrder.length - 1 ? 0 : safeIndex + 1;
            } else { // Swipe Right -> Prev
                nextIndex = safeIndex === 0 ? viewOrder.length - 1 : safeIndex - 1;
            }
            onNavigate(viewOrder[nextIndex]);
        }

        // Reset
        touchStart.current = null;
        touchStartY.current = null;
    };

    // --- DOCK CONFIG ---
    const dockItems = [
        { id: 'timeVortex', src: '/TimeVortexIcon_tr.png', label: 'Vortex' },
        { id: 'theMatrix', src: '/MatrixIcon_tr.png', label: 'Matrix' },
        { id: 'tags', src: '/TagsIcon_tr.png', label: 'Tags' },
        { id: 'dashboard', src: '/ConsoleIcon_tr.png', label: '', isMain: true },
        { id: 'interviews', src: '/AIChatIcon_tr.png', label: 'Chat' },
        { id: 'commsCenter', src: '/CommsIcon_tr.png', label: 'Comms' },
        { id: 'gigiJournal', src: '/AIJournalsIcon_tr.png', label: 'Reflect' },
    ];

    return (
        <div className="flex flex-col h-[100dvh] bg-transparent text-slate-200 overflow-hidden">

            {/* --- DESKTOP HEADER --- */}
            <div className="hidden md:block flex-none z-50">
                <Header
                    user={user} onNavigate={onNavigate} currentView={currentView} theme={theme}
                    toggleTheme={toggleTheme} onLogout={onLogout} notifications={notifications}
                    userStatus={userStatus} onStatusChange={onStatusChange} isLocalMode={isLocalMode}
                    onOpenSettings={onOpenSettings}
                    onOpenDevTools={onOpenDevTools}
                />
            </div>

            {/* --- MOBILE TOP BAR --- */}
            <div className="md:hidden flex-none z-50 h-16 bg-[#0f1219]/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-4 shadow-lg shadow-black/50">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('dashboard')}>
                    <div className="relative w-8 h-8 flex items-center justify-center">
                        <GigiLogo size={32} className="drop-shadow-[0_0_10px_rgba(0,210,255,0.5)]" />
                    </div>
                    <span className="font-bold text-lg text-white tracking-widest font-['Orbitron']">GIGI</span>
                </div>

                <div className="flex items-center gap-4">
                    <button onClick={onOpenSettings} className="p-2 text-slate-400 hover:text-white transition-colors">
                        <Settings size={28} />
                    </button>
                    <div onClick={() => onNavigate('profile')} className="relative cursor-pointer">
                        <GlassAvatar
                            imageUrl={user.profilePictureUrl}
                            altText={user.displayName}
                            fallbackChar={user.firstName.charAt(0)}
                            size="w-9 h-9"
                            className="border border-white/20 shadow-lg ring-2 ring-transparent active:ring-cyan-500/50 transition-all"
                        />
                        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0f1219] ${userStatus === 'online' ? 'bg-emerald-500' : 'bg-slate-500'
                            }`} />
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT AREA --- */}
            {/* [ZEN FIX] Layout Strategy:
               - On Mobile: We flex-grow to fill the space between Header and Dock.
               - App Views (Chat): overflow-hidden (Component handles scroll).
               - Page Views (Dashboard): overflow-y-auto (Layout handles scroll).
            */}
            <main
                className={`flex-1 relative w-full md:pt-[160px] ${isAppView ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                {/* Content Wrapper:
                   - Mobile: Adds bottom padding (pb-[90px]) so content isn't hidden behind the dock.
                   - Desktop: No extra padding needed.
                */}
                <div className={`w-full h-full ${isAppView ? 'h-full' : 'min-h-full pb-[100px] md:pb-0'}`}>
                    {children}
                </div>
            </main>

            {/* --- MOBILE DOCK --- */}
            <div className="md:hidden flex-none fixed bottom-0 left-0 right-0 h-[85px] z-[60] px-2 pb-safe pointer-events-none">
                {/* [ZEN NOTE] The Dock background is separate to allow the "Arc Reactor" button to break out visually 
                   while keeping the hit area logic clean. 
                */}
                <div className="absolute inset-0 bg-[#0f1219]/95 backdrop-blur-2xl border-t border-white/10 pointer-events-auto" />

                <div className="relative flex justify-between items-end h-full pb-2 pointer-events-auto">
                    {dockItems.map((item) => {
                        const isActive = currentView === item.id;

                        // --- CENTER COMPOSER BUTTON ---
                        if (item.isMain) {
                            return (
                                // [ZEN FIX] Floating Effect: -translate-y-6 lifts it above the dock
                                <div key={item.id} className="relative z-50 mx-1 mb-2 transform -translate-y-6">
                                    <button
                                        onClick={() => onNavigate(item.id as View)}
                                        className="group relative flex items-center justify-center transition-transform active:scale-95"
                                    >
                                        {/* [ZEN FIX] THE AURA: A soft, pulsing cyan blur BEHIND the icon */}
                                        {isActive && (
                                            <div className="absolute inset-0 bg-cyan-400/40 blur-xl rounded-full animate-pulse scale-110 pointer-events-none" />
                                        )}

                                        {/* [ZEN FIX] THE ICON: Large (w-16) with intense drop-shadow when active */}
                                        <PngIcon
                                            src={item.src}
                                            className={`w-16 h-16 transition-all duration-500 ${isActive
                                                    ? 'drop-shadow-[0_0_25px_rgba(6,182,212,0.8)] brightness-125 scale-105'
                                                    : 'opacity-90 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)] grayscale-[0.2]'
                                                }`}
                                        />
                                    </button>
                                </div>
                            );
                        }

                        // --- STANDARD ITEMS ---
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id as View)}
                                className={`flex flex-col items-center justify-end gap-1 pb-2 flex-1 h-full transition-all duration-200 active:scale-95 ${isActive ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                <div className={`relative transition-all duration-300 ${isActive ? '-translate-y-1' : ''}`}>
                                    <PngIcon
                                        src={item.src}
                                        // [ZEN FIX] Increased size to w-10 h-10 (approx 30% larger from w-8)
                                        className={`w-10 h-10 ${isActive ? 'drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] brightness-125' : 'opacity-60 grayscale-[0.3]'}`}
                                    />
                                    {isActive && (
                                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_5px_cyan]" />
                                    )}
                                </div>
                                <span className={`text-[9px] font-medium tracking-wide transition-opacity duration-200 ${isActive ? 'opacity-100 text-cyan-200' : 'opacity-50'}`}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

        </div>
    );
};

export default MainLayout;