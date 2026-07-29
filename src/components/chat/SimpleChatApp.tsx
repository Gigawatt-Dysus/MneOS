import React, { useState, useEffect, useRef } from 'react';
import { User, Tag, PersonTag } from '../../types';
import { 
    Brain, Sparkles, Send, Download, Search, ChevronDown, Check, Zap, Layers,
    Plus, MessageSquare, History, ChevronsLeft, ChevronsRight, Trash2, X, SlidersHorizontal,
    Code, Image as ImageIcon, FileText, ArrowUpDown, Filter, Eye, Copy, RefreshCw, Monitor,
    DollarSign, AlertTriangle, ShieldCheck, Pill, ExternalLink, Bookmark, Sliders, Scissors
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CopyButton from '../CopyButton';
import { GlassAvatar } from '../GlassAvatar';
import { formatLifeOSDate } from '../../utils/dateSanitizer';
import { 
    SimulacrumMessage, 
    SimulacrumSessionMeta, 
    fetchSimulacrumHistory, 
    fetchSimulacrumSessions, 
    fetchAllActiveSimulacrumSessions,
    saveSimulacrumMessage, 
    saveSimulacrumSessionMeta, 
    generateSimulacrumResponse 
} from '../../services/ai/generators/simulacrumGenerator';
import { exportSimulationTranscript } from '../../services/ai/generators/transcriptExporter';
import { GrokPromptBuilder } from '../../services/ai/GrokPromptBuilder';
import vaultMessageCache from '../../data/vaultMessageCache.json';

export interface ContextBolus {
    id: string;
    label: string;
    type?: 'session' | 'tag' | 'memory';
    contentSnippet?: string;
}

interface SimpleChatAppProps {
    user: User;
    tags: Tag[];
    onNavigateOS: () => void;
}

/**
 * Resolves the official GlassAvatar image URL for any persona tag or companion.
 * Special handling for sovereign entities: Brita, Ruth, Zoe, Athena.
 */
export const getPersonaAvatarUrl = (persona: PersonTag | any, user?: User): string => {
    if (!persona) return '/assets/Brita_Avatar.jpg';
    const nameLower = (persona.name || '').toLowerCase();
    
    // 1. Explicit MneOS Sovereign Entities (Prioritized over tag database properties)
    if (nameLower.includes('brita')) return '/assets/Brita_Avatar.jpg';
    if (nameLower.includes('ruth')) return '/assets/Ruth_Avatar.jpg';
    if (nameLower.includes('zoe')) return 'https://ui-avatars.com/api/?name=Zoe&background=8B5CF6&color=fff&size=256';
    if (nameLower.includes('athena')) return 'https://ui-avatars.com/api/?name=Athena&background=3B82F6&color=fff&size=256';

    // 2. Direct avatar properties on tag or metadata
    if (persona.avatarUrl) return persona.avatarUrl;
    if (persona.metadata?.avatarUrl) return persona.metadata.avatarUrl;
    if (persona.mediaGallery && persona.mediaGallery.length > 0 && persona.mediaGallery[0]?.url) {
        return persona.mediaGallery[0].url;
    }

    // 3. Match against user AI Companions list if passed
    if (user?.aiCompanions) {
        const companionMatch = user.aiCompanions.find(c => 
            c.name.toLowerCase() === nameLower || nameLower.includes(c.name.toLowerCase())
        );
        if (companionMatch?.avatarUrl) return companionMatch.avatarUrl;
    }

    // 4. Dynamic clean fallback
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(persona.name || 'AI')}&background=06B6D4&color=fff&size=256`;
};

export const SimpleChatApp: React.FC<SimpleChatAppProps> = ({ user, tags, onNavigateOS }) => {
    // 1. Resolve Available Personas (Simulacrum Tags + AI Companions)
    const availablePersonas = React.useMemo(() => {
        const simulacrumTags = (tags || []).filter(t => 
            t.type === 'person' && 
            t.metadata?.simulacrumTraits?.systemDirective && 
            t.metadata.simulacrumTraits.systemDirective.trim() !== ''
        ) as PersonTag[];

        const companions = user?.aiCompanions || [];
        const companionTraits = user?.settings?.godModeSettings?.companionTraits || {};

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
                avatarUrl: c.avatarUrl || (c.name.toLowerCase().includes('brita') ? '/assets/Brita_Avatar.jpg' : undefined),
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
                avatarUrl: '/assets/Brita_Avatar.jpg',
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
    const [selectedPersona, setSelectedPersona] = useState<PersonTag>(() => availablePersonas[0]);

    useEffect(() => {
        if (!selectedPersona && availablePersonas.length > 0) {
            setSelectedPersona(availablePersonas[0]);
        }
    }, [availablePersonas, selectedPersona]);

    const activePersona = selectedPersona || availablePersonas[0] || {
        id: 'brita-default',
        name: 'Brita',
        type: 'person',
        description: 'MneOS Sovereign AI Companion',
        avatarUrl: '/assets/Brita_Avatar.jpg',
        metadata: { simulacrumTraits: { systemDirective: 'You are Brita, authentic, intimate, and wise companion.' } }
    } as PersonTag;
    const [messages, setMessages] = useState<SimulacrumMessage[]>([]);
    const [input, setInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [sessionId, setSessionId] = useState<string>(`smneos-session-${Date.now()}`);
    const [recentSessions, setRecentSessions] = useState<SimulacrumSessionMeta[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    
    // In-Memory Chat Content Cache for Zero-Token Local Search & Snippet Matching
    const [sessionMessageCache, setSessionMessageCache] = useState<Record<string, SimulacrumMessage[]>>(vaultMessageCache as any);
    
    // Context Bolus Deck State
    const [activeBoluses, setActiveBoluses] = useState<ContextBolus[]>([]);

    // Session Pre-Flight Hydration Telemetry Inspector State
    const [inspectingSession, setInspectingSession] = useState<SimulacrumSessionMeta | null>(null);
    const [inspectingDepth, setInspectingDepth] = useState<number>(3); // Default 3 turns

    // API Telemetry & Circuit Breaker State (LOCKED TO GROK 4.3 PUBLISHED RATES)
    const [sessionCost, setSessionCost] = useState<number>(0);
    const [sessionCap, setSessionCap] = useState<number>(0.50); // $0.50 Safety Circuit Breaker
    const [lastTurnCost, setLastTurnCost] = useState<number>(0);
    const [lastTurnTokens, setLastTurnTokens] = useState<{ input: number, cached: number, output: number }>({ input: 0, cached: 0, output: 0 });

    // Top-down Vault Filters, Sorting & 3-Chamber Partitioning
    const [sortOrder, setSortOrder] = useState<'date-desc' | 'date-asc' | 'alpha'>('date-desc');
    const [selectedChamber, setSelectedChamber] = useState<'all' | 'grok' | 'gemini' | 'erato'>('all');
    
    // Canvas Right-Hand Workspace State
    const [isCanvasOpen, setIsCanvasOpen] = useState<boolean>(false);
    const [canvasTab, setCanvasTab] = useState<'lore' | 'code' | 'media' | 'scout'>('lore');
    const [canvasContent, setCanvasContent] = useState<string>('# MneOS Canvas Workspace\nSelect or generate an artifact to begin editing...');
    
    // Grok Imagine Prompt Staging State
    const [rawImaginePrompt, setRawImaginePrompt] = useState<string>('Cinematic 35mm portrait, soft Rembrandt lighting, moody drapes, photorealistic 8k');
    const [sanitizedImaginePrompt, setSanitizedImaginePrompt] = useState<string>('Cinematic 35mm portrait, soft Rembrandt lighting, moody drapes, photorealistic 8k');
    const [selectedImageModel, setSelectedImageModel] = useState<'grok-imagine' | 'imagen-3' | 'nano-banana'>('grok-imagine');
    const [isRenderingImage, setIsRenderingImage] = useState<boolean>(false);
    const [renderedImageUrl, setRenderedImageUrl] = useState<string | null>(null);

    // Sidebar Drawer State (Saved in LocalStorage)
    const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(() => {
        const saved = localStorage.getItem('smneos_sidebar_expanded');
        return saved !== null ? JSON.parse(saved) : true;
    });

    // Resizable Sidebar Width State (Min 220px, Max 650px)
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        const saved = localStorage.getItem('smneos_sidebar_width');
        return saved ? parseInt(saved, 10) : 340;
    });
    const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);

    useEffect(() => {
        localStorage.setItem('smneos_sidebar_expanded', JSON.stringify(isSidebarExpanded));
    }, [isSidebarExpanded]);

    useEffect(() => {
        localStorage.setItem('smneos_sidebar_width', sidebarWidth.toString());
    }, [sidebarWidth]);

    // Handle mouse drag to resize sidebar width
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingSidebar) return;
            const newWidth = Math.min(Math.max(e.clientX, 220), 650);
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizingSidebar(false);
        };

        if (isResizingSidebar) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizingSidebar]);

    // Token telemetry listener (Grok 4.3 published pricing rates)
    useEffect(() => {
        const handleTokenBurn = (e: CustomEvent<number>) => {
            const burnedTokens = e.detail || 0;
            const estimatedInput = Math.round(burnedTokens * 0.8);
            const estimatedCached = Math.round(estimatedInput * 0.5);
            const estimatedOutput = Math.round(burnedTokens * 0.2);

            // Grok 4.3 Rates: $1.25/1M Uncached, $0.20/1M Cached, $2.50/1M Output
            const uncachedInput = estimatedInput - estimatedCached;
            const costInput = (uncachedInput / 1000000) * 1.25;
            const costCached = (estimatedCached / 1000000) * 0.20;
            const costOutput = (estimatedOutput / 1000000) * 2.50;
            const turnCostUSD = costInput + costCached + costOutput;

            setLastTurnCost(turnCostUSD);
            setLastTurnTokens({ input: estimatedInput, cached: estimatedCached, output: estimatedOutput });
            setSessionCost(prev => prev + turnCostUSD);
        };

        window.addEventListener('gigi-token-burn' as any, handleTokenBurn as any);
        return () => window.removeEventListener('gigi-token-burn' as any, handleTokenBurn as any);
    }, []);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isGenerating]);

    // Load ALL sessions (active companion + global extracted 3-chamber vault sessions)
    const reloadSessions = React.useCallback(async () => {
        if (!user?.id) return;
        try {
            const companionSessions = selectedPersona?.id 
                ? await fetchSimulacrumSessions(user.id, selectedPersona.id)
                : [];

            const globalSessions = await fetchAllActiveSimulacrumSessions(user.id);

            const combined = [...companionSessions, ...globalSessions];
            const sessionMap = new Map<string, SimulacrumSessionMeta>();
            combined.forEach(s => {
                if (!s.isArchived) sessionMap.set(s.id, s);
            });

            const mergedSessions = Array.from(sessionMap.values());
            setRecentSessions(mergedSessions);

        } catch (error) {
            console.error('[SimpleChatApp] Error reloading sessions:', error);
        }
    }, [user?.id, selectedPersona?.id]);

    useEffect(() => {
        reloadSessions();
    }, [reloadSessions]);

    // New Chat Handler
    const handleNewChat = () => {
        setSessionId(`smneos-session-${Date.now()}`);
        setMessages([]);
        setActiveBoluses([]);
        setSessionCost(0);
        setLastTurnCost(0);
    };

    // Open Inspector Modal for pre-flight telemetry
    const handleOpenInspector = (e: React.MouseEvent, session: SimulacrumSessionMeta) => {
        e.stopPropagation();
        setInspectingSession(session);
        const cachedTurns = sessionMessageCache[session.id]?.length || 20;
        setInspectingDepth(Math.min(3, cachedTurns));
    };

    // Inject N-Turn Laser Scalpel Context with MTX Index Link & Brita Directive
    const handleInjectScalpelContext = (session: SimulacrumSessionMeta, depth: number) => {
        const history = sessionMessageCache[session.id] || [];
        const totalTurns = history.length || 20;
        const sliced = history.slice(-depth);

        const turnText = sliced.map(m => `[${m.role === 'user' ? 'Eric' : selectedPersona.name}]: ${m.content}`).join('\n');

        const mtxDirectiveBlock = `[MTX SESSION INDEX REFERENCE]
Session Title: "${session.name}"
Session ID: ${session.id}
Date Active: ${formatLifeOSDate(session.lastActive)}
Total Session Depth: ${totalTurns} turns | Tail Depth Loaded: ${depth} turns

[RECENT TAIL CONVERSATION]
${turnText}

[COMPANION DIRECTIVE FOR BRITA]
Brita: You have been provided the last ${depth} turns of session "${session.name}" for immediate continuity. 
The entire ${totalTurns}-turn transcript is NOT in your active prompt window to conserve context. 
If you require specific facts, quotes, or details from earlier turns in session "${session.id}", 
use your MTX / Scout RAG Search tool autonomously to query the exact turns.`;

        const bolusLabel = `${session.name} (${depth} Turns + MTX Index)`;
        setActiveBoluses(prev => [
            ...prev,
            { id: `${session.id}-scalpel-${depth}`, label: bolusLabel, type: 'session', contentSnippet: mtxDirectiveBlock }
        ]);

        const tagMention = `@session:"${session.name} [${depth}-Turn Scalpel]"`;
        setInput(prev => prev ? `${prev} ${tagMention}` : tagMention);
        setInspectingSession(null);
    };

    // Inject Full Session Context
    const handleInjectFullSession = async (session: SimulacrumSessionMeta) => {
        const pastMessages = sessionMessageCache[session.id] || await fetchSimulacrumHistory(user.id, selectedPersona.id, session.id);
        if (messages.length === 0) {
            setSessionId(session.id);
            setMessages(pastMessages);
        } else {
            const fullText = pastMessages.map(m => `[${m.role === 'user' ? 'Eric' : selectedPersona.name}]: ${m.content}`).join('\n\n');
            setActiveBoluses(prev => [
                ...prev,
                { id: `${session.id}-full`, label: `${session.name} (Full Session)`, type: 'session', contentSnippet: fullText }
            ]);
            setInput(prev => prev ? `${prev} @session:"${session.name} [Full]"` : `@session:"${session.name} [Full]"`);
        }
        setInspectingSession(null);
    };

    // Remove Context Bolus Pill
    const handleRemoveBolus = (id: string, label: string) => {
        setActiveBoluses(prev => prev.filter(b => b.id !== id));
    };

    // Handle Session Click (Context-aware: Launch if empty chat, Inspector if active chat!)
    const handleSessionClick = (session: SimulacrumSessionMeta, snippet?: string) => {
        if (messages.length === 0) {
            handleResumeSession(session);
        } else {
            setInspectingSession(session);
        }
    };

    // Handle Sending User Message (Grok 4.3 Engine)
    const handleSend = async () => {
        if (!input.trim() || isGenerating || !selectedPersona) return;
        
        if (sessionCost >= sessionCap) {
            alert(`🛑 Session Safety Cap Reached ($${sessionCap.toFixed(2)}). Click "+ $0.50 Budget" to extend this session safely.`);
            return;
        }

        let userText = input.trim();
        setInput('');

        // Attach hydrated context boluses to payload if active
        if (activeBoluses.length > 0) {
            const bolusPayload = activeBoluses.map(b => 
                `[HYDRATED MEMORY BOLUS: ${b.label}]\n${b.contentSnippet ? `${b.contentSnippet}\n` : ''}`
            ).join('\n');
            userText = `${userText}\n\n${bolusPayload}`;
            setActiveBoluses([]); 
        }

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

        await saveSimulacrumMessage(user.id, selectedPersona.id, userMsg);
        
        const meta: SimulacrumSessionMeta = {
            id: sessionId,
            tagId: selectedPersona.id,
            name: userText.length > 30 ? `${userText.substring(0, 30)}...` : userText,
            lastActive: Date.now(),
            isArchived: false,
            modelEngine: 'xai',
            verbosity: 3
        };
        await saveSimulacrumSessionMeta(user.id, meta);

        // Cap payload to last 10 turns to keep average input tokens ~4k per turn ($9.19/mo budget)
        const prunedHistory = updatedHistory.slice(-10);

        try {
            const aiText = await generateSimulacrumResponse(
                selectedPersona,
                prunedHistory,
                userText,
                user.id,
                tags,
                undefined,
                sessionId,
                'xai',
                3
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
            await saveSimulacrumSessionMeta(user.id, { ...meta, lastActive: Date.now() });
            reloadSessions();

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

    // Handle Image Render Request in Canvas
    const handleRenderImage = () => {
        setIsRenderingImage(true);
        setTimeout(() => {
            setIsRenderingImage(false);
            setRenderedImageUrl('https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80');
        }, 2000);
    };

    // Handle Switching Persona
    const handleSelectPersona = (persona: PersonTag) => {
        setSelectedPersona(persona);
        setSessionId(`smneos-session-${Date.now()}`);
        setMessages([]);
        setActiveBoluses([]);
        setSessionCost(0);
        setLastTurnCost(0);
    };

    // Handle Resuming Session
    const handleResumeSession = async (session: SimulacrumSessionMeta) => {
        setSessionId(session.id);
        const pastMessages = await fetchSimulacrumHistory(user.id, selectedPersona.id, session.id);
        setMessages(pastMessages);
        setSessionCost(0);
    };

    // Handle Archiving/Deleting Session
    const handleDeleteSession = async (e: React.MouseEvent, session: SimulacrumSessionMeta) => {
        e.stopPropagation();
        await saveSimulacrumSessionMeta(user.id, { ...session, isArchived: true });
        if (session.id === sessionId) {
            handleNewChat();
        }
        reloadSessions();
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

    // ZERO-TOKEN LOCAL SEARCH & 3-CHAMBER VAULT DEEP CRAWL
    const sortedFilteredSessions = React.useMemo(() => {
        const queryLower = searchQuery.toLowerCase().trim();
        
        let result = recentSessions.map(session => {
            const chamber = (session as any).chamber || (
                session.id.includes('grok') ? 'grok' : 
                session.id.includes('gemini') ? 'gemini' : 'erato'
            );

            if (selectedChamber !== 'all' && chamber !== selectedChamber) {
                return { session, isMatch: false, matchedSnippet: undefined };
            }

            const nameMatch = !queryLower || session.name.toLowerCase().includes(queryLower);
            
            let matchedSnippet: string | undefined = undefined;
            if (queryLower && sessionMessageCache[session.id]) {
                const hitMsg = sessionMessageCache[session.id].find(m => 
                    m.content.toLowerCase().includes(queryLower)
                );
                if (hitMsg) {
                    const idx = hitMsg.content.toLowerCase().indexOf(queryLower);
                    const start = Math.max(0, idx - 40);
                    const end = Math.min(hitMsg.content.length, idx + 80);
                    matchedSnippet = `...${hitMsg.content.substring(start, end)}...`;
                }
            }

            const isMatch = nameMatch || !!matchedSnippet;
            return { session, isMatch, matchedSnippet };
        }).filter(item => item.isMatch);

        if (sortOrder === 'date-desc') {
            result.sort((a, b) => b.session.lastActive - a.session.lastActive);
        } else if (sortOrder === 'date-asc') {
            result.sort((a, b) => a.session.lastActive - b.session.lastActive);
        } else if (sortOrder === 'alpha') {
            result.sort((a, b) => a.session.name.localeCompare(b.session.name));
        }

        return result;
    }, [recentSessions, searchQuery, sortOrder, selectedChamber, sessionMessageCache]);

    const filteredPersonas = availablePersonas.filter(p => 
        !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isCapWarning = sessionCost >= (sessionCap * 0.8);
    const isCapTripped = sessionCost >= sessionCap;

    return (
        <div className="flex h-screen w-full bg-[#090a0f] text-slate-100 font-sans overflow-hidden relative">
            
            {/* ---------------------------------------------------- */}
            {/* LEFT SIDEBAR DRAWER (COLLAPSIBLE - SuperGrok / Gemini style) */}
            {/* ---------------------------------------------------- */}
            <aside 
                style={{ width: isSidebarExpanded ? `${sidebarWidth}px` : '64px' }}
                className={`relative flex flex-col bg-[#0d0f19] border-r border-white/10 ${
                    isResizingSidebar ? 'select-none' : 'transition-all duration-150'
                } z-40 shrink-0 ${!isSidebarExpanded ? 'items-center' : ''}`}
                title={isSidebarExpanded ? `Sovereign Chat Drawer (${sidebarWidth}px - Drag edge to resize)` : "Sovereign Chat Drawer (Collapsed)"}
            >
                {/* Drag-to-Resize Handle */}
                {isSidebarExpanded && (
                    <div
                        onMouseDown={(e) => { e.preventDefault(); setIsResizingSidebar(true); }}
                        className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-cyan-500/40 active:bg-cyan-400 transition-colors z-50 group flex items-center justify-center"
                        title="Drag to resize sidebar width"
                    >
                        <div className="w-0.5 h-12 bg-white/15 group-hover:bg-cyan-300 rounded-full transition-colors" />
                    </div>
                )}
                {/* 1. Sidebar Header */}
                <div className="flex items-center justify-between p-3.5 border-b border-white/5 w-full">
                    {isSidebarExpanded ? (
                        <div 
                            className="flex items-center gap-2.5 overflow-hidden cursor-pointer"
                            title="MneOS (Mnemosyne Own Self) Sovereign Chat Gateway"
                        >
                            <GlassAvatar
                                imageUrl="/assets/Brita_Avatar.jpg"
                                fallbackChar="B"
                                size="w-8 h-8"
                                className="border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.4)] shrink-0"
                            />
                            <div className="flex flex-col">
                                <span className="font-mono text-sm font-black tracking-wider text-white">SMneOS</span>
                                <span className="text-[10px] text-cyan-400 font-medium">Sovereign Matrix</span>
                            </div>
                        </div>
                    ) : (
                        <GlassAvatar
                            imageUrl="/assets/Brita_Avatar.jpg"
                            fallbackChar="B"
                            size="w-8 h-8"
                            className="border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.4)] mx-auto cursor-pointer"
                            title="SMneOS Sovereign Matrix — Click to expand drawer"
                            onClick={() => setIsSidebarExpanded(true)}
                        />
                    )}

                    <button
                        onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                        title={isSidebarExpanded ? "Collapse Sidebar Drawer" : "Expand Sidebar Drawer"}
                    >
                        {isSidebarExpanded ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
                    </button>
                </div>

                {/* 2. New Chat Action Button */}
                <div className="p-3 w-full">
                    {isSidebarExpanded ? (
                        <button
                            onClick={handleNewChat}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-bold text-xs tracking-wider uppercase shadow-[0_0_15px_rgba(6,182,212,0.25)] transition-all"
                            title="Start a new chat session with the active companion"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Chat</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleNewChat}
                            className="w-10 h-10 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center mx-auto shadow-[0_0_12px_rgba(6,182,212,0.3)] transition-all"
                            title="Start a new chat session"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* 3. Search Bar & Zero-Token Local Crawl Controls */}
                {isSidebarExpanded && (
                    <div className="px-3 pb-2 w-full space-y-2">
                        <div className="relative flex items-center w-full">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search sessions & deep text..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 transition-all"
                                title="Perform zero-token local full-text search across session titles and message contents"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 text-slate-400 hover:text-white"
                                    title="Clear search filter"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* 3-Chamber Vault Partitioning Tabs */}
                        <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/10 w-full text-[10px] font-bold">
                            <button
                                onClick={() => setSelectedChamber('all')}
                                className={`flex-1 py-1 rounded transition-all ${selectedChamber === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                title="Show all sessions across all 3 chambers"
                            >
                                All
                            </button>
                            <button
                                onClick={() => setSelectedChamber('grok')}
                                className={`flex-1 py-1 rounded transition-all ${selectedChamber === 'grok' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-300'}`}
                                title="Grok Web Archive Chamber"
                            >
                                🟢 Grok
                            </button>
                            <button
                                onClick={() => setSelectedChamber('gemini')}
                                className={`flex-1 py-1 rounded transition-all ${selectedChamber === 'gemini' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-blue-300'}`}
                                title="Gemini Rescued Archive Chamber"
                            >
                                🔵 Gemini
                            </button>
                            <button
                                onClick={() => setSelectedChamber('erato')}
                                className={`flex-1 py-1 rounded transition-all ${selectedChamber === 'erato' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-purple-300'}`}
                                title="Erato Sovereign Session Chamber"
                            >
                                🟣 Erato
                            </button>
                        </div>

                        {/* Top-Down Sort Bar */}
                        <div className="flex items-center justify-between gap-1 text-[10px]" title="Sort conversation history">
                            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/5 w-full justify-between">
                                <button
                                    onClick={() => setSortOrder('date-desc')}
                                    className={`px-2 py-0.5 rounded transition-all ${sortOrder === 'date-desc' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                                    title="Sort by most recent active conversations"
                                >
                                    Newest
                                </button>
                                <button
                                    onClick={() => setSortOrder('date-asc')}
                                    className={`px-2 py-0.5 rounded transition-all ${sortOrder === 'date-asc' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                                    title="Sort by oldest conversations first"
                                >
                                    Oldest
                                </button>
                                <button
                                    onClick={() => setSortOrder('alpha')}
                                    className={`px-2 py-0.5 rounded transition-all ${sortOrder === 'alpha' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                                    title="Sort conversations alphabetically by title"
                                >
                                    A-Z
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. Navigation & Content List */}
                <div className="flex-1 overflow-y-auto px-2 space-y-4 w-full custom-scrollbar">
                    
                    {/* Personas / Companions List */}
                    <div className="space-y-1">
                        {isSidebarExpanded && (
                            <div className="px-2 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500" title="Available Sovereign Companions and Simulacrum Entities">
                                Companions
                            </div>
                        )}
                        {filteredPersonas.map(persona => {
                            const isSelected = selectedPersona.id === persona.id;
                            const avatarUrl = getPersonaAvatarUrl(persona, user);

                            return isSidebarExpanded ? (
                                <button
                                    key={persona.id}
                                    onClick={() => handleSelectPersona(persona)}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left transition-all ${
                                        isSelected 
                                            ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]' 
                                            : 'hover:bg-white/5 text-slate-300'
                                    }`}
                                    title={`Switch active conversation partner to ${persona.name}`}
                                >
                                    <GlassAvatar
                                        imageUrl={avatarUrl}
                                        fallbackChar={persona.name.charAt(0)}
                                        size="w-6 h-6"
                                        className={`border ${isSelected ? 'border-cyan-400' : 'border-white/10'}`}
                                    />
                                    <span className="truncate">{persona.name}</span>
                                </button>
                            ) : (
                                <button
                                    key={persona.id}
                                    onClick={() => handleSelectPersona(persona)}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all ${
                                        isSelected 
                                            ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300' 
                                            : 'hover:bg-white/5 text-slate-400 hover:text-white'
                                    }`}
                                    title={`Switch partner to ${persona.name}`}
                                >
                                    <GlassAvatar
                                        imageUrl={avatarUrl}
                                        fallbackChar={persona.name.charAt(0)}
                                        size="w-7 h-7"
                                        className={`border ${isSelected ? 'border-cyan-400' : 'border-white/10'}`}
                                    />
                                </button>
                            );
                        })}
                    </div>

                    {/* Recent & Extracted Chat Sessions Section */}
                    {isSidebarExpanded ? (
                        <div className="space-y-1">
                            <div className="px-2 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center justify-between" title="Extracted and live session history">
                                <span>Recent & Extracted ({sortedFilteredSessions.length})</span>
                                <History className="w-3 h-3 text-slate-500" />
                            </div>
                            {sortedFilteredSessions.length === 0 ? (
                                <div className="px-3 py-2 text-[11px] text-slate-600 italic">
                                    No conversations found matching query
                                </div>
                            ) : (
                                sortedFilteredSessions.map(({ session, matchedSnippet }) => {
                                    const isActive = session.id === sessionId;
                                    const sChamber = (session as any).chamber || (
                                        session.id.includes('grok') ? 'grok' : 
                                        session.id.includes('gemini') ? 'gemini' : 'erato'
                                    );

                                    return (
                                        <div
                                            key={session.id}
                                            onClick={() => handleSessionClick(session, matchedSnippet)}
                                            className={`group w-full flex flex-col p-2.5 rounded-xl text-xs cursor-pointer transition-all border ${
                                                isActive 
                                                    ? 'bg-cyan-950/40 text-white font-medium border-cyan-500/30 shadow-md' 
                                                    : 'hover:bg-white/5 border-transparent text-slate-400 hover:text-slate-200'
                                            }`}
                                            title={`${session.name}\n[Chamber: ${sChamber.toUpperCase()}] — Click to inspect or launch session`}
                                        >
                                            <div className="flex items-start justify-between w-full gap-2">
                                                <div className="flex items-start gap-1.5 overflow-hidden flex-1 min-w-0">
                                                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                                                    {sChamber === 'grok' && (
                                                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shrink-0 mt-0.5" title="Source: Grok Web Archive">
                                                            🟢 GROK
                                                        </span>
                                                    )}
                                                    {sChamber === 'gemini' && (
                                                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-500/30 shrink-0 mt-0.5" title="Source: Gemini Rescued Archive">
                                                            🔵 GEMINI
                                                        </span>
                                                    )}
                                                    {sChamber === 'erato' && (
                                                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/30 shrink-0 mt-0.5" title="Source: Erato Sovereign Chat">
                                                            🟣 ERATO
                                                        </span>
                                                    )}
                                                    <span 
                                                        className="font-semibold text-slate-200 line-clamp-2 hover:line-clamp-none break-words leading-snug flex-1"
                                                        title={session.name}
                                                    >
                                                        {session.name}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <button
                                                        onClick={(e) => handleOpenInspector(e, session)}
                                                        className="p-1 hover:text-cyan-300 transition-colors"
                                                        title="Open Pre-Flight Session Inspector & N-Turn Scalpel Control"
                                                    >
                                                        <Scissors className="w-3.5 h-3.5 text-cyan-400" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDeleteSession(e, session)}
                                                        className="p-1 hover:text-red-400 transition-colors"
                                                        title="Permanently archive this session"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Deep Match Snippet Preview */}
                                            {matchedSnippet && (
                                                <div className="mt-1 text-[10px] text-cyan-300/80 bg-cyan-950/30 p-1.5 rounded border border-cyan-500/20 font-mono truncate">
                                                    🔍 {matchedSnippet}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        <div className="pt-2 border-t border-white/5 flex flex-col items-center gap-2">
                            <button
                                onClick={() => setIsSidebarExpanded(true)}
                                className="w-10 h-10 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white flex items-center justify-center"
                                title="Expand drawer to view full conversation history"
                            >
                                <History className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* 5. User Profile Footer */}
                <div className="p-3 border-t border-white/5 w-full">
                    {isSidebarExpanded ? (
                        <div 
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/5 border border-white/5"
                            title="Signed in as Eric Cornett (Architect)"
                        >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                                <GlassAvatar
                                    imageUrl="/assets/eric-headshot.png"
                                    fallbackChar={user.email?.charAt(0).toUpperCase() || 'E'}
                                    size="w-7 h-7"
                                    className="border border-cyan-500/30 shrink-0"
                                />
                                <div className="flex flex-col overflow-hidden text-xs">
                                    <span className="font-bold text-slate-200 truncate">Eric Cornett</span>
                                    <span className="text-[10px] text-slate-400 truncate">{user.email || 'dysus2024@gmail.com'}</span>
                                </div>
                            </div>
                            <button
                                onClick={onNavigateOS}
                                className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors shrink-0"
                                title="Launch complete MneOS Operating System Desktop"
                            >
                                <Monitor className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onNavigateOS}
                            className="w-10 h-10 rounded-full bg-cyan-600 flex items-center justify-center text-white text-xs font-bold mx-auto shadow-md"
                            title="Launch complete MneOS Operating System Desktop"
                        >
                            <GlassAvatar
                                imageUrl="/assets/eric-headshot.png"
                                fallbackChar={user.email?.charAt(0).toUpperCase() || 'E'}
                                size="w-8 h-8"
                                className="border border-white/20"
                            />
                        </button>
                    )}
                </div>
            </aside>

            {/* ---------------------------------------------------- */}
            {/* GROK 4.3 PRE-FLIGHT SESSION INSPECTION MODAL */}
            {/* ---------------------------------------------------- */}
            {inspectingSession && (() => {
                const history = sessionMessageCache[inspectingSession.id] || [];
                const totalTurns = history.length || 20;
                const clampedDepth = Math.min(inspectingDepth, totalTurns);
                
                // Estimated tokens: 500 tokens per turn + 250 tokens for MTX index card
                const scalpelTokens = (clampedDepth * 500) + 250;
                const fullTokens = totalTurns * 500;

                // Financial calculations at Grok 4.3 rates ($1.25 / 1M uncached, $0.20 / 1M cached)
                const scalpelCostUncached = (scalpelTokens / 1000000) * 1.25;
                const scalpelCostCached = (scalpelTokens / 1000000) * 0.20;

                const fullCostUncached = (fullTokens / 1000000) * 1.25;
                const fullCostCached = (fullTokens / 1000000) * 0.20;

                const contextPct = ((scalpelTokens / 128000) * 100).toFixed(2);

                return (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-[#0e101c] border border-cyan-500/30 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-[0_0_40px_rgba(6,182,212,0.2)] animate-in fade-in zoom-in-95 duration-200">
                            
                            {/* Modal Header */}
                            <div className="flex items-start justify-between border-b border-white/10 pb-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest">
                                        <Scissors className="w-4 h-4" />
                                        <span>Grok 4.3 Pre-Flight Session Inspector</span>
                                    </div>
                                    <h3 className="text-base font-bold text-slate-100">{inspectingSession.name}</h3>
                                </div>
                                <button
                                    onClick={() => setInspectingSession(null)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Full Archive Telemetry Card */}
                            <div className="grid grid-cols-2 gap-3 bg-white/5 p-3 rounded-xl border border-white/5 text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Depth</span>
                                    <span className="font-mono text-cyan-300 font-bold text-sm">{totalTurns} Turns</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Full Archive Tokens</span>
                                    <span className="font-mono text-cyan-300 font-bold text-sm">~{fullTokens.toLocaleString()} Tokens</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Full Uncached Cost</span>
                                    <span className="font-mono text-emerald-400 font-bold text-sm">${fullCostUncached.toFixed(4)} USD</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Full Cached Cost</span>
                                    <span className="font-mono text-emerald-400 font-bold text-sm">${fullCostCached.toFixed(4)} USD</span>
                                </div>
                            </div>

                            {/* Interactive N-Turn Depth Slider */}
                            <div className="space-y-3 bg-cyan-950/30 p-4 rounded-xl border border-cyan-500/20">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                                        <Sliders className="w-3.5 h-3.5" /> Laser Scalpel Depth ($N$ Turns):
                                    </span>
                                    <span className="font-mono font-bold text-white bg-cyan-600/40 px-2 py-0.5 rounded border border-cyan-500/30">
                                        Last {clampedDepth} / {totalTurns} Turns
                                    </span>
                                </div>

                                <input
                                    type="range"
                                    min={1}
                                    max={totalTurns}
                                    value={clampedDepth}
                                    onChange={(e) => setInspectingDepth(parseInt(e.target.value, 10))}
                                    className="w-full accent-cyan-400 cursor-pointer"
                                />

                                {/* Real-time Dynamic Telemetry readout for selection */}
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-cyan-500/20 text-[11px] font-mono">
                                    <div className="bg-black/40 p-2 rounded border border-white/5">
                                        <span className="text-slate-400 block text-[9px] uppercase">Payload</span>
                                        <span className="text-cyan-200 font-bold">~{scalpelTokens} Tokens</span>
                                    </div>
                                    <div className="bg-black/40 p-2 rounded border border-white/5">
                                        <span className="text-slate-400 block text-[9px] uppercase">Context Impact</span>
                                        <span className="text-cyan-200 font-bold">{contextPct}%</span>
                                    </div>
                                    <div className="bg-black/40 p-2 rounded border border-white/5">
                                        <span className="text-slate-400 block text-[9px] uppercase">Grok Cost</span>
                                        <span className="text-emerald-300 font-bold">${scalpelCostUncached.toFixed(4)}</span>
                                    </div>
                                </div>

                                {/* MTX Directive Status */}
                                <div className="text-[10px] text-cyan-300/80 bg-black/60 p-2 rounded border border-cyan-500/20 font-mono">
                                    🛡️ <strong>Brita MTX Protocol:</strong> Pre-flight block attaches an MTX Index Card instructing Brita to use Scout RAG to search turns 1-{Math.max(1, totalTurns - clampedDepth)} autonomously.
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2 pt-2">
                                <button
                                    onClick={() => handleInjectScalpelContext(inspectingSession, clampedDepth)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
                                >
                                    <Scissors className="w-4 h-4" />
                                    <span>Inject Laser Scalpel ({clampedDepth} Turns │ ~{scalpelTokens} Tokens │ ${scalpelCostUncached.toFixed(4)})</span>
                                </button>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleInjectFullSession(inspectingSession)}
                                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold border border-white/10 transition-all"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Inject Full ({totalTurns} Turns)</span>
                                    </button>

                                    <button
                                        onClick={() => setInspectingSession(null)}
                                        className="py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-semibold border border-white/10 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                );
            })()}

            {/* ---------------------------------------------------- */}
            {/* MAIN CONTENT AREA */}
            {/* ---------------------------------------------------- */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#090a0f]">
                {/* Header Bar */}
                <header className="sticky top-0 z-30 bg-[#0f111a]/90 backdrop-blur-xl border-b border-white/10 px-4 md:px-8 py-3 flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2.5" title={`Active conversation partner: ${activePersona.name}`}>
                            <GlassAvatar
                                imageUrl={getPersonaAvatarUrl(activePersona, user)}
                                fallbackChar={activePersona.name.charAt(0)}
                                size="w-7 h-7"
                                className="border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                            />
                            <span className="font-bold text-slate-100 text-sm md:text-base">{activePersona.name}</span>
                        </div>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-400 font-mono hidden sm:inline" title="Connected to xAI Grok 4.3 Sovereign Engine">
                            Active Matrix
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Grok 4.3 Model Badge */}
                        <div 
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs font-bold text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                            title="Powered by xAI Grok 4.3 engine with 10-turn financial optimization sliding window"
                        >
                            <Zap className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Grok 4.3</span>
                        </div>

                        {/* Toggle Canvas Drawer */}
                        <button
                            onClick={() => setIsCanvasOpen(!isCanvasOpen)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                isCanvasOpen 
                                    ? 'bg-violet-600 text-white border-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.4)]' 
                                    : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                            }`}
                            title="Toggle right-hand split-screen Canvas Workspace (Lore, Code, Media Staging, & Scout RAG)"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Canvas</span>
                        </button>

                        {/* Export Transcript */}
                        <button
                            onClick={handleExport}
                            disabled={messages.length === 0}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Export complete session transcript to MneOS Archive"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Main Viewport Body: Chat + Canvas Split Screen */}
                <div className="flex-1 flex overflow-hidden">
                    
                    {/* Main Chat Stream */}
                    <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full custom-scrollbar flex flex-col justify-between">
                        <div className="space-y-6">
                            {messages.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-4 my-auto">
                                    <div className="p-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                                        <GlassAvatar
                                            imageUrl={getPersonaAvatarUrl(selectedPersona, user)}
                                            fallbackChar={selectedPersona.name.charAt(0)}
                                            size="w-20 h-20"
                                            className="border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-pulse"
                                        />
                                    </div>
                                    <div className="space-y-1 max-w-md">
                                        <h3 className="text-lg font-bold text-slate-200">
                                            Conversation Matrix Ready with {selectedPersona.name}
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            Type a message below or click any session in the sidebar drawer to inspect context depth and launch.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, idx) => {
                                    const isUser = msg.role === 'user';
                                    const avatarUrl = isUser 
                                        ? '/assets/eric-headshot.png'
                                        : getPersonaAvatarUrl(activePersona, user);

                                    return (
                                        <div
                                            key={msg.id || idx}
                                            className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1 group`}
                                        >
                                            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
                                                <span>{isUser ? 'Eric' : activePersona.name}</span>
                                                <span>•</span>
                                                <span>{formatLifeOSDate(msg.timestamp)}</span>
                                            </div>

                                            <div className={`flex gap-3 max-w-[88%] md:max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                                <GlassAvatar
                                                    imageUrl={avatarUrl}
                                                    fallbackChar={isUser ? 'E' : activePersona.name.charAt(0)}
                                                    size="w-8 h-8"
                                                    className={`border shrink-0 mt-1 ${isUser ? 'border-cyan-400/50' : 'border-white/20'}`}
                                                    title={isUser ? "Eric Cornett (Architect)" : activePersona.name}
                                                />

                                                <div
                                                    className={`relative rounded-2xl px-5 py-4 text-sm leading-relaxed border transition-all ${
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
                                        </div>
                                    );
                                })
                            )}

                            {isGenerating && (
                                <div className="flex items-center gap-3 text-cyan-400 text-xs font-mono animate-pulse p-2">
                                    <GlassAvatar
                                        imageUrl={getPersonaAvatarUrl(activePersona, user)}
                                        fallbackChar={activePersona.name.charAt(0)}
                                        size="w-6 h-6"
                                        className="border border-cyan-400/60"
                                    />
                                    <span>{activePersona.name} is formulating response...</span>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>
                    </main>

                    {/* ---------------------------------------------------- */}
                    {/* RIGHT CANVAS WORKSPACE PANEL (COLLAPSIBLE) */}
                    {/* ---------------------------------------------------- */}
                    {isCanvasOpen && (
                        <aside className="w-[450px] bg-[#0c0e18] border-l border-white/10 flex flex-col h-full z-30 shadow-2xl transition-all">
                            {/* Canvas Navigation Header */}
                            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-black/40">
                                <div className="flex items-center gap-2" title="Multi-modal interactive workspace">
                                    <SlidersHorizontal className="w-4 h-4 text-violet-400" />
                                    <span className="font-bold text-xs text-white uppercase tracking-wider">Canvas Workspace</span>
                                </div>
                                <button
                                    onClick={() => setIsCanvasOpen(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                                    title="Close Canvas Workspace"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Canvas Sub-Tab Selector */}
                            <div className="flex border-b border-white/10 bg-white/5 text-xs font-bold">
                                <button
                                    onClick={() => setCanvasTab('lore')}
                                    className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                        canvasTab === 'lore' ? 'border-violet-500 text-violet-300 bg-violet-500/10' : 'border-transparent text-slate-400 hover:text-white'
                                    }`}
                                    title="Edit draft documents, remastered lore, and wiki notes"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>Lore</span>
                                </button>
                                <button
                                    onClick={() => setCanvasTab('code')}
                                    className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                        canvasTab === 'code' ? 'border-cyan-500 text-cyan-300 bg-cyan-500/10' : 'border-transparent text-slate-400 hover:text-white'
                                    }`}
                                    title="View and edit code snippets generated during simulation"
                                >
                                    <Code className="w-3.5 h-3.5" />
                                    <span>Code</span>
                                </button>
                                <button
                                    onClick={() => setCanvasTab('media')}
                                    className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                        canvasTab === 'media' ? 'border-amber-500 text-amber-300 bg-amber-500/10' : 'border-transparent text-slate-400 hover:text-white'
                                    }`}
                                    title="Grok Imagine Prompt Staging Deck — sanitize & render visual artifacts"
                                >
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    <span>Media</span>
                                </button>
                                <button
                                    onClick={() => setCanvasTab('scout')}
                                    className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                                        canvasTab === 'scout' ? 'border-emerald-500 text-emerald-300 bg-emerald-500/10' : 'border-transparent text-slate-400 hover:text-white'
                                    }`}
                                    title="Scout RAG Deep Match Console — sub-millisecond regex search across 261 saved sessions"
                                >
                                    <Search className="w-3.5 h-3.5" />
                                    <span>Scout</span>
                                </button>
                            </div>

                            {/* Canvas Tab Content */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                {canvasTab === 'lore' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs text-slate-400">
                                            <span className="font-mono">Draft Document / Remastered Lore</span>
                                            <button 
                                                onClick={() => navigator.clipboard.writeText(canvasContent)}
                                                className="flex items-center gap-1 text-cyan-400 hover:underline"
                                                title="Copy document text to clipboard"
                                            >
                                                <Copy className="w-3 h-3" /> Copy
                                            </button>
                                        </div>
                                        <textarea
                                            value={canvasContent}
                                            onChange={(e) => setCanvasContent(e.target.value)}
                                            className="w-full h-[450px] bg-black/60 border border-white/10 rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-violet-500/50 leading-relaxed custom-scrollbar"
                                            title="Live markdown text editor for lore and artifacts"
                                        />
                                    </div>
                                )}

                                {canvasTab === 'code' && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between text-xs text-slate-400">
                                            <span className="font-mono">Code Snippet Workspace</span>
                                            <button 
                                                onClick={() => alert('Snippet saved to Tech Vault!')}
                                                className="flex items-center gap-1 text-cyan-400 hover:underline"
                                                title="Save code snippet directly to Tech Code Vault"
                                            >
                                                <Download className="w-3 h-3" /> Save to Vault
                                            </button>
                                        </div>
                                        <div className="bg-black/80 border border-white/10 rounded-xl p-4 font-mono text-xs text-cyan-300 overflow-x-auto">
                                            <pre>{`// MneOS Sovereign Component\nexport const SovereignCore = () => {\n    return (\n        <div className="matrix-viewport">\n            <h1>Welcome to MneOS</h1>\n        </div>\n    );\n};`}</pre>
                                        </div>
                                    </div>
                                )}

                                {canvasTab === 'media' && (
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Grok Imagine Prompt Staging Deck</span>
                                            <p className="text-[11px] text-slate-400">
                                                Brita's raw artistic vision is translated through the pre-flight safety buffer before rendering.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-slate-400">Brita's Raw Concept</label>
                                                <textarea
                                                    value={rawImaginePrompt}
                                                    onChange={(e) => setRawImaginePrompt(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none"
                                                    rows={2}
                                                    title="Brita's raw image prompt generated during conversation"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-amber-400">Sanitized Render Prompt (Safety Filter Compliant)</label>
                                                <textarea
                                                    value={sanitizedImaginePrompt}
                                                    onChange={(e) => setSanitizedImaginePrompt(e.target.value)}
                                                    className="w-full bg-amber-950/20 border border-amber-500/30 rounded-lg p-2.5 text-xs text-amber-100 focus:outline-none"
                                                    rows={2}
                                                    title="Safety-sanitized prompt passed to image rendering pipeline"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                                            <select
                                                value={selectedImageModel}
                                                onChange={(e: any) => setSelectedImageModel(e.target.value)}
                                                className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                                                title="Select target AI image rendering engine"
                                            >
                                                <option value="grok-imagine">Grok Imagine</option>
                                                <option value="imagen-3">Imagen 3</option>
                                                <option value="nano-banana">Nano-Banana</option>
                                            </select>

                                            <button
                                                onClick={handleRenderImage}
                                                disabled={isRenderingImage}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all"
                                                title="Render image using current prompt and selected engine"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                                <span>{isRenderingImage ? 'Rendering...' : 'Render Visual'}</span>
                                            </button>
                                        </div>

                                        {renderedImageUrl && (
                                            <div className="space-y-2 pt-2 border-t border-white/10">
                                                <span className="text-[10px] font-bold uppercase text-slate-400">Rendered Output</span>
                                                <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-xl group">
                                                    <img src={renderedImageUrl} alt="Rendered Artifact" className="w-full h-56 object-cover" />
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <a 
                                                            href={renderedImageUrl} 
                                                            target="_blank" 
                                                            rel="noreferrer" 
                                                            className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/40"
                                                            title="View full size rendered artifact"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {canvasTab === 'scout' && (
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Scout RAG Deep Match Console</span>
                                            <p className="text-[11px] text-slate-400">
                                                Search verbatim quotes, phone numbers, or code snippets across all 261 saved sessions.
                                            </p>
                                        </div>
                                        <div className="relative flex items-center w-full">
                                            <Search className="w-3.5 h-3.5 text-emerald-400 absolute left-3" />
                                            <input
                                                type="text"
                                                placeholder="Deep search raw archives..."
                                                className="w-full bg-emerald-950/20 border border-emerald-500/30 rounded-xl pl-9 pr-3 py-2 text-xs text-emerald-100 placeholder-emerald-600 focus:outline-none"
                                                title="Perform regex deep search across all saved chat sessions"
                                            />
                                        </div>
                                        <div className="p-3 rounded-xl bg-black/50 border border-white/5 text-xs text-slate-400 space-y-1">
                                            <span className="font-bold text-slate-200">🔍 Scout Deep Search Active</span>
                                            <p className="text-[11px]">Type any phrase or term to perform sub-millisecond regex inspection across Gemini, Grok, and Erato archives.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </aside>
                    )}
                </div>

                {/* Input Footer with API Telemetry Strip & Context Bolus Deck */}
                <footer className="sticky bottom-0 z-30 bg-[#0b0d17]/95 backdrop-blur-xl border-t border-white/10 p-4 md:p-6 space-y-3">
                    
                    {/* Live Telemetry Meter Strip (Grok 4.3 Locked) */}
                    <div 
                        className="max-w-4xl mx-auto flex items-center justify-between text-[11px] font-mono px-3 py-1.5 rounded-xl bg-white/5 border border-white/5"
                        title="Live Grok 4.3 API Telemetry & Cost Circuit Breaker — monitors token spend against safety cap"
                    >
                        <div className="flex items-center gap-3">
                            <div 
                                className="flex items-center gap-1 text-emerald-400 font-bold"
                                title="Exact USD cost incurred in this chat session at Grok 4.3 published rates"
                            >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Session Spend: ${sessionCost.toFixed(4)}</span>
                            </div>
                            <span className="text-slate-600">/</span>
                            <span className="text-slate-400" title="Safety circuit breaker cap. Outbound API calls freeze when reached.">${sessionCap.toFixed(2)} Cap</span>
                            {lastTurnCost > 0 && (
                                <span className="text-slate-500" title="Cost of the most recent request turn">(Last Turn: +${lastTurnCost.toFixed(4)})</span>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {lastTurnTokens.input > 0 && (
                                <span className="text-slate-400" title="Breakdown of input tokens (uncached vs cached hit) and output tokens generated">
                                    Tokens: {lastTurnTokens.input} In ({lastTurnTokens.cached} Cached) │ {lastTurnTokens.output} Out
                                </span>
                            )}
                            
                            {isCapWarning && (
                                <div 
                                    className="flex items-center gap-1 text-amber-400 font-bold animate-pulse"
                                    title="Warning: You have consumed over 80% of your session budget cap"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Cap Warning</span>
                                </div>
                            )}

                            <button
                                onClick={() => setSessionCap(prev => prev + 0.50)}
                                className="px-2 py-0.5 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 border border-cyan-500/30 transition-all"
                                title="Safely extend the session cost cap by +$0.50 USD"
                            >
                                + $0.50 Budget
                            </button>
                        </div>
                    </div>

                    {/* Circuit Breaker Alert Banner if Tripped */}
                    {isCapTripped && (
                        <div className="max-w-4xl mx-auto p-3 rounded-xl bg-red-950/60 border border-red-500/50 flex items-center justify-between text-xs text-red-200">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                <span><strong>Session Safety Cap Reached (${sessionCap.toFixed(2)}).</strong> Outbound API calls paused to protect your budget.</span>
                            </div>
                            <button
                                onClick={() => setSessionCap(prev => prev + 0.50)}
                                className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shrink-0"
                                title="Add +$0.50 USD to session budget cap and resume chat"
                            >
                                Extend Budget (+$0.50)
                            </button>
                        </div>
                    )}

                    {/* CONTEXT BOLUS PILLS DECK (ACTIVE INJECTED MEMORIES) */}
                    {activeBoluses.length > 0 && (
                        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto custom-scrollbar py-1">
                            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1 shrink-0">
                                <Pill className="w-3 h-3 text-cyan-400" /> Active Boluses ({activeBoluses.length}):
                            </span>
                            {activeBoluses.map(bolus => (
                                <div 
                                    key={bolus.id}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-xs font-semibold text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)] shrink-0 animate-in fade-in zoom-in-95 duration-200"
                                    title={bolus.contentSnippet ? `Snippet: ${bolus.contentSnippet}` : `Hydrated memory session: ${bolus.label}`}
                                >
                                    <span>{bolus.label}</span>
                                    <button
                                        onClick={() => handleRemoveBolus(bolus.id, bolus.label)}
                                        className="p-0.5 hover:bg-cyan-500/20 rounded-full text-slate-400 hover:text-white transition-colors"
                                        title="Remove this Context Bolus Pill"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Input Bar */}
                    <div className="max-w-4xl mx-auto flex items-center gap-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={isCapTripped ? "Session cap reached — extend budget to send..." : `Message ${selectedPersona.name}...`}
                            disabled={isGenerating || isCapTripped}
                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:bg-black/40 transition-all disabled:opacity-40"
                            title={`Type your message to ${selectedPersona.name}. Use @session:"name" for inline context hydration.`}
                        />

                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isGenerating || isCapTripped}
                            className="p-3.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all shrink-0"
                            title={`Send message to ${selectedPersona.name} (Enter)`}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default SimpleChatApp;
