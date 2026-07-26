import React, { useState, useEffect, useRef } from 'react';
import { PersonTag, Tag } from '../types';
import { GlassCard } from './GlassCard';
import { GlassAvatar } from './GlassAvatar';
import { X, Send, BrainCircuit, Loader2, Settings, Plus, Archive, MessageSquare, Edit2, Trash2, Check, FastForward, AlertTriangle } from 'lucide-react';
import { WikiTagEditor } from './shared/WikiTagEditor';
import { SimulacrumMessage, fetchSimulacrumHistory, fetchSimulacrumSessions, saveSimulacrumMessage, generateAdversarialResponse, generateAdversarialReactionCheck, evaluateCrossTalkDominance, SimulacrumSessionMeta, fetchCageMatchSessions, fetchCageMatchHistory, saveCageMatchSessionMeta, saveCageMatchMessage, fetchRecentCageMatchSessionForTag } from '../services/ai/generators/simulacrumGenerator';
import { formatLifeOSDate } from '../utils/dateSanitizer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { exportSimulationTranscript } from '../services/ai/generators/transcriptExporter';
import CopyButton from './CopyButton';
import { appDataService } from '../services/serviceManager';
import { GrokPromptBuilder } from '../services/ai/GrokPromptBuilder';
import { db } from '../services/sovereignCore';
import { collection, getDocs, query } from '../services/sovereignDbAdapter';

const MemoizedCageMatchMessage = React.memo(({ msg, prevMsg, isUser, speakerName, bubbleColor, fontSizeClass }: any) => {
    const isCrossTalkCollision = msg.crossTalkId && prevMsg && prevMsg.crossTalkId === msg.crossTalkId;

    return (
        <div className={`flex flex-col mb-6 ${isUser ? 'items-end' : 'items-start'} ${isCrossTalkCollision ? '-mt-10 relative z-10' : ''}`}>
            <div className={`text-[10px] text-gray-500 mb-1.5 flex items-center gap-2 ${isUser ? 'mr-3 flex-row-reverse' : 'ml-3'}`}>
                {isCrossTalkCollision && (
                    <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                        Interrupting
                    </span>
                )}
                <span className={`font-black tracking-[0.2em] uppercase ${speakerName === "User (Moderator)" ? 'text-gray-400' : bubbleColor.includes('blue') ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {speakerName}
                </span>
                <span className="opacity-50">•</span>
                <span className="opacity-70 font-mono">{formatLifeOSDate(msg.timestamp)}</span>
            </div>
            <div className={`px-5 py-4 rounded-2xl border ${bubbleColor} max-w-[85%] relative group/bubble transition-all duration-300 ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'} ${isCrossTalkCollision ? 'shadow-[0_8px_30px_rgba(0,0,0,0.5)] border-t-amber-500/50' : ''}`}>
                <div className={`prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 ${fontSizeClass}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                    </ReactMarkdown>
                </div>
                <div className="absolute -bottom-3 -right-3 opacity-0 group-hover/bubble:opacity-100 transition-opacity z-10">
                    <CopyButton textToCopy={msg.content} className="shadow-lg hover:scale-110 bg-[#161821] border border-white/10" />
                </div>
            </div>
        </div>
    );
});

interface CageMatchGatewayProps {
    userId: string;
    allTags: Tag[];
    defaultTagAId?: string;
    resumeSessionId?: string;
    onClose: () => void;
}

const CustomDropdown = ({ value, options, onChange, placeholder }: any) => {
    const [isOpen, setIsOpen] = React.useState(false);
    return (
        <div className="relative">
            <button 
                type="button"
                className="w-full bg-[#161821] border border-white/10 rounded-lg p-3 text-white text-left flex justify-between items-center hover:bg-white/10 transition-colors shadow-inner"
                onClick={() => setIsOpen(!isOpen)}
            >
                {options.find((o: any) => o.id === value)?.name || placeholder}
                <span className="text-gray-400 text-xs">▼</span>
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute z-50 w-full mt-1 bg-[#1a1b26] border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                        {options.map((o: any) => (
                            <button
                                key={o.id}
                                type="button"
                                className="w-full text-left p-3 hover:bg-red-500/20 text-white transition-colors border-b border-white/5 last:border-0 flex justify-between items-center"
                                onClick={() => { onChange(o.id); setIsOpen(false); }}
                            >
                                <span className="font-medium text-slate-200">{o.name}</span>
                                {o.isCompanion && <span className="text-[10px] uppercase font-bold text-fuchsia-400 tracking-wider bg-fuchsia-400/10 px-2 py-0.5 rounded">AI Companion</span>}
                            </button>
                        ))}
                        {options.length === 0 && <div className="p-3 text-gray-500 text-sm">No qualified combatants found.</div>}
                    </div>
                </>
            )}
        </div>
    );
};

export const CageMatchGateway: React.FC<CageMatchGatewayProps> = ({
    userId,
    allTags,
    defaultTagAId,
    resumeSessionId,
    onClose
}) => {
    const [companionTags, setCompanionTags] = useState<PersonTag[]>([]);

    // Step 1: Compute simulacrum tags synchronously (no network required)
    const simulacrumTags = React.useMemo(() => {
        return allTags.filter(t =>
            t.type === 'person' &&
            t.metadata?.simulacrumTraits?.systemDirective &&
            t.metadata.simulacrumTraits.systemDirective.trim() !== ''
        ) as PersonTag[];
    }, [allTags]);

    // Step 2: Combine them dynamically for the dropdown
    const availableCombatants = React.useMemo(() => {
        return [...simulacrumTags, ...companionTags];
    }, [simulacrumTags, companionTags]);

    useEffect(() => {
        if (!userId) {
            console.warn('[CageMatchGateway] ⚠️ useEffect fired but userId is falsy — aborting companion fetch.');
            return;
        }

        console.log(`[CageMatchGateway] 🚀 Fetching companions for userId: ${userId}`);

        // Fetch AI Companions from the user profile ONCE per userId change
        appDataService.getUserProfile(userId).then(profile => {
            const companions = profile?.aiCompanions || [];
            const companionTraits = profile?.settings?.godModeSettings?.companionTraits || {};

            console.log(`[CageMatch] Profile loaded. Companions found: ${companions.length}`, companions.map((c: any) => c.name));

            const fetchedCompanionTags: PersonTag[] = companions.reduce((acc: PersonTag[], c: any) => {
                try {
                    const basePersona = GrokPromptBuilder.resolvePersonaPrompt(c);
                    const selfConcept = c.selfConceptSnapshot ? `\n\n[CURRENT SELF-CONCEPT]\n${c.selfConceptSnapshot}` : '';
                    const builtDirective = companionTraits[c.id]?.narrativeOverride || (basePersona + selfConcept);

                    acc.push({
                        id: c.id,
                        name: c.name,
                        type: 'person',
                        mainImageId: undefined,
                        mediaGallery: [],
                        description: "AI Companion",
                        privateNotes: "",
                        isPrivate: true,
                        tagIds: [],
                        mediaIds: [],
                        metadata: {
                            simulacrumTraits: {
                                systemDirective: builtDirective,
                            }
                        },
                        isCompanion: true
                    } as any);
                } catch (e: any) {
                    console.error(`[CageMatchGateway] ❌ Failed to map companion "${c.name}":`, e);
                    acc.push({
                        id: `error-${Date.now()}-${Math.random()}`,
                        name: `ERROR: ${c.name} (${e.message})`,
                        type: 'person',
                        description: "Mapping Error",
                        isCompanion: true
                    } as any);
                }
                return acc;
            }, []);

            if (companions.length > 0 && fetchedCompanionTags.length === 0) {
                 fetchedCompanionTags.push({
                    id: 'global-error',
                    name: 'ERROR: Mapping produced 0 valid combatants',
                    type: 'person',
                    isCompanion: true
                 } as any);
            }

            console.log(`[CageMatchGateway] ✅ Setting ${fetchedCompanionTags.length} companion tags into state.`);
            setCompanionTags(fetchedCompanionTags);
        }).catch(err => {
            console.error("[CageMatchGateway] ❌ getUserProfile call failed:", err);
        });
    }, [userId]); // Intentionally decoupled from allTags to prevent fetch-wipe loop

    const [selectedTagA, setSelectedTagA] = useState<PersonTag | null>(null);
    const [selectedTagB, setSelectedTagB] = useState<PersonTag | null>(null);

    // Set default A once availableCombatants are loaded
    useEffect(() => {
        if (defaultTagAId && availableCombatants.length > 0 && !selectedTagA) {
            const found = availableCombatants.find(t => t.id === defaultTagAId);
            if (found) setSelectedTagA(found);
        }
    }, [defaultTagAId, availableCombatants, selectedTagA]);

    const [isArenaActive, setIsArenaActive] = useState(false);

    // Auto-resume from prop
    useEffect(() => {
        if (resumeSessionId && availableCombatants.length > 0 && !isArenaActive) {
            // Fetch session to know the combatants
            const fetchSessionAndResume = async () => {
                const { fetchCageMatchSessions } = await import('../services/ai/generators/simulacrumGenerator');
                // We need the meta. We'll just fetch all sessions for the user and find this one.
                const metaRef = collection(db, 'cage_match_session_meta');
                const snap = await getDocs(query(metaRef));
                const allSessions = snap.docs.map(doc => doc.data() as SimulacrumSessionMeta);
                const targetSession = allSessions.find(s => s.id === resumeSessionId);
                let tagAId, tagBId;
                if (targetSession) {
                    if (targetSession.tagIds && targetSession.tagIds.length >= 2) {
                        tagAId = targetSession.tagIds[0];
                        tagBId = targetSession.tagIds[1];
                    } else if (targetSession.tagId && targetSession.tagId.includes('_vs_')) {
                        const parts = targetSession.tagId.split('_vs_');
                        tagAId = parts[0];
                        tagBId = parts[1];
                    }
                }
                
                if (tagAId && tagBId) {
                    const tagA = availableCombatants.find(t => t.id === tagAId);
                    const tagB = availableCombatants.find(t => t.id === tagBId);
                    if (tagA && tagB) {
                        setSelectedTagA(tagA);
                        setSelectedTagB(tagB);
                        if (targetSession && targetSession.modelEngine) setModelEngine(targetSession.modelEngine);
                        if (targetSession && targetSession.verbosity) setVerbosity(targetSession.verbosity);
                        handleInitializeArena(resumeSessionId);
                    }
                }
            };
            fetchSessionAndResume();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resumeSessionId, availableCombatants, isArenaActive]);

    const [scenePrompt, setScenePrompt] = useState("");
    const [isArchiving, setIsArchiving] = useState(false);

    const [sessions, setSessions] = useState<SimulacrumSessionMeta[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [history, setHistory] = useState<SimulacrumMessage[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [input, setInput] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeGenerator, setActiveGenerator] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isRenderReady, setIsRenderReady] = useState(false);
    const [estimatedTokenBurn, setEstimatedTokenBurn] = useState(0);
    const [tokenLimit, setTokenLimit] = useState(200000); // Configurable token flood alarm
    const [modelEngine, setModelEngine] = useState<'xai' | 'deepseek'>('xai');
    const [verbosity, setVerbosity] = useState<number>(3);

    const hasTrippedAlarm = tokenLimit > 0 && estimatedTokenBurn >= tokenLimit;

    useEffect(() => {
        const handleTokenBurn = (e: any) => {
            setEstimatedTokenBurn(prev => prev + (e.detail || 0));
        };
        window.addEventListener('gigi-token-burn', handleTokenBurn);
        return () => window.removeEventListener('gigi-token-burn', handleTokenBurn);
    }, []);

    const [scenePresets, setScenePresets] = useState<{id: string, name: string, prompt: string}[]>([]);

    useEffect(() => {
        appDataService.getUserProfile(userId).then(profile => {
            if (profile?.settings?.cageMatchPresets && profile.settings.cageMatchPresets.length > 0) {
                setScenePresets(profile.settings.cageMatchPresets);
            } else {
                const stored = localStorage.getItem('cage_match_scene_presets');
                if (stored) {
                    try { 
                        const parsed = JSON.parse(stored);
                        setScenePresets(parsed);
                        if (profile) {
                            appDataService.updateUserProfile(userId, {
                                settings: {
                                    ...(profile.settings || {}),
                                    cageMatchPresets: parsed
                                }
                            } as any);
                        }
                    } catch(e){}
                }
            }
        }).catch(console.error);
    }, [userId]);

    const handleSavePreset = async () => {
        if (!scenePrompt.trim()) return;
        const name = prompt("Enter a name for this scene preset:", "New Scene");
        if (!name) return;
        const newPreset = { id: Date.now().toString(), name, prompt: scenePrompt };
        const updated = [...scenePresets, newPreset];
        setScenePresets(updated);
        localStorage.setItem('cage_match_scene_presets', JSON.stringify(updated));
        
        try {
            const profile = await appDataService.getUserProfile(userId);
            if (profile) {
                await appDataService.updateUserProfile(userId, {
                    settings: {
                        ...(profile.settings || {}),
                        cageMatchPresets: updated
                    }
                } as any);
            }
        } catch(e) { console.error(e); }
    };

    const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!confirm("Delete this preset?")) return;
        const updated = scenePresets.filter(p => p.id !== id);
        setScenePresets(updated);
        localStorage.setItem('cage_match_scene_presets', JSON.stringify(updated));
        
        try {
            const profile = await appDataService.getUserProfile(userId);
            if (profile) {
                await appDataService.updateUserProfile(userId, {
                    settings: {
                        ...(profile.settings || {}),
                        cageMatchPresets: updated
                    }
                } as any);
            }
        } catch(e) { console.error(e); }
    };

    const [fontSizeLevel, setFontSizeLevel] = useState(1);
    const fontSizeClasses = ['prose-sm', 'prose-base', 'prose-lg', 'prose-xl'];
    const inputTextSizeClasses = ['text-xs', 'text-sm', 'text-base', 'text-lg'];

    const [reactionPendingA, setReactionPendingA] = useState(false);
    const [reactionPendingB, setReactionPendingB] = useState(false);
    const [isCheckingA, setIsCheckingA] = useState(false);
    const [isCheckingB, setIsCheckingB] = useState(false);

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    useEffect(() => {
        if (selectedTagA && selectedTagB) {
            fetchCageMatchSessions(userId, selectedTagA.id, selectedTagB.id).then(fetched => {
                setSessions(fetched.filter(s => !s.isArchived));
            });
        } else {
            setSessions([]);
        }
    }, [userId, selectedTagA, selectedTagB]);

    // Push local state changes to active session meta if we are in an active arena
    useEffect(() => {
        if (isArenaActive && currentSessionId) {
            const currentSession = sessions.find(s => s.id === currentSessionId);
            if (currentSession && (currentSession.modelEngine !== modelEngine || currentSession.verbosity !== verbosity)) {
                const updated = { ...currentSession, modelEngine, verbosity };
                saveCageMatchSessionMeta(userId, updated);
                setSessions(prev => prev.map(s => s.id === currentSessionId ? updated : s));
            }
        }
    }, [modelEngine, verbosity, isArenaActive, currentSessionId]);

    useEffect(() => {
        scrollToBottom();
    }, [history]);

    useEffect(() => {
        if (isArenaActive) {
            const timer = setTimeout(() => setIsRenderReady(true), 150);
            return () => clearTimeout(timer);
        } else {
            setIsRenderReady(false);
        }
    }, [isArenaActive]);


    // [ZEN COST GUARD] Reaction checks are now MANUAL only (triggered by user clicking "Check Reactions").
    // Previously this fired 2 xAI calls automatically after every message, doubling in React StrictMode dev.
    // The "Pass the Mic" buttons are the primary UI for advancing combatant turns.
    const handleCheckReactions = async () => {
        if (!selectedTagA || !selectedTagB || history.length === 0 || isGenerating) return;

        setIsCheckingA(true);
        setIsCheckingB(true);
        
        try {
            // FIRE BOTH SIMULTANEOUSLY (The Race Condition)
            const [checkA, checkB] = await Promise.all([
                generateAdversarialReactionCheck(selectedTagA, selectedTagB, history, userId, currentSessionId || undefined, modelEngine, allTags),
                generateAdversarialReactionCheck(selectedTagB, selectedTagA, history, userId, currentSessionId || undefined, modelEngine, allTags)
            ]);

            if (checkA.wantsToSpeak && checkB.wantsToSpeak) {
                // SIMULTANEOUS CROSS-TALK EVENT!
                setIsGenerating(true);
                setActiveGenerator("SIMULTANEOUS CROSS-TALK");
                const ctId = `ct-${Date.now()}`;
                
                // Decide roles for verbal chicken using a fast semantic arbiter
                const dominantAgent = await evaluateCrossTalkDominance(
                    selectedTagA, checkA.reasoning,
                    selectedTagB, checkB.reasoning,
                    currentSessionId || undefined,
                    modelEngine
                );
                
                const aYields = dominantAgent === 'B';
                const roleA = aYields ? 'yield' : 'push';
                const roleB = aYields ? 'push' : 'yield';
                
                // Fire generation simultaneously with roles assigned
                const [respA, respB] = await Promise.all([
                    generateAdversarialResponse(selectedTagA, selectedTagB, history, scenePrompt || null, userId, allTags, currentSessionId || undefined, modelEngine, true, roleA, verbosity),
                    generateAdversarialResponse(selectedTagB, selectedTagA, history, scenePrompt || null, userId, allTags, currentSessionId || undefined, modelEngine, true, roleB, verbosity)
                ]);

                // Order matters for history arrays. The yielder should technically appear "first" because they stopped talking earlier,
                // and the pusher should appear second to show they finished the thought.
                const msgFirst: SimulacrumMessage = { 
                    id: `msg-${Date.now()}-first`, 
                    role: 'model', 
                    content: aYields ? respA : respB, 
                    timestamp: Date.now(), 
                    tagId: aYields ? selectedTagA.id : selectedTagB.id, 
                    sessionId: currentSessionId || undefined, 
                    crossTalkId: ctId 
                };
                const msgSecond: SimulacrumMessage = { 
                    id: `msg-${Date.now()}-second`, 
                    role: 'model', 
                    content: aYields ? respB : respA, 
                    timestamp: Date.now() + 1, 
                    tagId: aYields ? selectedTagB.id : selectedTagA.id, 
                    sessionId: currentSessionId || undefined, 
                    crossTalkId: ctId 
                };
                
                setHistory(prev => [...prev, msgFirst, msgSecond]);
                
                if (currentSessionId) {
                    saveCageMatchMessage(userId, msgFirst);
                    saveCageMatchMessage(userId, msgSecond);
                    const currentSession = sessions.find(s => s.id === currentSessionId);
                    if (currentSession) {
                        saveCageMatchSessionMeta(userId, { ...currentSession, lastActive: Date.now(), modelEngine, verbosity });
                    }
                }
            } else {
                // Normal sequential queueing
                if (checkA.wantsToSpeak) setReactionPendingA(true);
                if (checkB.wantsToSpeak) setReactionPendingB(true);
            }
        } catch (error) {
            console.error("Failed to check reactions:", error);
        } finally {
            setIsCheckingA(false);
            setIsCheckingB(false);
            setIsGenerating(false);
            setActiveGenerator(null);
        }
    };


    const handleSendUserMessage = async () => {
        if (!input.trim() || !selectedTagA || !selectedTagB) return;
        const msgText = input;
        setInput('');
        
        const newMsg: SimulacrumMessage = {
            id: `msg-${Date.now()}`,
            role: 'user',
            content: msgText,
            timestamp: Date.now(),
            sessionId: currentSessionId || undefined
        };
        
        setHistory(prev => [...prev, newMsg]);
        
        if (currentSessionId) {
            saveCageMatchMessage(userId, newMsg);
            const currentSession = sessions.find(s => s.id === currentSessionId);
            if (currentSession) {
                const updated = { ...currentSession, lastActive: Date.now(), modelEngine, verbosity };
                saveCageMatchSessionMeta(userId, updated);
            }
        }
    };

    const handlePromptConstruct = async (responder: PersonTag, opponent: PersonTag) => {
        if (isGenerating) return;
        setIsGenerating(true);
        setActiveGenerator(responder.name);

        try {
            // Clear their pending reaction since we are prompting them now
            if (responder.id === selectedTagA?.id) setReactionPendingA(false);
            if (responder.id === selectedTagB?.id) setReactionPendingB(false);

            const responseText = await generateAdversarialResponse(
                responder,
                opponent,
                history,
                scenePrompt || null, // Pass scene prompt
                userId,
                allTags,
                currentSessionId || undefined,
                modelEngine,
                false,
                undefined,
                verbosity
            );

            const aiMsg: SimulacrumMessage = {
                id: `msg-${Date.now()}`,
                role: 'model',
                content: responseText,
                timestamp: Date.now(),
                tagId: responder.id,
                sessionId: currentSessionId || undefined
            };

            setHistory(prev => [...prev, aiMsg]);
            
            if (currentSessionId) {
                saveCageMatchMessage(userId, aiMsg);
                const currentSession = sessions.find(s => s.id === currentSessionId);
                if (currentSession) {
                    const updated = { ...currentSession, lastActive: Date.now(), modelEngine, verbosity };
                    saveCageMatchSessionMeta(userId, updated);
                }
            }
        } catch (error) {
            console.error("Adversarial failure:", error);
        } finally {
            setIsGenerating(false);
            setActiveGenerator(null);
        }
    };

    const handleArchiveTranscript = async () => {
        if (history.length === 0 || !selectedTagA || !selectedTagB) return;
        setIsArchiving(true);
        try {
            const currentSession = sessions.find(s => s.id === currentSessionId);
            const title = currentSession?.name || `Cage Match: ${selectedTagA.name} vs ${selectedTagB.name}`;
            const participants = [selectedTagA.name, selectedTagB.name, 'Moderator'];
            await exportSimulationTranscript(
                userId,
                title,
                history,
                participants,
                (msg) => {
                    if (msg.role === 'user') return 'Moderator';
                    return msg.tagId === selectedTagA.id ? selectedTagA.name : (msg.tagId === selectedTagB.id ? selectedTagB.name : 'Construct');
                }
            );
            alert("Transcript archived successfully!");
        } catch (error) {
            console.error("Failed to archive transcript:", error);
            alert("Failed to archive transcript");
        } finally {
            setIsArchiving(false);
        }
    };



    const handleInitializeArena = async (resumeSessionId?: string) => {
        setIsArenaActive(true);
        if (resumeSessionId) {
            setCurrentSessionId(resumeSessionId);
            setIsHistoryLoading(true);
            // the metadata (model/verbosity) was already restored in the mount useEffect
            const pastHistory = await fetchCageMatchHistory(userId, resumeSessionId);
            setHistory(pastHistory);
            setIsHistoryLoading(false);
        } else {
            const newSession: SimulacrumSessionMeta = {
                id: `cage-session-${Date.now()}`,
                tagId: `${selectedTagA!.id}_vs_${selectedTagB!.id}`,
                tagIds: [selectedTagA!.id, selectedTagB!.id],
                name: `${selectedTagA!.name} vs ${selectedTagB!.name}`,
                lastActive: Date.now(),
                isArchived: false,
                modelEngine,
                verbosity
            };
            await saveCageMatchSessionMeta(userId, newSession);
            setCurrentSessionId(newSession.id);
            setHistory([]);
        }
    };

    if (!isArenaActive) {
        if (resumeSessionId) {
            return (
                <div className="fixed inset-0 bg-[#0a0a0f] z-[200] flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-4" />
                    <h2 className="text-xl font-bold tracking-widest text-red-400 uppercase">Loading Arena State...</h2>
                </div>
            );
        }

        return (
            <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                <GlassCard className="w-full max-w-2xl p-8 border border-red-500/30">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-bold text-red-500 flex items-center gap-3">
                            <BrainCircuit className="text-red-500 w-8 h-8" />
                            Project: CAGE MATCH
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <label className="block text-sm font-semibold text-gray-400 mb-2">Select Combatant A</label>
                            <CustomDropdown 
                                value={selectedTagA?.id || ''}
                                options={availableCombatants}
                                onChange={(val: string) => setSelectedTagA(availableCombatants.find(t => t.id === val) || null)}
                                placeholder="-- Choose Persona --"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-400 mb-2">Select Combatant B</label>
                            <CustomDropdown 
                                value={selectedTagB?.id || ''}
                                options={availableCombatants}
                                onChange={(val: string) => setSelectedTagB(availableCombatants.find(t => t.id === val) || null)}
                                placeholder="-- Choose Persona --"
                            />
                        </div>
                    </div>

                    <div className="mb-8 border-t border-white/10 pt-6">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-semibold text-gray-400 flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                Stage Manager: Scene Settings (Optional)
                            </label>
                            {scenePresets.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <select 
                                        className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-300"
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                const preset = scenePresets.find(p => p.id === e.target.value);
                                                if (preset) setScenePrompt(preset.prompt);
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>-- Load Preset --</option>
                                        {scenePresets.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={(e) => {
                                            const selectEl = e.currentTarget.previousElementSibling as HTMLSelectElement;
                                            if (selectEl && selectEl.value) {
                                                handleDeletePreset(selectEl.value, e);
                                                selectEl.value = "";
                                            } else {
                                                alert("Select a preset to delete first.");
                                            }
                                        }}
                                        className="text-gray-500 hover:text-red-400 transition-colors"
                                        title="Delete Selected Preset"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="relative">
                            <textarea
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-gray-600 focus:border-red-500/50 outline-none h-32 resize-none pr-32"
                                placeholder="Set the scene... e.g. 'You are at a crowded cocktail party in 1920s New York...'"
                                value={scenePrompt}
                                onChange={(e) => setScenePrompt(e.target.value)}
                            />
                            {scenePrompt.trim() && (
                                <button 
                                    onClick={handleSavePreset}
                                    className="absolute bottom-3 right-3 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-white flex items-center gap-1 transition-colors"
                                    title="Save this prompt as a reusable Scene Preset"
                                >
                                    <Plus className="w-3 h-3" /> Save Preset
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 mt-8 max-w-sm mx-auto">
                        <button 
                            disabled={!selectedTagA || !selectedTagB || selectedTagA.id === selectedTagB.id}
                            onClick={() => handleInitializeArena()}
                            className="w-full px-8 py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold tracking-widest text-white transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                        >
                            INITIALIZE ARENA
                        </button>
                        
                        {sessions.length > 0 && selectedTagA && selectedTagB && selectedTagA.id !== selectedTagB.id && (
                            <div className="flex flex-col gap-2 mt-4 border-t border-white/10 pt-4">
                                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider text-center">Resume Existing Match</span>
                                {sessions.map(session => (
                                    <button
                                        key={session.id}
                                        onClick={() => handleInitializeArena(session.id)}
                                        className="w-full px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-white transition-colors flex justify-between items-center"
                                    >
                                        <span className="truncate">{session.name}</span>
                                        <span className="text-xs text-gray-500 shrink-0 ml-2">{formatLifeOSDate(session.lastActive, 'relative')}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </GlassCard>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col font-sans">
            {/* Header */}
            {/* Header */}
            <div className="sticky top-0 z-20 bg-[#0f1115]/95 backdrop-blur-xl border-b border-red-500/20 px-6 py-4 flex items-center justify-between gap-6 shadow-md shrink-0 overflow-x-auto custom-scrollbar">
                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2 shrink-0">
                        <BrainCircuit className="w-6 h-6 text-red-500 shrink-0" />
                        <h2 className="text-xl font-bold tracking-wider text-white flex items-center gap-2 whitespace-nowrap shrink-0">
                            ARENA MATRIX
                            <span className="text-[10px] font-mono text-red-400 bg-red-950/50 px-2 py-0.5 rounded-full border border-red-500/30 hidden sm:flex items-center gap-1 uppercase tracking-wider whitespace-nowrap shrink-0">
                                Combat Live
                            </span>
                        </h2>
                    </div>
                    <div className="hidden md:block h-6 w-px bg-white/20 mx-2 shrink-0"></div>
                    <div className="hidden md:flex items-center gap-4 text-sm font-medium text-gray-300 shrink-0">
                        <span className="text-blue-400 truncate max-w-[150px] shrink-0" title={selectedTagA?.name}>{selectedTagA?.name}</span>
                        <span className="text-slate-600 text-[10px] shrink-0">VS</span>
                        <span className="text-emerald-400 truncate max-w-[150px] shrink-0" title={selectedTagB?.name}>{selectedTagB?.name}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                    <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors shrink-0 ${hasTrippedAlarm ? 'bg-red-500/20 border-red-500 animate-pulse' : 'bg-white/5 border-white/10'}`} title="Flood Alarm: Limit token burn.">
                        <span className={`${hasTrippedAlarm ? 'text-red-400' : 'text-slate-400'} text-[10px] font-bold uppercase tracking-wider whitespace-nowrap`}>
                            {hasTrippedAlarm ? 'ALARM TRIPPED' : 'Burn'}
                        </span>
                        <span className={`text-xs font-mono ${hasTrippedAlarm ? 'text-red-300 font-bold' : 'text-slate-300'} shrink-0`}>
                            {estimatedTokenBurn.toLocaleString()}
                        </span>
                        <span className="text-slate-600 text-[10px] font-mono px-0.5 shrink-0">/</span>
                        <input 
                            type="number" 
                            className="bg-transparent border-b border-white/10 text-slate-300 text-xs w-16 focus:outline-none focus:border-red-500/50 shrink-0" 
                            value={tokenLimit} 
                            step="10000"
                            onChange={(e) => setTokenLimit(Number(e.target.value) || 0)}
                        />
                    </div>
                    {/* Verbosity Slider */}
                    <div className="hidden lg:flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 shrink-0" title="Verbosity (1 = Minimal, 5 = Verbose)">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap shrink-0">Length</span>
                        <input 
                            type="range" 
                            min="1" 
                            max="5" 
                            step="1" 
                            value={verbosity} 
                            onChange={(e) => setVerbosity(Number(e.target.value))} 
                            className="w-16 accent-red-500 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-mono text-red-400 font-bold w-3 text-center shrink-0">{verbosity}</span>
                    </div>
                    
                    {/* Engine Selection Toggle */}
                    <div className="hidden md:flex bg-black/40 rounded-lg overflow-hidden border border-white/10 text-[10px] font-bold tracking-wider uppercase shrink-0 whitespace-nowrap">
                        <button 
                            onClick={() => setModelEngine('xai')}
                            className={`px-3 py-1.5 transition-colors border-r border-white/10 shrink-0 ${modelEngine === 'xai' ? 'bg-red-500/20 text-red-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.2)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                            title="Use xAI Grok (Flagship)"
                        >
                            Grok 4.x
                        </button>
                        <button 
                            onClick={() => setModelEngine('deepseek')}
                            className={`px-3 py-1.5 transition-colors shrink-0 ${modelEngine === 'deepseek' ? 'bg-cyan-500/20 text-cyan-300 shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                            title="Use DeepSeek V3/V4 (Test Drive)"
                        >
                            DeepSeek
                        </button>
                    </div>

                    {history.length > 0 && (
                        <button 
                            onClick={handleArchiveTranscript}
                            disabled={isArchiving}
                            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg transition-colors text-[10px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0"
                        >
                            {isArchiving ? <Loader2 className="w-3 h-3 animate-spin shrink-0" /> : <Archive className="w-3 h-3 shrink-0" />}
                            {isArchiving ? "Archiving..." : "Archive MD/JSON"}
                        </button>
                    )}

                    <div className="hidden sm:flex bg-black/40 rounded-lg overflow-hidden border border-white/10 shrink-0 whitespace-nowrap">
                        <button onClick={() => setFontSizeLevel(Math.max(0, fontSizeLevel - 1))} disabled={fontSizeLevel === 0} className="px-3 py-1.5 hover:bg-white/10 text-slate-400 disabled:opacity-30 border-r border-white/10 text-xs font-serif font-bold transition-colors shrink-0">A-</button>
                        <button onClick={() => setFontSizeLevel(Math.min(3, fontSizeLevel + 1))} disabled={fontSizeLevel === 3} className="px-3 py-1.5 hover:bg-white/10 text-slate-400 disabled:opacity-30 text-xs font-serif font-bold transition-colors shrink-0">A+</button>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white shrink-0" title="Return to Settings">
                        <X className="w-6 h-6 shrink-0" />
                    </button>
                </div>
            </div>

            {/* Chat History */}
            <div className={`flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar transition-opacity duration-500 ${isRenderReady ? 'opacity-100' : 'opacity-0'}`}>
                <div className="max-w-4xl mx-auto space-y-6">
                    {isHistoryLoading ? (
                        <div className="flex flex-col items-center justify-center h-[40vh] text-gray-500">
                            <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-4" />
                            <p className="text-white font-mono uppercase tracking-widest animate-pulse">Loading Existing Simulation... Please Wait...</p>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[40vh] text-gray-500">
                            <BrainCircuit className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg">The Arena is empty.</p>
                            <p className="text-sm">Initiate the conversation or prompt a construct.</p>
                        </div>
                    ) : null}

                    {history.map((msg, index) => {
                        const prevMsg = index > 0 ? history[index - 1] : null;
                        const isCrossTalkCollision = msg.crossTalkId && prevMsg && prevMsg.crossTalkId === msg.crossTalkId;

                        const isUser = !msg.tagId;
                        const isA = msg.tagId === selectedTagA?.id;
                        const isB = msg.tagId === selectedTagB?.id;
                        const speakerName = isUser ? "User (Moderator)" : (isA ? selectedTagA?.name : selectedTagB?.name);
                        const bubbleColor = isUser 
                            ? "bg-slate-800/80 border-slate-600 shadow-[0_4px_15px_rgba(0,0,0,0.3)] text-white/90" 
                            : (isA 
                                ? "bg-blue-900/20 border-blue-500/30 shadow-[0_4px_20px_rgba(59,130,246,0.1)]" 
                                : "bg-emerald-900/20 border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.1)]");
                        
                        return (
                            <MemoizedCageMatchMessage 
                                key={msg.id} 
                                msg={msg} 
                                prevMsg={prevMsg} 
                                isUser={isUser} 
                                speakerName={speakerName} 
                                bubbleColor={bubbleColor} 
                                fontSizeClass={fontSizeClasses[fontSizeLevel]} 
                            />
                        );
                    })}

                    {isGenerating && (
                        <div className="flex flex-col mb-4">
                            <div className="text-xs text-gray-500 mb-1 ml-1 font-bold tracking-wide uppercase">
                                {activeGenerator}
                            </div>
                            <div className="p-4 rounded-xl border bg-white/5 border-white/10 max-w-[90%] flex items-center gap-3">
                                <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                                <span className="text-gray-400 italic font-medium">{activeGenerator} is typing...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input & Controls Deck */}
            <div className="bg-[#111] border-t border-white/10 p-4 shrink-0">
                <div className="max-w-4xl mx-auto flex flex-col gap-4">
                    {hasTrippedAlarm && (
                        <div className="bg-red-950/80 border border-red-500 rounded-lg p-3 text-red-400 text-sm font-bold flex items-center justify-center gap-2 animate-pulse">
                            <AlertTriangle className="w-5 h-5" /> 
                            FLOOD ALARM REDLINE TRIPPED. Arena locked to prevent excessive token burn. Increase threshold or end session.
                        </div>
                    )}
                    {/* User Input Row */}
                    <div className="flex gap-2 relative">
                        <div className="flex-1">
                            <WikiTagEditor
                                userId={userId}
                                value={input}
                                onChange={setInput}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendUserMessage();
                                    }
                                }}
                                placeholder="Moderate or interject here..."
                                className={`w-full bg-[#1A1C23] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 transition-colors ${inputTextSizeClasses[fontSizeLevel]}`}
                            />
                        </div>
                        <button
                            onClick={handleSendUserMessage}
                            disabled={!input.trim() || isGenerating || hasTrippedAlarm}
                            className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl px-6 flex items-center justify-center transition-colors"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Moderator Floor Controls */}
                    <div className="flex flex-wrap items-center justify-center gap-4 border-t border-white/5 pt-4 mt-2">
                        <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">Pass the Mic:</span>
                        
                        <button 
                            onClick={() => handlePromptConstruct(selectedTagA!, selectedTagB!)}
                            disabled={isGenerating || hasTrippedAlarm}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all text-sm font-medium disabled:opacity-50 ${
                                reactionPendingA 
                                    ? 'bg-blue-500/30 hover:bg-blue-500/40 text-white border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)] animate-pulse' 
                                    : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30'
                            }`}
                        >
                            <BrainCircuit className="w-4 h-4" />
                            {reactionPendingA ? `Let ${selectedTagA?.name} Interject!` : `Prompt ${selectedTagA?.name}`}
                            {isCheckingA && <Loader2 className="w-3 h-3 animate-spin ml-1 opacity-50" />}
                        </button>

                        {/* Manual reaction check — cost-efficient, fires 2 lightweight calls on demand */}
                        <button
                            onClick={handleCheckReactions}
                            disabled={isGenerating || isCheckingA || isCheckingB || history.length === 0 || hasTrippedAlarm}
                            title="Ask both constructs whether they want to react to the last message"
                            className="flex items-center gap-1 px-3 py-2 border border-white/10 rounded-lg transition-all text-xs font-medium text-gray-500 hover:text-gray-300 hover:border-white/20 disabled:opacity-30"
                        >
                            {(isCheckingA || isCheckingB) ? <Loader2 className="w-3 h-3 animate-spin" /> : <FastForward className="w-3 h-3" />}
                            Check Reactions
                        </button>

                        <button 
                            onClick={() => handlePromptConstruct(selectedTagB!, selectedTagA!)}
                            disabled={isGenerating || hasTrippedAlarm}
                            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all text-sm font-medium disabled:opacity-50 ${
                                reactionPendingB 
                                    ? 'bg-emerald-500/30 hover:bg-emerald-500/40 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse' 
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            }`}
                        >
                            <BrainCircuit className="w-4 h-4" />
                            {reactionPendingB ? `Let ${selectedTagB?.name} Interject!` : `Prompt ${selectedTagB?.name}`}
                            {isCheckingB && <Loader2 className="w-3 h-3 animate-spin ml-1 opacity-50" />}
                        </button>


                    </div>
                </div>
            </div>
        </div>
    );
};
