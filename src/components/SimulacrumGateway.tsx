import React, { useState, useEffect, useRef } from 'react';
import { PersonTag, Tag } from '../types';
import { GlassCard } from './GlassCard';
import { GlassAvatar } from './GlassAvatar';
import { X, Send, BrainCircuit, Loader2, Settings, Plus, Archive, MessageSquare, Edit2, Trash2, Check } from 'lucide-react';
import { WikiTagEditor } from './shared/WikiTagEditor';
import { SimulacrumMessage, SimulacrumSessionMeta, fetchSimulacrumHistory, fetchSimulacrumSessions, saveSimulacrumMessage, saveSimulacrumSessionMeta, generateSimulacrumResponse } from '../services/ai/generators/simulacrumGenerator';
import { formatLifeOSDate } from '../utils/dateSanitizer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { exportSimulationTranscript } from '../services/ai/generators/transcriptExporter';
import CopyButton from './CopyButton';

const MemoizedSimulacrumMessage = React.memo(({ msg, hostTagName, currentProseSize }: { msg: any, hostTagName: string, currentProseSize: string }) => {
    return (
        <div className={`flex flex-col mb-4 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`flex items-center gap-2 mb-1 px-1 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                    {msg.role === 'user' ? 'You' : hostTagName}
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                    {formatLifeOSDate(new Date(msg.timestamp), 'exact')}
                </span>
            </div>
            <div className={`relative group/bubble max-w-[85%] rounded-2xl px-5 py-3 ${
                msg.role === 'user' 
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/20 rounded-tr-sm' 
                    : 'bg-[#2f3136]/80 border border-white/5 text-slate-200 rounded-tl-sm shadow-xl'
            }`}>
                <div className={`prose prose-invert ${currentProseSize} max-w-none transition-all duration-300`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                    </ReactMarkdown>
                </div>
                {msg.ephemeralImages && msg.ephemeralImages.length > 0 && (
                    <div className="flex gap-2 mt-4 overflow-x-auto custom-scrollbar pb-2">
                        {msg.ephemeralImages.map((b64: string, idx: number) => (
                            <img key={idx} src={b64} alt="Attached" className="h-32 rounded-xl object-cover border border-white/10" />
                        ))}
                    </div>
                )}
                <div className="absolute -bottom-3 -right-3 opacity-0 group-hover/bubble:opacity-100 transition-opacity z-10">
                    <CopyButton textToCopy={msg.content} className="shadow-lg hover:scale-110 bg-[#161821] border border-white/10" />
                </div>
            </div>
        </div>
    );
});

interface SimulacrumGatewayProps {
    hostTag: PersonTag;
    userId: string;
    allTags: Tag[];
    avatarUrl?: string;
    resumeSessionId?: string;
    onClose: () => void;
}

export const SimulacrumGateway: React.FC<SimulacrumGatewayProps> = ({ hostTag, userId, allTags, avatarUrl, resumeSessionId, onClose }) => {
    const [history, setHistory] = useState<SimulacrumMessage[]>([]);
    const [sessions, setSessions] = useState<SimulacrumSessionMeta[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [ephemeralImages, setEphemeralImages] = useState<string[]>([]);
    const [fontSizeLevel, setFontSizeLevel] = useState(1); // 0=sm, 1=base, 2=lg, 3=xl
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editSessionName, setEditSessionName] = useState('');
    const [isRenderReady, setIsRenderReady] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [modelEngine, setModelEngine] = useState<'xai' | 'deepseek'>('xai');
    const [verbosity, setVerbosity] = useState<number>(3);
    const [estimatedTokenBurn, setEstimatedTokenBurn] = useState(0);
    const [tokenLimit, setTokenLimit] = useState(200000);
    const hasTrippedAlarm = tokenLimit > 0 && estimatedTokenBurn >= tokenLimit;

    useEffect(() => {
        const handleTokenBurn = (e: any) => {
            setEstimatedTokenBurn(prev => prev + (e.detail || 0));
        };
        window.addEventListener('gigi-token-burn', handleTokenBurn);
        return () => window.removeEventListener('gigi-token-burn', handleTokenBurn);
    }, []);
    const fontSizeClasses = ['prose-sm', 'prose-base', 'prose-lg', 'prose-xl'];
    const inputTextSizeClasses = ['text-xs', 'text-sm', 'text-base', 'text-lg'];
    
    const currentProseSize = fontSizeClasses[fontSizeLevel];
    const currentInputTextSize = inputTextSizeClasses[fontSizeLevel];
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load all sessions on mount
    useEffect(() => {
        const loadSessions = async () => {
            const fetchedSessions = await fetchSimulacrumSessions(userId, hostTag.id);
            setSessions(fetchedSessions);
            
            if (resumeSessionId) {
                // Check if the requested session actually exists for this user/tag
                const exists = fetchedSessions.some(s => s.id === resumeSessionId);
                if (exists) {
                    const currentSession = fetchedSessions.find(s => s.id === resumeSessionId);
                    if (currentSession?.modelEngine) setModelEngine(currentSession.modelEngine);
                    if (currentSession?.verbosity) setVerbosity(currentSession.verbosity);
                    setCurrentSessionId(resumeSessionId);
                    return;
                }
            }

            if (fetchedSessions.length > 0) {
                // Default to most recent session
                const mostRecentSession = fetchedSessions[0];
                if (mostRecentSession.modelEngine) setModelEngine(mostRecentSession.modelEngine);
                if (mostRecentSession.verbosity) setVerbosity(mostRecentSession.verbosity);
                setCurrentSessionId(mostRecentSession.id);
            } else {
                // Create a default sandbox session if none exist
                handleNewSimulation();
            }
        };
        loadSessions();
    }, [userId, hostTag.id, resumeSessionId]);

    // Load history when session changes
    useEffect(() => {
        if (!currentSessionId) return;
        const loadHistory = async () => {
            setIsLoading(true);
            const pastMessages = await fetchSimulacrumHistory(userId, hostTag.id, currentSessionId);
            setHistory(pastMessages);
            setIsLoading(false);
            scrollToBottom();
        };
        loadHistory();
    }, [userId, hostTag.id, currentSessionId]);

    // DOM Shutter Effect
    useEffect(() => {
        if (!isLoading) {
            const timer = setTimeout(() => setIsRenderReady(true), 150);
            return () => clearTimeout(timer);
        } else {
            setIsRenderReady(false);
        }
    }, [isLoading]);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const handleNewSimulation = async () => {
        const newSession: SimulacrumSessionMeta = {
            id: `sim-session-${Date.now()}`,
            tagId: hostTag.id,
            name: 'New Sandbox',
            lastActive: Date.now(),
            isArchived: false,
            modelEngine,
            verbosity
        };
        await saveSimulacrumSessionMeta(userId, newSession);
        setSessions(prev => [newSession, ...prev]);
        setCurrentSessionId(newSession.id);
        setHistory([]);
    };

    const handleSend = async () => {
        if ((!inputText.trim() && ephemeralImages.length === 0) || isThinking || !currentSessionId) return;

        const userMsg: SimulacrumMessage = {
            id: `msg-${Date.now()}-user`,
            role: 'user',
            content: inputText,
            timestamp: Date.now(),
            ephemeralImages: ephemeralImages.length > 0 ? [...ephemeralImages] : undefined,
            sessionId: currentSessionId
        };

        const currentImages = [...ephemeralImages];

        // Optimistic UI update
        const newHistory = [...history, userMsg];
        setHistory(newHistory);
        setInputText('');
        setEphemeralImages([]);
        setIsThinking(true);
        scrollToBottom();

        // Async save
        saveSimulacrumMessage(userId, hostTag.id, userMsg);
        
        // Update session meta
        const currentSession = sessions.find(s => s.id === currentSessionId);
        if (currentSession) {
            const updated = { ...currentSession, lastActive: Date.now(), modelEngine, verbosity };
            saveSimulacrumSessionMeta(userId, updated);
            setSessions(prev => prev.map(s => s.id === currentSessionId ? updated : s).sort((a, b) => b.lastActive - a.lastActive));
        }

        // Generate response
        const responseText = await generateSimulacrumResponse(hostTag, history, userMsg.content, userId, allTags, currentImages, currentSessionId, modelEngine, verbosity);
        
        const modelMsg: SimulacrumMessage = {
            id: `msg-${Date.now()}-model`,
            role: 'model',
            content: responseText,
            timestamp: Date.now(),
            sessionId: currentSessionId
        };

        setHistory(prev => [...prev, modelMsg]);
        setIsThinking(false);
        scrollToBottom();

        // Async save model response
        saveSimulacrumMessage(userId, hostTag.id, modelMsg);
    };

    const handleRenameSession = async (sessionId: string, newName: string) => {
        if (!newName.trim()) return;
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            const updated = { ...session, name: newName };
            await saveSimulacrumSessionMeta(userId, updated);
            setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
        }
    };

    const handleToggleArchive = async (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            const updated = { ...session, isArchived: !session.isArchived };
            await saveSimulacrumSessionMeta(userId, updated);
            setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
        }
    };

    const handleArchiveTranscript = async () => {
        if (history.length === 0) return;
        setIsArchiving(true);
        try {
            const currentSession = sessions.find(s => s.id === currentSessionId);
            const title = currentSession?.name || `Simulacrum: ${hostTag.name}`;
            const participants = [hostTag.name, 'Moderator'];
            await exportSimulationTranscript(
                userId,
                title,
                history,
                participants,
                (msg) => msg.role === 'model' ? hostTag.name : 'Moderator'
            );
            alert("Transcript archived successfully!");
        } catch (error) {
            console.error("Failed to archive transcript:", error);
            alert("Failed to archive transcript");
        } finally {
            setIsArchiving(false);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        let foundImage = false;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
                foundImage = true;
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        if (ev.target?.result) {
                            setEphemeralImages(prev => [...prev, ev.target!.result as string]);
                        }
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
        if (foundImage) e.preventDefault();
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-2xl flex animate-in fade-in zoom-in-95 duration-300">
            
            {/* Left Sidebar (Drawer) */}
            <div className="w-72 bg-slate-950/80 border-r border-white/10 flex-col hidden md:flex">
                <div className="p-4 border-b border-white/5">
                    <button 
                        onClick={handleNewSimulation}
                        className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white p-3 rounded-xl transition-colors font-semibold active:scale-95">
                        <Plus size={18} /> New Simulation
                    </button>
                </div>
                
                {/* Sessions List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    <div className="text-[10px] font-bold text-slate-500 mb-3 px-1 uppercase tracking-wider">Active Sessions</div>
                    
                    {sessions.filter(s => !s.isArchived).map(session => (
                        <div key={session.id} className="relative group">
                            <button 
                                onClick={() => setCurrentSessionId(session.id)}
                                className={`w-full flex flex-col text-left p-3 rounded-xl transition-colors border ${
                                    currentSessionId === session.id 
                                    ? 'bg-fuchsia-500/10 border-fuchsia-500/20 hover:bg-fuchsia-500/20' 
                                    : 'bg-black/20 border-transparent hover:bg-white/5'
                                }`}>
                                {editingSessionId === session.id ? (
                                    <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                                        <input 
                                            autoFocus
                                            value={editSessionName}
                                            onChange={e => setEditSessionName(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    handleRenameSession(session.id, editSessionName);
                                                    setEditingSessionId(null);
                                                } else if (e.key === 'Escape') {
                                                    setEditingSessionId(null);
                                                }
                                            }}
                                            className="bg-black/50 border border-fuchsia-500/50 text-white text-sm rounded px-2 py-1 w-full focus:outline-none"
                                        />
                                        <button 
                                            onClick={() => {
                                                handleRenameSession(session.id, editSessionName);
                                                setEditingSessionId(null);
                                            }}
                                            className="p-1 hover:bg-white/10 rounded text-green-400"
                                        >
                                            <Check size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`text-sm font-bold flex items-center gap-2 pr-8 ${currentSessionId === session.id ? 'text-fuchsia-100' : 'text-slate-300'}`}>
                                            <BrainCircuit size={14} className={`shrink-0 ${currentSessionId === session.id ? 'text-fuchsia-400' : 'text-slate-500'}`} />
                                            <span className="truncate">{session.name}</span>
                                        </div>
                                        <div className={`text-xs mt-1 truncate ${currentSessionId === session.id ? 'text-fuchsia-300/60' : 'text-slate-500'}`}>
                                            {formatLifeOSDate(session.lastActive, 'relative')}
                                        </div>
                                    </>
                                )}
                            </button>
                            {editingSessionId !== session.id && (
                                <div className="absolute top-2 right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingSessionId(session.id);
                                            setEditSessionName(session.name);
                                        }}
                                        className="p-1.5 bg-black/50 hover:bg-white/10 rounded-md text-slate-300 transition-colors"
                                        title="Rename Session"
                                    >
                                        <Edit2 size={12} />
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleArchive(session.id);
                                        }}
                                        className="p-1.5 bg-black/50 hover:bg-white/10 rounded-md text-slate-300 transition-colors"
                                        title="Archive Session"
                                    >
                                        <Archive size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}

                    <div className="text-[10px] font-bold text-slate-500 mt-6 mb-3 px-1 uppercase tracking-wider">Archived</div>

                    {sessions.filter(s => s.isArchived).map(session => (
                        <div key={session.id} className="relative group">
                            <button 
                                onClick={() => setCurrentSessionId(session.id)}
                                className={`w-full flex flex-col text-left p-3 rounded-xl transition-colors border ${
                                    currentSessionId === session.id 
                                    ? 'bg-white/10 border-white/20' 
                                    : 'bg-transparent border-transparent hover:bg-white/5'
                                }`}>
                                <div className="text-sm font-semibold text-slate-300 group-hover:text-white flex items-center gap-2 pr-6">
                                    <Archive size={14} className="shrink-0 text-slate-500 group-hover:text-slate-400" />
                                    <span className="truncate">{session.name}</span>
                                </div>
                                <div className="text-xs text-slate-500 mt-1 truncate">Archived {formatLifeOSDate(session.lastActive, 'relative')}</div>
                            </button>
                            <div className="absolute top-2 right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleArchive(session.id);
                                    }}
                                    className="p-1.5 bg-black/50 hover:bg-white/10 rounded-md text-slate-300 transition-colors"
                                    title="Restore Session"
                                >
                                    <Plus size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-white/5">
                    <button 
                        onClick={onClose}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-slate-300 transition-colors group"
                        title="Return to Simulacrum Settings"
                    >
                        <Settings size={20} className="text-slate-400 group-hover:text-white transition-colors" />
                        <span className="text-sm font-bold group-hover:text-white transition-colors">Gateway Settings</span>
                    </button>
                </div>
            </div>

            {/* Main Stage */}
            <div className="flex-1 flex flex-col relative h-full">
                {/* Header */}
                <div className="sticky top-0 z-20 bg-[#0f1115]/95 backdrop-blur-xl border-b border-fuchsia-500/20 px-6 py-4 flex items-center justify-between shadow-md shrink-0">
                    <div className="flex items-center gap-4">
                        <GlassAvatar 
                            imageUrl={avatarUrl || hostTag.mediaGallery?.[0]?.url || ''} 
                            fallbackChar={hostTag.name.charAt(0)}
                            size="w-12 h-12"
                            className="border-2 border-fuchsia-500/50 shadow-[0_0_15px_rgba(217,70,239,0.3)]"
                        />
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                {hostTag.name} 
                                <span className="text-[10px] font-mono text-fuchsia-400 bg-fuchsia-950/50 px-2 py-0.5 rounded-full border border-fuchsia-500/30 flex items-center gap-1 uppercase tracking-wider">
                                    <BrainCircuit size={12} />
                                    Simulacrum Active
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400">
                                {hostTag.metadata?.simulacrumTraits?.tone 
                                    ? `Tone: ${hostTag.metadata.simulacrumTraits.tone.substring(0, 50)}${hostTag.metadata.simulacrumTraits.tone.length > 50 ? '...' : ''}`
                                    : "Heuristic Persona Construct"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${hasTrippedAlarm ? 'bg-red-500/20 border-red-500 animate-pulse' : 'bg-white/5 border-white/10'}`} title="Flood Alarm: Limit token burn.">
                            <span className={`${hasTrippedAlarm ? 'text-red-400' : 'text-slate-400'} text-[10px] font-bold uppercase tracking-wider`}>
                                {hasTrippedAlarm ? 'ALARM TRIPPED' : 'Burn'}
                            </span>
                            <span className={`text-xs font-mono ${hasTrippedAlarm ? 'text-red-300 font-bold' : 'text-slate-300'}`}>
                                {estimatedTokenBurn.toLocaleString()}
                            </span>
                            <span className="text-slate-600 text-[10px] font-mono px-0.5">/</span>
                            <input 
                                type="number" 
                                className="bg-transparent border-b border-white/10 text-slate-300 text-xs w-14 focus:outline-none focus:border-fuchsia-500/50" 
                                value={tokenLimit} 
                                step="10000"
                                onChange={(e) => setTokenLimit(Number(e.target.value) || 0)}
                            />
                        </div>

                        {/* Verbosity Slider */}
                        <div className="hidden lg:flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10" title="Verbosity (1 = Minimal, 5 = Verbose)">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Length</span>
                            <input 
                                type="range" 
                                min="1" 
                                max="5" 
                                step="1" 
                                value={verbosity} 
                                onChange={(e) => setVerbosity(Number(e.target.value))} 
                                className="w-16 accent-fuchsia-500 cursor-pointer"
                            />
                            <span className="text-xs font-mono text-fuchsia-400 font-bold w-3 text-center">{verbosity}</span>
                        </div>

                        {/* Engine Selection Toggle */}
                        <div className="hidden md:flex bg-black/40 rounded-lg overflow-hidden border border-white/10 text-[10px] font-bold tracking-wider uppercase">
                            <button 
                                onClick={() => setModelEngine('xai')}
                                className={`px-3 py-1.5 transition-colors border-r border-white/10 ${modelEngine === 'xai' ? 'bg-fuchsia-500/20 text-fuchsia-300 shadow-[inset_0_0_10px_rgba(217,70,239,0.2)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                title="Use xAI Grok (Flagship)"
                            >
                                Grok 4.x
                            </button>
                            <button 
                                onClick={() => setModelEngine('deepseek')}
                                className={`px-3 py-1.5 transition-colors ${modelEngine === 'deepseek' ? 'bg-cyan-500/20 text-cyan-300 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                title="Use DeepSeek V3/V4 (Test Drive)"
                            >
                                DeepSeek
                            </button>
                        </div>

                        {history.length > 0 && (
                            <button 
                                onClick={handleArchiveTranscript}
                                disabled={isArchiving}
                                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg transition-colors text-[10px] font-bold tracking-wider uppercase"
                                title="Export Transcript to JSON/MD"
                            >
                                {isArchiving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
                                {isArchiving ? "Archiving..." : "Archive MD/JSON"}
                            </button>
                        )}

                        <div className="hidden sm:flex bg-black/40 rounded-lg overflow-hidden border border-white/10">
                            <button onClick={() => setFontSizeLevel(Math.max(0, fontSizeLevel - 1))} disabled={fontSizeLevel === 0} className="px-3 py-1.5 hover:bg-white/10 text-slate-400 disabled:opacity-30 border-r border-white/10 text-xs font-serif font-bold transition-colors" title="Decrease text size">A-</button>
                            <button onClick={() => setFontSizeLevel(Math.min(3, fontSizeLevel + 1))} disabled={fontSizeLevel === 3} className="px-3 py-1.5 hover:bg-white/10 text-slate-400 disabled:opacity-30 text-xs font-serif font-bold transition-colors" title="Increase text size">A+</button>
                        </div>

                        {/* Mobile close button (Settings fallback) */}
                        <button 
                            onClick={onClose}
                            className="md:hidden p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            title="Return to Settings"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                </div>

                {/* Chat History */}
                <div className={`flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar transition-opacity duration-500 ${isRenderReady ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="max-w-4xl mx-auto space-y-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[50vh]">
                                <Loader2 className="w-12 h-12 animate-spin text-fuchsia-500 mb-4" />
                                <p className="text-white font-mono uppercase tracking-widest animate-pulse">Loading Existing Simulation... Please Wait...</p>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center space-y-4 opacity-50">
                                <BrainCircuit size={48} className="text-fuchsia-500" />
                                <p className="text-slate-300 max-w-md">
                                    The heuristic matrix is initialized. This is a walled-off simulation of {hostTag.name}. Ask questions, explore memories, or test historical data.
                                </p>
                            </div>
                        ) : (
                            history.map((msg) => (
                                <MemoizedSimulacrumMessage 
                                    key={msg.id} 
                                    msg={msg} 
                                    hostTagName={hostTag.name} 
                                    currentProseSize={currentProseSize} 
                                />
                            ))
                        )}
                        
                        {isThinking && (
                            <div className="flex justify-start flex-col mb-4">
                                <div className="flex items-center gap-2 mb-1 px-1">
                                    <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                                        {hostTag.name}
                                    </span>
                                </div>
                                <div className="bg-[#2f3136]/80 border border-white/5 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-3 shadow-xl w-fit">
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} className="h-4" />
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-black/60 border-t border-white/5 backdrop-blur-md shrink-0">
                    <div className="max-w-4xl mx-auto flex flex-col gap-2">
                        {ephemeralImages.length > 0 && (
                            <div className="flex gap-2 px-2 overflow-x-auto custom-scrollbar">
                                {ephemeralImages.map((b64, idx) => (
                                    <div key={idx} className="relative group shrink-0">
                                        <img src={b64} className="h-16 w-16 object-cover rounded-lg border border-fuchsia-500/50" />
                                        <button 
                                            onClick={() => setEphemeralImages(prev => prev.filter((_, i) => i !== idx))}
                                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-4 items-end">
                            <div className="flex-1 bg-black/40 rounded-2xl border border-white/10 focus-within:border-fuchsia-500/50 transition-colors p-1">
                                <WikiTagEditor
                                    value={inputText}
                                    onChange={setInputText}
                                    userId={userId}
                                    textSizeClass={currentInputTextSize}
                                    placeholder={`Message the ${hostTag.name} simulacrum...`}
                                    className="w-full min-h-[50px] max-h-[200px] overflow-y-auto"
                                    onPaste={handlePaste}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={(!inputText.trim() && ephemeralImages.length === 0) || isThinking}
                                className="p-4 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:from-fuchsia-500 hover:to-violet-500 text-white shadow-lg shadow-fuchsia-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-1 flex-shrink-0"
                            >
                                <Send size={20} className={isThinking ? 'animate-pulse' : ''} />
                            </button>
                        </div>
                        <div className="text-center text-[10px] text-slate-500 mt-1">
                            Simulacrum Constructs can make mistakes. Consider verifying critical data against the SSOT Corpus.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

