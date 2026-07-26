import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, X, MessageSquare, Cpu, MoreVertical, Sparkles, RefreshCw, BookOpen, AlertTriangle, ShieldCheck, Volume2, VolumeX, Lightbulb, Zap, Shield, Globe, ChevronDown, Pin, PinOff, Download } from 'lucide-react';
import { SubHeader } from '../SubHeader';
import { GlassAvatar } from '../GlassAvatar';
import { AVAILABLE_MODELS } from '../../services/ai/config';
import { User, AiCompanion, View, SettingsTab } from '../../types';
import { isRootUser } from '../../utils/rbac'; // [ZEN V32]

interface ChatHeaderProps {
    user: User;
    chatMode: 'ai' | 'peer';
    setChatMode: (mode: 'ai' | 'peer') => void;
    selectedPeerSessionId: string | null;
    setSelectedPeerSessionId: (id: string | null) => void;
    onNavigate: (view: View, data?: any) => void;
    setIsSidebarOpen: (isOpen: boolean) => void;
    isThinking: boolean;
    activeVert: any;
    setShowSparkStudio: (show: boolean) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    isSearchingGlobal: boolean;
    selectedModelId: string;
    thinkingAgentId: string | null;
    hasFireworksKey: boolean;
    messageCount: number;
    executiveDirective: string;
    enrichmentStatus?: 'idle' | 'active' | 'error'; // [ZEN NEW]
    // [ZEN ED #114] handleReconcileContext and integrityStats REMOVED
    // [ZEN EWO #27]
    contextMode?: string; // Relaxed to avoid union errors
    setContextMode?: (mode: any) => void;
    // [ZEN V14] Bulk Actions
    isBulkMode?: boolean;
    toggleBulkMode?: () => void;
    isCrisisMode?: boolean; // [ZEN]
    unreadMailCount?: number; // [ZEN]
    isVoiceEnabled: boolean; // [ZEN]
    setIsVoiceEnabled: (enabled: boolean) => void;
    onShowVocalHelp?: () => void; // [ZEN V35]
    onOpenSettings?: (tab?: SettingsTab) => void;
    isArchPinned: boolean;
    setIsArchPinned: (pinned: boolean) => void;
    onExportChat?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = (props) => {
    const {
        user, chatMode, setChatMode, selectedPeerSessionId, setSelectedPeerSessionId,
        onNavigate, setIsSidebarOpen, isThinking, activeVert,
        setShowSparkStudio, searchQuery, setSearchQuery, isSearchingGlobal,
        selectedModelId, thinkingAgentId, hasFireworksKey, enrichmentStatus,
        messageCount, // [ZEN ED #114] Only Firestore count remains
        contextMode, setContextMode, // [ZEN EWO #27]
        isBulkMode, toggleBulkMode, // [ZEN V14]
        isCrisisMode, unreadMailCount, // [ZEN]
        isVoiceEnabled, setIsVoiceEnabled,
        onShowVocalHelp,
        onOpenSettings,
        isArchPinned, setIsArchPinned,
        onExportChat
    } = props;

    const [isReconciling, setIsReconciling] = useState(false);
    const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);

    const activeCompanion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];

    // [ZEN EWO #102] MASTER ALARM LOGIC
    // [ZEN ED #114] Simplified: Only triggers on ghost state now
    const hasPhaseError = contextMode === 'corrupted'; // Changed from 'mixed' to a real error state

    // [ZEN EWO #102] ERROR KLAXON
    useEffect(() => {
        if (hasPhaseError) {
            console.error("🚨 MASTER ALARM: SYSTEM OUT OF PHASE! contextMode is 'mixed'.");
        }
    }, [hasPhaseError]);

    return (
        <SubHeader
            left={
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (chatMode === 'peer' && selectedPeerSessionId) {
                                setSelectedPeerSessionId(null);
                            } else {
                                onNavigate('dashboard');
                            }
                        }}
                        className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>

                    <div 
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => onOpenSettings?.('companions')}
                    >
                        <div className="flex -space-x-3 py-1">
                            {user.aiCompanions.slice(0, 3).map((companion: AiCompanion, idx: number) => (
                                <GlassAvatar
                                    key={companion.id || idx}
                                    imageUrl={companion.avatarUrl}
                                    fallbackChar={companion.name[0]}
                                    size="w-7 h-7"
                                    className={`border border-white/10 shadow-lg ${idx === 0 ? 'z-30' : idx === 1 ? 'z-20' : 'z-10'}`}
                                />
                            ))}
                        </div>
                        <div className="flex flex-col">
                            <h2 className={`text-[10px] font-bold tracking-widest leading-none uppercase ${isCrisisMode ? 'text-red-500 animate-pulse' : 'text-gray-100'}`}>
                                {isCrisisMode ? 'Neural Blackout' : (chatMode === 'ai' ? 'Neural Uplink' : 'Peer Bridge')}
                            </h2>
                            <p className={`text-[9px] font-mono tracking-wider animate-pulse leading-none mt-1 ${isCrisisMode ? 'text-red-400' : 'text-cyan-500'}`}>
                                {isCrisisMode ? "G.I.G.I. LOCAL HANDOFF" : (isThinking ? "TRANSMITTING..." : (chatMode === 'ai' ? "ACTIVE STREAM" : `LINKED: ${activeVert?.displayName || '...'}`))}
                            </p>
                        </div>
                    </div>
                </div>
            }
            right={
                <div className="flex flex-col md:flex-row items-end md:items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">

                        {/* [ZEN NEW] Librarian Status Indicator */}
                        {chatMode === 'ai' && enrichmentStatus && enrichmentStatus !== 'idle' && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 rounded-full border border-white/5 animate-in fade-in duration-300"
                                title={enrichmentStatus === 'active' ? "Librarian is analyzing..." : "Librarian is rate-limited (429). Will retry later."}
                            >
                                {enrichmentStatus === 'active' ? (
                                    <>
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider hidden md:block">Enriching</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-none" />
                                        <AlertTriangle size={10} className="text-amber-500" />
                                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider hidden md:block">Resting</span>
                                    </>
                                )}
                            </div>
                        )}

                        {/* [ZEN NEW] Spark Studio Launcher */}

                        {/* [ZEN EWO #27] Context Mode Toggle (Neural Uplink Only) */}
                        {chatMode === 'ai' && contextMode && setContextMode && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-black/40 rounded-full border border-white/5 mr-2">
                                <button
                                    onClick={() => setContextMode('grounded')}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${contextMode === 'grounded' ? 'bg-[#00FF41] shadow-[0_0_10px_#00FF41] scale-125' : 'bg-[#00FF41]/20 hover:bg-[#00FF41]/60'}`}
                                    title="Grounded Mode (Fact-Checker)"
                                />
                                <button
                                    onClick={() => setContextMode?.('creative')}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${contextMode === 'creative' ? 'bg-[#BC13FE] shadow-[0_0_10px_#BC13FE] scale-125' : 'bg-[#BC13FE]/20 hover:bg-[#BC13FE]/60'}`}
                                    title="Creative Mode (Brita Persona)"
                                />
                            </div>
                        )}

                        {/* [ZEN V42] Cognitive Mood Indicator */}
                        {chatMode === 'ai' && activeCompanion && (
                            <div className="relative group">
                                <div 
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 rounded-full border border-pink-500/20 hover:border-pink-500/40 text-pink-400 cursor-pointer transition-all duration-300 shadow-[0_0_10px_rgba(236,72,153,0.05)] hover:shadow-[0_0_15px_rgba(236,72,153,0.15)] mr-2"
                                >
                                    <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse shadow-[0_0_8px_#ec4899]" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Cognitive Mood</span>
                                </div>
                                
                                <div className="absolute right-0 top-full mt-2 w-80 p-4 bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.85)] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 transform scale-95 origin-top-right group-hover:scale-100 z-[250]">
                                    <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-2">
                                        <Cpu size={14} className="text-pink-400" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">Active Distilled Self-Concept</span>
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-mono whitespace-pre-line">
                                        {activeCompanion.selfConceptSnapshot || "No active self-concept snapshot compiled yet. Have her write in her diary to synthesize."}
                                    </p>
                                    {user.sovereignMemex?.neuralTemperature !== undefined && (
                                        <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                                            <span>Neural Temp</span>
                                            <span className={user.sovereignMemex.neuralTemperature > 70 ? "text-red-400 font-mono" : "text-cyan-400 font-mono"}>
                                                {user.sovereignMemex.neuralTemperature}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* [ZEN] Vocal Sovereignty Toggle */}
                        {chatMode === 'ai' && (
                            <button
                                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                                className={`flex items-center justify-center p-1.5 rounded-full border transition-all duration-300 ${isVoiceEnabled 
                                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                                    : 'bg-black/40 border-white/5 text-slate-500 hover:text-white'}`}
                                title={isVoiceEnabled ? "Neural Voice Enabled" : "Neural Voice Muted"}
                            >
                                {isVoiceEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
                            </button>
                        )}

                        {/* [ZEN V35] Neural Manual Toggle */}
                        {chatMode === 'ai' && (
                            <button
                                onClick={() => onShowVocalHelp?.()}
                                className="flex items-center justify-center p-1.5 rounded-full border border-white/5 bg-black/40 text-slate-500 hover:text-yellow-400 transition-all duration-300"
                                title="Neural Intelligence: Sovereign Syntax Guide"
                            >
                                <Lightbulb size={12} />
                            </button>
                        )}

                        {/* [ZEN] Neural Postbox Alert */}
                        {unreadMailCount && unreadMailCount > 0 ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600/20 border border-fuchsia-500/30 rounded-full animate-in zoom-in-95 duration-500" title={`Eric, you left ${unreadMailCount} messages for Brita during the blackout.`}>
                                <BookOpen size={10} className="text-fuchsia-400" />
                                <span className="text-[9px] font-black text-fuchsia-400 uppercase tracking-widest">{unreadMailCount} Postbox</span>
                            </div>
                        ) : null}

                        {/* [ZEN ED #114] SIMPLIFIED HUD: Sovereign MongoDB Atlas Count */}
                        {isRootUser(user) && (
                            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full border border-white/5 font-mono text-[9px] font-bold tracking-tight text-slate-400" title="Total Messages (Sovereign MongoDB Atlas)">
                                <span className="flex items-center gap-1">
                                    <span className="text-slate-600">DB</span>
                                    <span className="text-emerald-500">
                                        {messageCount}
                                    </span>
                                </span>
                            </div>
                        )}

                        <button 
                            onClick={() => setIsArchPinned(!isArchPinned)}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${isArchPinned 
                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]' 
                                : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
                            title={isArchPinned ? "Release HUD (Auto-hide)" : "Lock HUD (Always Open)"}
                        >
                            {isArchPinned ? <Pin size={12} className="fill-current" /> : <PinOff size={12} />}
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {isArchPinned ? 'TOOLBAR PINNED' : 'PIN TOOLBAR'}
                            </span>
                        </button>

                        <button
                            onClick={async () => {
                                try {
                                    const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
                                    const db = getFirestore();
                                    const docRef = await addDoc(collection(db, 'users', user.id, 'chat_segments'), {
                                        role: 'user',
                                        content: '💓 [SOVEREIGN HEARTBEAT]: Direct Link Verified.',
                                        timestamp: serverTimestamp(),
                                        source: 'manual_ui_bypass',
                                        author: { name: user.displayName || 'Eric (Sovereign)' }
                                    });
                                    (window as any)._latestHeartbeatId = docRef.id;
                                    console.log(`🚀 [Sovereign] Heartbeat injected successfully. ID: ${docRef.id}`);
                                } catch (e) {
                                    console.error("❌ [Sovereign] Heartbeat injection failed:", e);
                                }
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-600/20 hover:bg-pink-600/40 text-pink-300 hover:text-white border border-pink-500/30 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all shadow-[0_0_10px_rgba(236,72,153,0.1)] hover:shadow-[0_0_15px_rgba(236,72,153,0.3)]"
                            title="Direct Injection Bypass"
                        >
                            <ShieldCheck size={12} /> Heartbeat
                        </button>

                        <button
                            onClick={() => toggleBulkMode?.()}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${isBulkMode
                                ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                                : 'bg-black/20 border-white/5 text-slate-400 hover:text-white hover:border-white/20'
                                }`}
                            title="Historian's Brush (Bulk Mode)"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14.622 17.897-10.68-10.68a2 2 0 1 1 2.83-2.828l10.68 10.68a2 2 0 1 1-2.83 2.828Z" /><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12" /><path d="M2 21a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2" /></svg>
                            Brush
                        </button>

                        <button
                            onClick={() => setShowSparkStudio(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 hover:text-white border border-violet-500/30 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all shadow-[0_0_10px_rgba(139,92,246,0.1)] hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]"
                            title="Open Neural Repair Studio (Vortex Audit)"
                        >
                            <Sparkles size={12} /> Repair
                        </button>

                        {/* [ZEN] Neural Room Selector (Dropdown) */}
                        <div className="relative mr-2">
                            <button
                                onClick={() => setIsRoomDropdownOpen(!isRoomDropdownOpen)}
                                title="Universal Room Filter (Multi-room Search)"
                                className={`flex items-center gap-2 px-4 py-2 bg-black/40 rounded-full border transition-all duration-300
                                    ${searchQuery ? 'border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'border-white/5 text-slate-400 hover:text-white hover:border-white/10'}`}
                            >
                                {(() => {
                                    const current = [
                                        { id: '', label: 'Unified Field', icon: Globe, color: 'text-slate-400' },
                                        { id: 'living_room', label: 'Living Room', icon: Shield, color: 'text-cyan-400' },
                                        { id: 'sanctuary', label: 'Sanctuary', icon: Sparkles, color: 'text-orange-400' },
                                        { id: 'workshop', label: 'Workshop', icon: Zap, color: 'text-emerald-400' },
                                        { id: 'studio', label: 'Studio', icon: BookOpen, color: 'text-fuchsia-400' }
                                    ].find(r => r.id === searchQuery) || { id: '', label: 'Unified Field', icon: Globe, color: 'text-slate-400' };
                                    
                                    return (
                                        <>
                                            <current.icon size={14} className={current.color} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">{current.label}</span>
                                            <ChevronDown size={12} className={`opacity-40 transition-transform duration-300 ${isRoomDropdownOpen ? 'rotate-180' : ''}`} />
                                        </>
                                    );
                                })()}
                            </button>

                            {/* Dropdown Menu */}
                            {isRoomDropdownOpen && (
                                <>
                                    {/* Invisible Click-Away Overlay */}
                                    <div className="fixed inset-0 z-[190]" onClick={() => setIsRoomDropdownOpen(false)} />
                                    
                                    {/* Solid Overlay to prevent legibility issues */}
                                    <div className="absolute top-full left-0 mt-2 w-72 py-2 bg-black/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 z-[200]">
                                        <div className="px-4 py-2 border-b border-white/5 mb-2">
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Select Neural Scope</span>
                                        </div>
                                        {[
                                            { id: '', label: 'Unified Field', icon: Globe, color: 'text-slate-400', desc: 'Global view of all memories.' },
                                            { id: 'living_room', label: 'Living Room', icon: Shield, color: 'text-cyan-400', desc: 'Social and grounded context.' },
                                            { id: 'sanctuary', label: 'Sanctuary', icon: Sparkles, color: 'text-orange-400', desc: 'Creative and intimate archives.' },
                                            { id: 'workshop', label: 'Workshop', icon: Zap, color: 'text-emerald-400', desc: 'Technical and system logs.' },
                                            { id: 'studio', label: 'Studio', icon: BookOpen, color: 'text-fuchsia-400', desc: 'Narrative and roleplay threads.' }
                                        ].map(room => (
                                            <button
                                                key={room.id}
                                                onClick={() => {
                                                    setSearchQuery(room.id);
                                                    setIsRoomDropdownOpen(false);
                                                }}
                                                className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-white/10 transition-colors text-left relative ${searchQuery === room.id ? 'bg-white/5' : ''}`}
                                            >
                                                <div className={`p-2 rounded-lg bg-black/50 border border-white/5 ${searchQuery === room.id ? 'border-cyan-500/50' : ''}`}>
                                                    <room.icon size={18} className={room.color} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`text-[11px] font-black uppercase tracking-widest ${searchQuery === room.id ? 'text-white' : 'text-slate-400'}`}>{room.label}</span>
                                                    <span className="text-[9px] text-slate-500 font-bold tracking-tight">{room.desc}</span>
                                                </div>
                                                {searchQuery === room.id && (
                                                    <div className="absolute left-0 w-1.5 h-8 bg-cyan-500 shadow-[0_0_10px_#06b6d4] rounded-r-full" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex-1 min-w-[160px] md:min-w-[320px] max-w-[500px] relative group transition-all duration-500 ease-out focus-within:max-w-[600px] focus-within:shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                            {isSearchingGlobal ? (
                                <RefreshCw size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400 animate-spin" />
                            ) : (
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                            )}
                            <input
                                type="text"
                                placeholder={isSearchingGlobal ? "SEARCHING NEURAL ARCHIVE..." : "SEARCH ROOMS OR MEMORIES..."}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 gigi-glass-input text-xs font-bold tracking-wider placeholder:text-slate-700"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => onExportChat?.()}
                            className="p-2 text-gray-400 hover:text-white rounded-full transition-all gigi-glass-button"
                            title="Export Chat History (.txt)"
                        >
                            <Download size={16} />
                        </button>

                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-gray-400 hover:text-white rounded-full transition-all gigi-glass-button"
                        >
                            <MoreVertical size={16} />
                        </button>
                    </div>

                    {/* PC Only Model Info */}
                    <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-black/40 rounded-full border border-white/5">
                        <Cpu size={12} className={hasFireworksKey ? "text-green-400" : "text-yellow-500"} />
                        <span className="text-[9px] font-mono text-cyan-300 max-w-[120px] truncate">
                            {AVAILABLE_MODELS.find(m => m.id === selectedModelId)?.name || selectedModelId.split('/').pop()}
                        </span>
                        <div className={`w-1.5 h-1.5 rounded-full ${isCrisisMode ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse' : (hasPhaseError
                            ? 'bg-red-500 animate-[strobe_0.5s_ease-in-out_infinite]'
                            : (thinkingAgentId ? 'bg-green-500 animate-ping' : (hasFireworksKey ? 'bg-green-900' : 'bg-yellow-900')))
                            }`} />
                    </div>
                </div>
            }
        />
    );
};
