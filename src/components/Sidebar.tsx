import React from 'react';
import {
    LayoutDashboard,
    MessageSquare,
    Clock,
    Hash,
    Grid,
    Settings,
    LogOut,
    Sun,
    Moon,
    Database,
    FileText,
    Activity,
    Shield
} from 'lucide-react';
import type { User, View, Theme, UserStatus } from '../types';
import { GlassAvatar } from './GlassAvatar';

interface SidebarProps {
    user: User;
    currentView: View;
    onNavigate: (view: View) => void;
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
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
}

const Sidebar: React.FC<SidebarProps> = ({
    user, currentView, onNavigate, theme, toggleTheme, onLogout,
    notifications, isLocalMode, onOpenSettings, onOpenDevTools, onOpenAirlock
}) => {

    const NavItem = ({ view, icon: Icon, label, count }: { view: View, icon: any, label: string, count?: number }) => {
        const isActive = currentView === view;
        return (
            <button
                onClick={() => onNavigate(view)}
                title={label}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                    ? 'bg-cyan-900/20 text-cyan-400 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)] border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                    }`}
            >
                <Icon size={20} className={isActive ? 'animate-pulse' : ''} />
                <span className="font-medium text-sm tracking-wide">{label}</span>
                {count !== undefined && count > 0 && (
                    <span className="ml-auto bg-cyan-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {count}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className="h-full w-full bg-[#0f1219] flex flex-col border-r border-white/5">
            {/* Header */}
            <div className="p-6 flex items-center gap-3 border-b border-white/5">
                <div className="relative w-8 h-8 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white tracking-widest font-orbitron">GIGI</h1>
                    <p className="text-[10px] text-cyan-500 font-mono tracking-wider">OS v2.0</p>
                </div>
            </div>

            {/* User Profile Snippet */}
            <div className="p-4 mx-4 mt-4 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
                <GlassAvatar
                    imageUrl={user.profilePictureUrl}
                    altText={user.displayName}
                    fallbackChar={user.firstName?.charAt(0) || 'U'}
                    size="w-10 h-10"
                />
                <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user.firstName}</p>
                    <p className="text-[10px] text-slate-400 truncate">{isLocalMode ? 'Local Mode' : 'Cloud Sync'}</p>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2 custom-scrollbar">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-2">Core Modules</p>
                <NavItem view="dashboard" icon={LayoutDashboard} label="Command Center" />
                <NavItem view="interviews" icon={MessageSquare} label="Neural Uplink" />
                <NavItem view="timeVortex" icon={Clock} label="Time Vortex" />

                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mt-6 mb-2">Database</p>
                <NavItem view="tags" icon={Hash} label="Entity Tags" />
                <NavItem view="theMatrix" icon={Grid} label="The Matrix" />
                {/* [ZEN UPDATE] Renamed Journal -> Daydream per User Request */}
                <NavItem view="daydream" icon={FileText} label="Daydream" />
                <NavItem view="archivists" icon={Activity} label="Orbital View" />

                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mt-6 mb-2">System</p>
                <NavItem view="profile" icon={Database} label="Identity Profile" />
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-white/5 space-y-2">
                <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors text-xs font-bold">
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
                <button onClick={onOpenSettings} className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors text-xs font-bold">
                    <Settings size={16} />
                    <span>Settings</span>
                </button>
                <button onClick={onOpenDevTools} className="w-full flex items-center gap-3 px-4 py-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors text-xs font-bold">
                    <Activity size={16} />
                    <span>Dev Tools</span>
                </button>
                <button onClick={onOpenAirlock} className="relative w-full flex items-center gap-3 px-4 py-2 text-cyan-400 hover:text-cyan-300 rounded-lg hover:bg-cyan-900/20 transition-colors text-xs font-bold">
                    <Shield size={16} />
                    <span>Social Airlock</span>
                    {notifications['airlockRequests'] > 0 && (
                        <span className="ml-auto bg-cyan-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {notifications['airlockRequests']}
                        </span>
                    )}
                </button>
                <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-900/20 transition-colors text-xs font-bold mt-2">
                    <LogOut size={16} />
                    <span>Disconnect</span>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;