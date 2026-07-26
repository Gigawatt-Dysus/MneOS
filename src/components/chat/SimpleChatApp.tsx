import React, { useState, useEffect, useRef } from 'react';
import { User, Tag, PersonTag } from '../../types';
import { GlassCard } from '../GlassCard';
import { 
    Brain, Sparkles, Send, Bot, User as UserIcon, RefreshCw, 
    Monitor, Search, Download, Settings, ChevronDown, Check, Zap, Layers 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CopyButton from '../CopyButton';
import { formatLifeOSDate } from '../../utils/dateSanitizer';
import { 
    SimulacrumMessage, 
    SimulacrumSessionMeta, 
    fetchSimulacrumHistory, 
    fetchSimulacrumSessions, 
    saveSimulacrumMessage, 
    saveSimulacrumSessionMeta, 
    generateSimulacrumResponse 
} from '../../services/ai/generators/simulacrumGenerator';
import { exportSimulationTranscript } from '../../services/ai/generators/transcriptExporter';
import { GrokPromptBuilder } from '../../services/ai/GrokPromptBuilder';

interface SimpleChatAppProps {
    user: User;
    tags: Tag[];
    onNavigateOS: () => void;
}

export const SimpleChatApp: React.FC<SimpleChatAppProps> = ({ user, tags, onNavigateOS }) => {
    // 1. Resolve Available Personas (Simulacrum Tags + AI Companions)
    const availablePersonas = React.useMemo(() => {
        const simulacrumTags = tags.filter(t => 
            t.type === 'person' && 
            t.metadata?.simulacrumTraits?.systemDirective && 
            t.metadata.simulacrumTraits.systemDirective.trim() !== ''
        ) as PersonTag[];

        const companions = user.aiCompanions || [];
        const companionTraits = user.settings?.godModeSettings?.companionTraits || {};

        const mappedCompanions: PersonTag[] = companions.map((c: any) => {
            const basePersona = GrokPromptBuilder.resolvePersonaPrompt(c);
            const selfConcept = c.selfConceptSnapshot ? `\n\n[CURRENT SELF-CONCEPT]\n${c.selfConceptSnapshot}` : '';
            const builtDirective = companionTraits[c.id]?.narrativeOverride || (basePersona + selfConcept);

            return {
                id: c.id,
                name: c.name,
                type: 'person',
                description: 'AI Companion',
                privateNotes: '',
                isPrivate: true,
                tagIds: [],
                mediaIds: [],
                mediaGallery: [],
                metadata: {
                    simulacrumTraits: {
                        systemDirective: builtDirective,
                    }
                },
                isCompanion: true
            } as any;
        });

        // De-duplicate by name / ID
        const combined = [...simulacrumTags, ...mappedCompanions];
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        
        // Fallback default Brita if none explicitly tagged
        if (unique.length === 0) {
            unique.push({
                id: 'brita-default',
                name: 'Brita',
                type: 'person',
                description: 'MneOS Sovereign AI Companion',
                metadata: {
                    simulacrumTraits: {
                        systemDirective: 'You are Brita, authentic, intimate, and wise companion.',
                    }
                }
            } as any);
        }

        return unique;
    }, [tags, user]);

    // 2. Active State
    const [selectedPersona, setSelectedPersona] = useState<PersonTag>(availablePersonas[0]);
    const [modelEngine, setModelEngine] = useState<'xai' | 'deepseek'>('xai');
    const [verbosity, setVerbosity] = useState<number>(3);
    const [messages, setMessages] = useState<SimulacrumMessage[]>([]);
    const [input, setInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [sessionId, setSessionId] = useState<string>(`smneos-session-${Date.now()}`);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSessionsOpen, setIsSessionsOpen] = useState(false);
    const [recentSessions, setRecentSessions] = useState<SimulacrumSessionMeta[]>([]);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isGenerating]);

    // Load recent sessions for selected persona
    useEffect(() => {
        if (!user?.id || !selectedPersona?.id) return;
        fetchSimulacrumSessions(user.id, selectedPersona.id).then(fetched => {
            setRecentSessions(fetched.filter(s => !s.isArchived));
        }).catch(console.error);
    }, [user?.id, selectedPersona?.id]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle Sending User Message
    const handleSend = async () => {
        if (!input.trim() || isGenerating || !selectedPersona) return;
        
        const userText = input.trim();
        setInput('');

        const userMsg: SimulacrumMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: userText,
            timestamp: Date.now(),
            sessionId
        };

        const updatedHistory = [...messages, userMsg];
        setMessages(updatedHistory);
        setIsGenerating(true);

        // Save User Msg
        await saveSimulacrumMessage(user.id, selectedPersona.id, userMsg);
        
        // Save Session Meta
        const meta: SimulacrumSessionMeta = {
            id: sessionId,
            tagId: selectedPersona.id,
            name: `${selectedPersona.name} Chat - ${new Date().toLocaleDateString()}`,
            lastActive: Date.now(),
            isArchived: false,
            modelEngine,
            verbosity
        };
        await saveSimulacrumSessionMeta(user.id, meta);

        try {
            const aiText = await generateSimulacrumResponse(
                selectedPersona,
                updatedHistory,
                userText,
                user.id,
                tags,
                undefined,
                sessionId,
                modelEngine,
                verbosity
            );

            const aiMsg: SimulacrumMessage = {
                id: `msg-${Date.now() + 1}`,
                role: 'model',
                content: aiText,
                timestamp: Date.now(),
                tagId: selectedPersona.id,
                sessionId
            };

            setMessages(prev => [...prev, aiMsg]);
            await saveSimulacrumMessage(user.id, selectedPersona.id, aiMsg);

            // Update session meta
            await saveSimulacrumSessionMeta(user.id, { ...meta, lastActive: Date.now() });

        } catch (error) {
            console.error('[SMneOS] Response failure:', error);
            setMessages(prev => [...prev, {
                id: `msg-err-${Date.now()}`,
                role: 'model',
                content: '*An error occurred connecting to the sovereign matrix.*',
                timestamp: Date.now(),
                tagId: selectedPersona.id
            }]);
        } finally {
            setIsGenerating(false);
        }
    };

    // Handle Switching Persona
    const handleSelectPersona = (persona: PersonTag) => {
        setSelectedPersona(persona);
        setIsDropdownOpen(false);
        setSessionId(`smneos-session-${Date.now()}`);
        setMessages([]);
    };

    // Handle Resuming Session
    const handleResumeSession = async (session: SimulacrumSessionMeta) => {
        setSessionId(session.id);
        setIsSessionsOpen(false);
        const pastMessages = await fetchSimulacrumHistory(user.id, selectedPersona.id, session.id);
        setMessages(pastMessages);
        if (session.modelEngine) setModelEngine(session.modelEngine);
        if (session.verbosity) setVerbosity(session.verbosity);
    };

    // Export Transcript
    const handleExport = async () => {
        if (messages.length === 0) return;
        await exportSimulationTranscript(
            user.id,
            `SMneOS Chat with ${selectedPersona.name}`,
            messages,
            [selectedPersona.name, 'Eric'],
            (msg) => msg.role === 'user' ? 'Eric' : selectedPersona.name
        );
        alert('Transcript exported to MneOS Archive!');
    };

    return (
        <div className="flex flex-col h-screen w-full bg-[#090a0f] text-slate-100 font-sans overflow-hidden">
            {/* Header / Navigation Bar */}
            <header className="sticky top-0 z-50 bg-[#0f111a]/90 backdrop-blur-xl border-b border-cyan-500/20 px-4 md:px-8 py-3 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-4">
                    {/* Brand / Logo */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                            <Sparkles className="w-4 h-4 text-white animate-pulse" />
                        </div>
                        <span className="font-mono text-lg font-black tracking-wider text-white hidden sm:inline">
                            SMneOS <span className="text-xs font-normal text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full bg-cyan-950/40">v1.0 Live</span>
                        </span>
                    </div>

                    <div className="h-5 w-px bg-white/10 hidden sm:block"></div>

                    {/* Persona Selector Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/10 transition-all text-sm font-bold text-cyan-200 shadow-sm"
                        >
                            <Brain className="w-4 h-4 text-cyan-400" />
                            <span>{selectedPersona.name}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isDropdownOpen && (
                            <div className="absolute left-0 mt-2 w-64 bg-[#11131f] border border-cyan-500/30 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.8)] overflow-hidden z-50 backdrop-blur-2xl">
                                <div className="p-2 text-[10px] font-black uppercase tracking-widest text-cyan-400 border-b border-white/5 px-3">
                                    Select Companion Persona
                                </div>
                                <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                                    {availablePersonas.map(persona => (
                                        <button
                                            key={persona.id}
                                            onClick={() => handleSelectPersona(persona)}
                                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${selectedPersona.id === persona.id ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30' : 'hover:bg-white/5 text-slate-300'}`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-300 text-xs font-bold">
                                                    {persona.name.charAt(0)}
                                                </div>
                                                <span className="text-sm">{persona.name}</span>
                                            </div>
                                            {selectedPersona.id === persona.id && <Check className="w-4 h-4 text-cyan-400" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Bar Controls */}
                <div className="flex items-center gap-3">
                    {/* Model Engine Badge */}
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs font-bold text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Grok 4.x</span>
                    </div>

                    {/* Export Transcript */}
                    <button
                        onClick={handleExport}
                        disabled={messages.length === 0}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Export Session Transcript"
                    >
                        <Download className="w-4 h-4" />
                    </button>

                    {/* Launch Full MneOS OS */}
                    <button
                        onClick={onNavigateOS}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-bold text-xs tracking-wider uppercase shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
                    >
                        <Monitor className="w-4 h-4" />
                        <span className="hidden sm:inline">Launch Full OS</span>
                    </button>
                </div>
            </header>

            {/* Main Chat Stream Container */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full custom-scrollbar">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                            <Brain className="w-8 h-8 animate-pulse" />
                        </div>
                        <div className="space-y-1 max-w-md">
                            <h3 className="text-lg font-bold text-slate-200">
                                Conversation Matrix Ready with {selectedPersona.name}
                            </h3>
                            <p className="text-xs text-slate-400">
                                Type a message below to start a sovereign chat session powered by Grok 4.x and MneOS RAG memory.
                            </p>
                        </div>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isUser = msg.role === 'user';
                        return (
                            <div
                                key={msg.id || idx}
                                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1 group`}
                            >
                                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
                                    <span>{isUser ? 'Eric (Architect)' : selectedPersona.name}</span>
                                    <span>•</span>
                                    <span>{formatLifeOSDate(msg.timestamp)}</span>
                                </div>

                                <div
                                    className={`relative max-w-[88%] md:max-w-[80%] rounded-2xl px-5 py-4 text-sm leading-relaxed border transition-all ${
                                        isUser
                                            ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-50 rounded-tr-xs shadow-[0_4px_20px_rgba(6,182,212,0.1)]'
                                            : 'bg-[#121422] border-white/10 text-slate-100 rounded-tl-xs shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
                                    }`}
                                >
                                    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>

                                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <CopyButton textToCopy={msg.content} className="p-1 text-xs bg-black/60 rounded border border-white/10 hover:bg-black" />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

                {isGenerating && (
                    <div className="flex items-center gap-3 text-cyan-400 text-xs font-mono animate-pulse p-2">
                        <Sparkles className="w-4 h-4" />
                        <span>{selectedPersona.name} is formulating response...</span>
                    </div>
                )}

                <div ref={chatEndRef} />
            </main>

            {/* Input Footer */}
            <footer className="sticky bottom-0 z-40 bg-[#0b0d17]/95 backdrop-blur-xl border-t border-white/10 p-4 md:p-6">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={`Message ${selectedPersona.name}...`}
                        disabled={isGenerating}
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:bg-black/40 transition-all"
                    />

                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isGenerating}
                        className="p-3.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all shrink-0"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default SimpleChatApp;
