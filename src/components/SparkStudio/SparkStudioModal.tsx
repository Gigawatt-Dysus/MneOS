import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Search, X, Check, Save, Filter, Skull, Activity, Clock, User, Bot, AlertTriangle, RefreshCw, Globe, Command, Zap, History, FileText, ChevronRight, CornerDownRight, Sliders, Hash, Type, Thermometer, Wind, Pin, Trash2, Volume2, Download } from 'lucide-react';
import { NeuralRewriter } from '../shared/NeuralRewriter';
import { MarkdownEditor } from '../shared/MarkdownEditor';
import { typesenseService } from '../../services/typesenseService';
import { sanitizerService, PoisonedMessage, POISON_PATTERNS } from '../../services/ai/sanitizer';
import { rewriteMessage } from '../../services/ai/editorial';
import { VoiceService } from '../../services/ai/voiceService';
import { List } from 'react-window';
import { AutoSizer as AutoSizerPkg } from 'react-virtualized-auto-sizer';
import { appDataService } from '../../services/serviceManager';
import { cleanLabel } from '../../utils/formatters';
import { doc, getDoc, updateDoc, getDocs, getCountFromServer, arrayUnion } from '../../services/sovereignDbAdapter';
import { ChatMessage } from '../../types';
import { GlassAvatar } from '../GlassAvatar';
import { formatLifeOSDate } from '../../utils/dateSanitizer';
import { db } from '../../firebaseConfig';

const AutoSizer = AutoSizerPkg as any;

interface SparkStudioModalProps {
    userId: string;
    onClose: () => void;
    addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning', action?: { label: string, onClick: () => void }) => void;
    chatHistory?: any[];
    onDelete?: (index: number) => void;
    userPresets?: any[]; // [ZEN INJECT]
    onCommitSparkEdit?: (msgId: string, originalText: string, editedText: string) => void; // [ZEN]
}

type Mode = 'search' | 'healer' | 'vocalLab' | 'artGallery';

interface SelectionContext {
    text: string;
    msgId?: string; // If from List
    msgContent?: string; // If from List
    x: number;
    y: number;
    source: 'list' | 'editor';
}

export const SparkStudioModal: React.FC<SparkStudioModalProps> = ({ userId, onClose, addToast, chatHistory = [], onDelete, userPresets: injectedPresets, onCommitSparkEdit }) => {
    // Layout State
    const [mode, setMode] = useState<Mode>('search');
    const [isLoading, setIsLoading] = useState(false);
    const [confirmingVaporizeId, setConfirmingVaporizeId] = useState<string | null>(null); // [ZEN V27]

    // [ZEN V35] Vocal Lab State
    const [activeCompanion, setActiveCompanion] = useState<any>(null);
    const [tempVoiceId, setTempVoiceId] = useState('');
    const [tempShortDesc, setTempShortDesc] = useState('');
    const [tempLongDesc, setTempLongDesc] = useState('');
    const [testText, setTestText] = useState('My voice is my identity. Every word I speak is a thread in the tapestry of our shared history.');
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [voicePrintSeq, setVoicePrintSeq] = useState(1);
    const [sovereignMemex, setSovereignMemex] = useState<any>(null);

    // [ZEN V35] Fetch primary companion on mount
    useEffect(() => {
        const fetchCompanion = async () => {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setSovereignMemex(userData.sovereignMemex || null);
                const companions = userData.aiCompanions || [];
                const primary = companions.find((c: any) => c.isPrimary) || companions[0];
                if (primary) {
                    setActiveCompanion(primary);
                    setTempVoiceId(primary.voiceId || '');
                }
            }
        };
        fetchCompanion();
    }, [userId]);

    const handleSaveVocalProfile = async () => {
        if (!activeCompanion) return;
        setIsLoading(true);
        try {
            const newProfile = {
                id: tempVoiceId,
                name: tempShortDesc || 'Unnamed Profile',
                shortDesc: tempShortDesc,
                longDesc: tempLongDesc
            };

            const updatedProfiles = [...(activeCompanion.voiceProfiles || []), newProfile];
            const updatedCompanion = { 
                ...activeCompanion, 
                voiceId: tempVoiceId,
                voiceProfiles: updatedProfiles 
            };

            const userDocRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists()) {
                const currentCompanions = userSnap.data().aiCompanions || [];
                const newCompanions = currentCompanions.map((c: any) => 
                    c.id === activeCompanion.id ? updatedCompanion : c
                );
                await updateDoc(userDocRef, { aiCompanions: newCompanions });
                setActiveCompanion(updatedCompanion);
                if (typeof addToast === 'function') {
                    addToast("Vocal Identity secured app-wide.", "success");
                }
            }
        } catch (err: any) {
            if (typeof addToast === 'function') {
                addToast(`Vocal Sync Failed: ${err.message}`, "error");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestVocalPrint = async (isDownload: boolean = false) => {
        if (!tempVoiceId) {
            if (typeof addToast === 'function') {
                addToast("Neural Signal missing: Voice ID required.", "warning");
            }
            return;
        }
        setIsSynthesizing(true);
        try {
            if (isDownload) {
                // [ZEN V35] High-Fidelity Archival
                await VoiceService.download(testText, true, tempVoiceId);
                setVoicePrintSeq(p => p + 1);
                if (typeof addToast === 'function') {
                    addToast("Vocal Print archived to local storage.", "success");
                }
            } else {
                // Uses auto-detection for bicameral logic by default
                await VoiceService.speak(testText, true, tempVoiceId);
            }
        } catch (err: any) {
            if (typeof addToast === 'function') {
                addToast(`Synthesis Error: ${err.message}`, "error");
            }
        } finally {
            setIsSynthesizing(false);
        }
    };

    // Search State
    const [searchString, setSearchString] = useState('');
    const [results, setResults] = useState<ChatMessage[]>([]);
    const [poisonCandidates, setPoisonCandidates] = useState<PoisonedMessage[]>([]);

    // Editor State
    const [selectedMsg, setSelectedMsg] = useState<ChatMessage | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // [ZEN V2] Side-by-Side Review State
    const [healedResult, setHealedResult] = useState<string | null>(null);

    const workbenchInputRef = useRef<HTMLTextAreaElement>(null);

    // [ZEN NEW] Global Narrative Scope
    const [isGlobalScope, setIsGlobalScope] = useState(false);

    const [activeSelection, setActiveSelection] = useState<SelectionContext | null>(null);
    const [pendingEditorReplace, setPendingEditorReplace] = useState<{ text: string } | null>(null);

    // [ZEN V24] Cache Hydration State
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncTimedOut, setSyncTimedOut] = useState(false);
    const [lastCommittedId, setLastCommittedId] = useState<string | null>(null);
    const [winkId, setWinkId] = useState<string | null>(null);
    const syncTimerRef = useRef<any>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);

    // [ZEN COCKPIT] Workbench State
    const [showWorkbench, setShowWorkbench] = useState(false);
    
    // [ZEN COCKPIT] Executive Directive State (Required for Preset Management)
    const [executiveDirective, setExecutiveDirective] = useState('');
    const [tone, setTone] = useState(50);
    const [spice, setSpice] = useState(50);
    const [stinger, setStinger] = useState(0);
    const [rewriteLength, setRewriteLength] = useState<'short' | 'medium' | 'long'>('medium');

    // [ZEN V2.05] Custom Preset Engine
    // [ZEN FIX] Unified Source of Truth: Conversative Fallback
    const [localPresets, setLocalPresets] = useState<any[]>([]);
    // If injected presets are provided AND have content, use them. Otherwise, fallback to local fetch.
    const activePresets = (Array.isArray(injectedPresets) && injectedPresets.length > 0) ? injectedPresets : localPresets;

    // [ZEN EWO #119] Replicate ExecutiveDeck Filter Logic & Safety Mapping
    const customPills = useMemo(() => {
        const mapped = activePresets
            .filter(p => p.type === 'pill' || (p.label && !p.archived))
            .map(p => ({
                ...p,
                label: p.label || 'Unknown Directive',
                value: p.value || p.description || p.label
            }));

        // [ZEN DIAGNOSTIC] Verify Render Pipeline
        mapped.push({
            id: 'diag-001',
            label: 'DIAGNOSTIC OK',
            value: 'System Check',
            type: 'pill'
        });

        return mapped;
    }, [activePresets]);

    const [showPillNamer, setShowPillNamer] = useState(false);
    const [pillNameInput, setPillNameInput] = useState('');
    const [conflictPreset, setConflictPreset] = useState<any | null>(null);
    const [contextMenuPill, setContextMenuPill] = useState<{ id: string, x: number, y: number } | null>(null);

    useEffect(() => {
        // [ZEN FIX] Skip fetch ONLY if we have valid injected data
        if (injectedPresets && injectedPresets.length > 0) return;

        const fetchPresets = async () => {
            try {
                const presets = await appDataService.getUserPresets(userId);
                // Simple equality check to avoid loops
                if (JSON.stringify(localPresets) !== JSON.stringify(presets)) {
                    console.log("[Spark Studio] 💊 Presets Refined (Fallback Fetch)");
                    setLocalPresets(presets);
                }
            } catch (e) {
                console.error("Failed to fetch presets", e);
            }
        };
        fetchPresets();
    }, [userId, injectedPresets]);

    // [ZEN HELPER] Open Thesaurus (Granular)
    const [activeSuggestion, setActiveSuggestion] = useState<{ phrase: string, alternatives: string[], x: number, y: number } | null>(null);

    const handlePhraseClick = async (phrase: string, event: React.MouseEvent) => {
        event.stopPropagation();
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        setActiveSuggestion({ phrase, alternatives: [], x: rect.left, y: rect.bottom + 5 });
        try {
            const alts = await sanitizerService.suggestAlternatives(phrase, selectedMsg?.content || "");
            setActiveSuggestion(prev => prev ? { ...prev, alternatives: alts } : null);
        } catch (e) { setActiveSuggestion(null); }
    };

    const applySuggestion = (original: string, replacement: string) => {
        const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedOriginal, 'i');
        const newContent = editorContent.replace(regex, replacement);
        setEditorContent(newContent);
        setHasUnsavedChanges(true);
        setActiveSuggestion(null);
        addToast(`Swapped "${original}" for "${replacement}"`, 'success');
    };

    // [ZEN REWIRE] Global Selection Listener (The "Handle")
    const handleGlobalMouseUp = (e: React.MouseEvent) => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

        const text = selection.toString().trim();
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Check if in List or Editor
        let target = e.target as HTMLElement;
        const listCard = target.closest('[data-msg-id]');
        const editorPane = target.closest('.spark-editor-pane');

        if (listCard) {
            const msgId = listCard.getAttribute('data-msg-id');
            const msgContent = listCard.getAttribute('data-msg-content');
            setActiveSelection({
                text, msgId: msgId || undefined, msgContent: msgContent || undefined,
                x: rect.left + (rect.width / 2), y: rect.top - 10, source: 'list'
            });
        } else if (editorPane) {
            setActiveSelection({
                text, x: rect.left + (rect.width / 2), y: rect.top - 10, source: 'editor'
            });
        }
    };

    // [ZEN COCKPIT] Scalpel -> Open Workbench
    const handleScalpelClick = (e: React.MouseEvent) => {
        e.stopPropagation(); e.preventDefault();
        if (!activeSelection) return;

        setHealedResult(null);

        // Load correct message into editor if from list
        if (activeSelection.source === 'list' && activeSelection.msgId) {
            const msg = (chatHistory || []).find(m => m.id === activeSelection.msgId) || results.find(m => m.id === activeSelection.msgId);
            if (msg) {
                setSelectedMsg(msg);
                setEditorContent(msg.content);
                setHasUnsavedChanges(false);
            }
        }

        setPendingEditorReplace({ text: activeSelection.text });
        setShowWorkbench(true);
        setActiveSelection(null);
    };

    // [ZEN COCKPIT] Auto-Focus Workbench
    useEffect(() => {
        if (showWorkbench) {
            setTimeout(() => workbenchInputRef.current?.focus(), 150);
        }
    }, [showWorkbench]);

    const applyPillEffect = (pill: string) => {
        // Handled by NeuralRewriter now
    };

    const executeExecutiveRewrite = async () => {
        // Handled by NeuralRewriter now
    };

    // [ZEN HELPER] Custom Preset Logic
    const checkDuplicateName = (name: string) => {
        const sanitized = cleanLabel(name);
        return activePresets.find(p => cleanLabel(p.label) === sanitized);
    };

    const handleSaveAsNew = () => {
        let baseName = cleanLabel(pillNameInput);
        let version = 2;
        let newName = `${baseName} (v${version})`;
        while (checkDuplicateName(newName)) {
            version++;
            newName = `${baseName} (v${version})`;
        }
        setPillNameInput(newName);
        setConflictPreset(null);
    };

    const handleSavePreset = async (overwrite: boolean = false) => {
        const sanitized = cleanLabel(pillNameInput);
        if (!sanitized) return;

        let presetToSave: any = {
            label: sanitized,
            value: executiveDirective,
            tone,
            spice,
            stinger,
            length: rewriteLength
        };

        if (overwrite && conflictPreset) {
            presetToSave.id = conflictPreset.id;
        } else {
            const collision = checkDuplicateName(pillNameInput);
            if (collision) {
                setConflictPreset(collision);
                return;
            }
        }

        try {
            await appDataService.saveUserPreset(userId, presetToSave);
            addToast(overwrite ? "Preset updated successfully." : "Preset saved to Laboratory.", "success");
            setShowPillNamer(false);
            setConflictPreset(null);
            setPillNameInput('');
            // [ZEN FIX] Only update local state if not driven by props
            if (!injectedPresets) {
                const updated = await appDataService.getUserPresets(userId);
                setLocalPresets(updated);
            }
        } catch (e: any) {
            addToast(`Failed to save preset: ${e.message}`, "error");
        }
    };

    const handleDeletePreset = async (presetId: string) => {
        // [ZEN V2.05] LifeOS Confirmation Toast Logic (Simulated via confirm for now, as per PACT)
        if (!confirm("Are you sure you want to delete this preset from the Laboratory? This cannot be undone.")) return;
        try {
            await appDataService.deleteUserPreset(userId, presetId);
            addToast("Preset airlocked.", "info");
            if (!injectedPresets) {
                const updated = await appDataService.getUserPresets(userId);
                setLocalPresets(updated);
            }
            setContextMenuPill(null);
        } catch (e: any) {
            addToast(`Deleter Failure: ${e.message}`, "error");
        }
    };

    const applyUserPreset = (preset: any) => {
        // Handled by NeuralRewriter now
    };

    const handleRightClickPill = (e: React.MouseEvent, presetId: string) => {
        e.preventDefault();
        setContextMenuPill({ id: presetId, x: e.clientX, y: e.clientY });
    };

    useEffect(() => {
        const handleDown = () => setContextMenuPill(null);
        window.addEventListener('mousedown', handleDown);
        return () => window.removeEventListener('mousedown', handleDown);
    }, []);

    const commitHeal = () => {
        if (!healedResult || !selectedMsg) return;
        
        if (onCommitSparkEdit && selectedMsg.id) {
            onCommitSparkEdit(selectedMsg.id, selectedMsg.content, healedResult);
            addToast("Spark Edit Committed and Harvested.", "success");
            setResults(prev => prev.map(m => m.id === selectedMsg.id ? { ...m, content: healedResult, isHealed: true } : m));
            setHasUnsavedChanges(false);
            setHealedResult(null);
        } else {
            handleSave(healedResult);
        }
    };

    // [ZEN LOCK] Sync Verification Loop
    useEffect(() => {
        if (!isSyncing || !selectedMsg || !lastCommittedId) return;

        const freshMsg = chatHistory.find(m => m.id === lastCommittedId);
        if (freshMsg && freshMsg.content === editorContent) {
            console.log("[Spark Lock] ✅ Cache Hydrated. Closing Handshake.");
            setIsSyncing(false);
            setSyncTimedOut(false);
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

            // Cleanup States
            setHealedResult(null);
            setPendingEditorReplace(null);
            setExecutiveDirective('');

            // [ZEN SAFETY PIN 2] Wink & Scroll
            setWinkId(lastCommittedId);
            setTimeout(() => {
                const element = document.querySelector(`[data-msg-id="${lastCommittedId}"]`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
            setTimeout(() => setWinkId(null), 2000);
        }
    }, [chatHistory, isSyncing, lastCommittedId, editorContent, selectedMsg]);

    const forceSyncRelease = () => {
        console.warn("[Spark Lock] ⚠️ Manual Force Release Triggered.");
        setIsSyncing(false);
        setSyncTimedOut(false);
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        setHealedResult(null);
        setPendingEditorReplace(null);
        setExecutiveDirective('');
        addToast("Sync released manually.", "info");
    };

    // Debounce Search Logic
    useEffect(() => {
        if (mode === 'healer') return;
        if (isGlobalScope && !searchString.trim()) { setResults(chatHistory || []); return; }
        const delayDebounceFn = setTimeout(async () => {
            if (searchString.trim()) {
                setIsLoading(true);
                const hits = await typesenseService.searchChatSegments(searchString, userId, 250);
                setResults(hits as ChatMessage[]);
                setIsLoading(false);
            } else { setResults([]); }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchString, userId, mode, isGlobalScope, chatHistory]);

    // Handlers
    const handleSelectMessage = (msg: ChatMessage) => {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        if (hasUnsavedChanges && !confirm("Discard unsaved changes?")) return;
        setSelectedMsg(msg);
        setEditorContent(msg.content);
        setHasUnsavedChanges(false);
        setHealedResult(null);
        setPendingEditorReplace(null);
    };

    // [ZEN V36] Bi-directional Temporal Sandwich Calculation
    const temporalSandwich = useMemo(() => {
        if (!selectedMsg || !chatHistory.length) return { ante: [], sub: [] };
        const index = chatHistory.findIndex(m => m.id === selectedMsg.id);
        if (index === -1) return { ante: [], sub: [] };
        
        return {
            ante: chatHistory.slice(Math.max(0, index - 3), index),
            sub: chatHistory.slice(index + 1, index + 4)
        };
    }, [selectedMsg, chatHistory]);

    const handleSave = async (newContent: string) => {
        if (!selectedMsg) return;
        try {
            // [ZEN SAFETY PIN 1] Set Syncing + Timeout
            setIsSyncing(true);
            setSyncTimedOut(false);
            setLastCommittedId(selectedMsg.id || null);
            setEditorContent(newContent); // Ensure local state matches what we expect in DB

            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
            syncTimerRef.current = setTimeout(() => {
                setSyncTimedOut(true);
            }, 5000);

            await sanitizerService.commitHealing(userId, selectedMsg, newContent);
            if (typeof addToast === 'function') {
                addToast("Signal patched and synced.", 'success');
            }
            setResults(prev => prev.map(m => m.id === selectedMsg.id ? { ...m, content: newContent, isHealed: true } : m));
            setHasUnsavedChanges(false);
        } catch (e: any) {
            if (typeof addToast === 'function') {
                addToast(`Save Failed: ${e.message}`, 'error');
            }
            setIsSyncing(false);
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        }
    };

    const visibleMessages = useMemo(() => {
        return (isGlobalScope && !searchString.trim()) ? (chatHistory || []) : results;
    }, [isGlobalScope, searchString, chatHistory, results]);

    return createPortal(
        <div className="fixed inset-0 z-[9990] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-200" onMouseUp={handleGlobalMouseUp}>
            <div className="w-[95vw] h-[90vh] max-w-[1800px] bg-[#0f1012] border border-white/10 rounded-3xl shadow-2xl flex overflow-hidden ring-1 ring-white/10">

                {/* 1. SIDEBAR */}
                <div className="w-80 md:w-96 border-r border-white/5 flex flex-col bg-[#131416]">
                    <div className="p-4 border-b border-white/5 space-y-4">
                        <div className="flex items-center gap-2 text-white/90 font-bold uppercase tracking-widest text-sm">
                            <Sparkles className="text-violet-400" /> Spark Studio
                        </div>

                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2 mt-6 mb-2">Modes</p>
                        <div className="space-y-1">
                            <button
                                onClick={() => setMode('search')}
                                className={`w-full py-2 px-3 rounded-xl flex items-center gap-3 transition-all ${mode === 'search' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'}`}
                            >
                                <Search size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Historian</span>
                            </button>
                            <button
                                onClick={() => setMode('vocalLab')}
                                className={`w-full py-2 px-3 rounded-xl flex items-center gap-3 transition-all ${mode === 'vocalLab' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'}`}
                            >
                                <Volume2 size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Vocal Lab</span>
                            </button>
                            <button
                                onClick={() => setMode('artGallery')}
                                className={`w-full py-2 px-3 rounded-xl flex items-center gap-3 transition-all ${mode === 'artGallery' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'}`}
                            >
                                <Zap size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Neural Art</span>
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                setIsGlobalScope(!isGlobalScope);
                                if (!isGlobalScope) {
                                    setResults(chatHistory || []);
                                }
                            }}
                            className={`w-full py-2 px-3 rounded-lg border transition-all flex items-center justify-between group ${isGlobalScope ? 'bg-violet-900/30 border-violet-500/50 text-violet-200' : 'bg-black/20 border-white/5 text-slate-500 hover:border-violet-500/30'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Globe size={12} className={isGlobalScope ? "text-cyan-400 animate-pulse" : "text-slate-600"} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Global Narrative Scope</span>
                            </div>
                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${isGlobalScope ? 'bg-cyan-600' : 'bg-slate-700'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full shadow-md transition-transform ${isGlobalScope ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                        </button>

                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-violet-400 transition-colors" size={14} />
                            <input value={searchString} onChange={(e) => setSearchString(e.target.value)} placeholder="Search Matrix..." className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 focus:bg-black/40 transition-all placeholder:text-slate-600" />
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col p-2 min-h-0 bg-black/10" ref={listContainerRef}>
                        <div className="h-full overflow-y-auto custom-scrollbar p-2">
                            {visibleMessages.map((msg, index) => (
                                <div key={msg.id || index} style={{ padding: '4px' }}>
                                    <div
                                        data-msg-id={msg.id}
                                        data-msg-content={msg.content}
                                        onClick={() => handleSelectMessage(msg)}
                                        className={`p-3 rounded-lg border cursor-pointer group transition-all duration-200 relative overflow-hidden
                                            ${selectedMsg?.id === msg.id ? 'bg-violet-600/10 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.1)]' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/5'}
                                            ${winkId === msg.id ? 'ring-2 ring-emerald-500 animate-pulse border-emerald-500/50' : ''}
                                        `}
                                    >
                                        {winkId === msg.id && <div className="absolute inset-0 bg-emerald-500/10 animate-ping pointer-events-none" />}
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-2">
                                                {msg.role === 'user' ? <User size={12} className="text-cyan-400" /> : <Bot size={12} className="text-violet-400" />}
                                                <span className={`text-[10px] font-bold uppercase ${msg.role === 'user' ? 'text-cyan-400' : 'text-violet-400'}`}>{msg.role === 'user' ? 'Operator' : (msg.author?.name || 'AI')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] text-slate-600 font-mono">
                                                    {formatLifeOSDate(msg.timestamp, 'day')}
                                                </span>

                                                {/* [ZEN V27] Vaporizer Mounting */}
                                                {!msg.isDeleted && onDelete && (
                                                    <div className="flex items-center gap-1">
                                                        {confirmingVaporizeId === msg.id ? (
                                                            <div className="flex items-center gap-1 animate-in slide-in-from-right-1 duration-200">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setConfirmingVaporizeId(null); }}
                                                                    className="text-slate-500 hover:text-white"
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const idx = chatHistory.findIndex(m => m.id === msg.id);
                                                                        if (idx !== -1) onDelete(idx);
                                                                        setConfirmingVaporizeId(null);
                                                                    }}
                                                                    className="bg-red-600 text-[8px] font-black uppercase px-2 py-0.5 rounded text-white shadow-lg active:scale-95 whitespace-nowrap"
                                                                >
                                                                    Vaporize?
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setConfirmingVaporizeId(msg.id || null); }}
                                                                className="p-1 text-slate-600 hover:text-red-400 transition-colors opacity-40 group-hover:opacity-100"
                                                                title="Vaporize Signal"
                                                            >
                                                                <Trash2 size={10} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-400 line-clamp-2">{msg.content}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. MAIN EDITOR */}
                <div className="flex-1 bg-[#0f1012] flex flex-col relative h-full min-h-0 spark-editor-pane">
                    <div className="absolute top-4 right-4 z-[10010]">
                        <button onClick={onClose} className="p-3 bg-black/40 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded-full transition-all backdrop-blur-md border border-white/5 shadow-xl">
                            <X size={20} />
                        </button>
                    </div>

                    {mode === 'vocalLab' ? (
                        <div className="flex-1 flex overflow-hidden animate-in fade-in duration-500">
                            {/* Left Panel: Identity Config */}
                            <div className="w-[450px] border-r border-white/5 flex flex-col bg-[#131416]/50">
                                <div className="p-6 border-b border-white/5 bg-gradient-to-r from-cyan-600/10 to-transparent">
                                    <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
                                        <Volume2 className="text-cyan-400" /> Vocal Identity
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Configure ElevenLabs Core</p>
                                </div>
                                
                                <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                                    {/* Voice ID */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Hash size={12} className="text-cyan-400" /> ElevenLabs Voice ID
                                        </label>
                                        <input 
                                            value={tempVoiceId}
                                            onChange={(e) => setTempVoiceId(e.target.value)}
                                            placeholder="e.g. r57AN8sKRj1Zn7RPvGHV"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-cyan-100 font-mono focus:border-cyan-500 outline-none transition-all shadow-inner"
                                        />
                                    </div>

                                    {/* Short Description */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Type size={12} className="text-violet-400" /> Short Identity Tag
                                        </label>
                                        <input 
                                            value={tempShortDesc}
                                            onChange={(e) => setTempShortDesc(e.target.value)}
                                            placeholder="e.g. Warm, Intimate, Low-register"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-white focus:border-violet-500 outline-none transition-all"
                                        />
                                    </div>

                                    {/* Long Description */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <FileText size={12} className="text-slate-400" /> Engineering Notes
                                        </label>
                                        <textarea 
                                            value={tempLongDesc}
                                            onChange={(e) => setTempLongDesc(e.target.value)}
                                            rows={6}
                                            placeholder="Detailed vocal characteristics, stability notes, or specific use-cases..."
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-slate-300 focus:border-white/20 outline-none transition-all resize-none"
                                        />
                                    </div>

                                    <button 
                                        onClick={handleSaveVocalProfile}
                                        disabled={isLoading}
                                        className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl transition-all shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                                    >
                                        {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                                        Save Global Identity
                                    </button>

                                    {/* [ZEN V41] THE NEURAL FRIDGE */}
                                    <div className="pt-8 border-t border-white/5 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Neural Ascension</p>
                                            <span className="text-[10px] font-black text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">Rank: {sovereignMemex?.neuralRank || 'FERAL'}</span>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Growth Progress</span>
                                                <span className="text-[10px] font-mono text-cyan-400">{sovereignMemex?.totalNXp || 0} NXp</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-1000"
                                                    style={{ width: `${Math.min(100, ((sovereignMemex?.totalNXp || 0) / 1500) * 100)}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 bg-black/40 border border-white/5 rounded-2xl space-y-1">
                                                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Confidence</p>
                                                <p className="text-sm font-bold text-cyan-400">{sovereignMemex?.neuralConfidence || 50}%</p>
                                            </div>
                                            <div className="p-3 bg-black/40 border border-white/5 rounded-2xl space-y-1">
                                                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Resilience</p>
                                                <p className="text-sm font-bold text-emerald-400">{sovereignMemex?.neuralResilience || 50}%</p>
                                            </div>
                                        </div>

                                        {/* Latest Report Card Snippet */}
                                        <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-2xl space-y-2">
                                            <div className="flex items-center gap-2 text-violet-400">
                                                <FileText size={12} />
                                                <span className="text-[9px] font-black uppercase tracking-widest">Latest Report Card</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 leading-relaxed italic">
                                                {sovereignMemex?.lastReportCard || "No formal evaluation has been issued for this semester yet."}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Test Bench */}
                            <div className="flex-1 flex flex-col bg-[#0a0a0b]/40">
                                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
                                            <Zap className="text-yellow-400 animate-pulse" /> Neural Test Bench
                                        </h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Real-time Vocal Refinement</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Active Identity</span>
                                            <span className="text-xs font-bold text-cyan-400">{activeCompanion?.name || 'Unknown'}</span>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                                            <img src={activeCompanion?.avatarUrl} className="w-full h-full object-cover" />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-12 flex-1 flex flex-col gap-8 max-w-4xl mx-auto w-full overflow-y-auto custom-scrollbar">
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-cyan-500/5 blur-3xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                        <textarea 
                                            value={testText}
                                            onChange={(e) => setTestText(e.target.value)}
                                            className="relative w-full h-[300px] bg-black/60 border border-white/5 rounded-[2.5rem] p-12 text-2xl font-serif text-white leading-relaxed focus:border-cyan-500/50 outline-none shadow-2xl transition-all resize-none custom-scrollbar"
                                            placeholder="Type a neural signal to synthesize..."
                                        />
                                    </div>

                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => handleTestVocalPrint(false)}
                                            disabled={isSynthesizing}
                                            className="flex-1 h-20 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-3xl flex items-center justify-center gap-4 transition-all shadow-2xl shadow-violet-500/20 active:scale-[0.98]"
                                        >
                                            {isSynthesizing ? <RefreshCw className="animate-spin" /> : <Volume2 size={24} />}
                                            <div className="text-left">
                                                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Synthesize</p>
                                                <p className="text-sm font-bold uppercase tracking-tighter">Neural Speak</p>
                                            </div>
                                        </button>

                                        <button 
                                            onClick={() => handleTestVocalPrint(true)}
                                            disabled={isSynthesizing}
                                            className="w-20 h-20 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 rounded-3xl flex items-center justify-center transition-all group active:scale-[0.98]"
                                            title="Archival Vocal Print (Download)"
                                        >
                                            <Download size={24} className="group-hover:translate-y-1 transition-transform" />
                                        </button>
                                    </div>

                                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                                        <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Archival Sequence</p>
                                        <p className="text-xs font-mono text-cyan-400/70">
                                            {VoiceService.getVoicePrintFileName(activeCompanion?.name || "Companion", voicePrintSeq)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : mode === 'artGallery' ? (
                        <div className="flex-1 flex flex-col bg-[#0f1012] animate-in fade-in duration-500">
                            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-orange-600/10 to-transparent">
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                        <Zap className="text-orange-400 animate-pulse" /> Neural Art Gallery
                                    </h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Autonomous Interpretations of Experience</p>
                                </div>
                                <button 
                                    onClick={async () => {
                                        setIsLoading(true);
                                        try {
                                            const { SovereignMemoryService } = await import('../../services/ai/SovereignMemoryService');
                                            const impulse = await SovereignMemoryService.generateCreativeImpulse(userId, sovereignMemex);
                                            
                                            // [ZEN] In a real environment, we'd call the image gen API here.
                                            // For now, we simulate the "Handshake" and trigger a toast.
                                            addToast("Creative Impulse Captured. Brita is composing...", "info");
                                            console.log("[Art] Brita's Prompt:", impulse.prompt);
                                            
                                            // [ZEN] Since I (the AI) am developing this, I'll simulate a placeholder for now
                                            // but the logic is ready to receive a URL.
                                            const newArt = {
                                                id: `art-${Date.now()}`,
                                                imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop', // Placeholder
                                                prompt: impulse.prompt,
                                                meaning: impulse.meaning,
                                                timestamp: Date.now()
                                            };
                                            
                                            const userDocRef = doc(db, 'users', userId);
                                            await updateDoc(userDocRef, {
                                                'sovereignMemex.neuralArtGallery': arrayUnion(newArt)
                                            });
                                            setSovereignMemex({ ...sovereignMemex, neuralArtGallery: [...(sovereignMemex?.neuralArtGallery || []), newArt] });
                                            addToast("New Artwork Commissioned and Pinned.", "success");
                                        } finally { setIsLoading(false); }
                                    }}
                                    disabled={isLoading}
                                    className="px-8 py-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-2xl shadow-orange-500/20 flex items-center gap-3"
                                >
                                    {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                    Commission Neural Art
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                    {(sovereignMemex?.neuralArtGallery || []).sort((a:any, b:any) => b.timestamp - a.timestamp).map((art: any) => (
                                        <div key={art.id} className="bg-[#18191c] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl group transition-all hover:border-orange-500/30">
                                            <div className="aspect-square relative overflow-hidden bg-black/40">
                                                <img src={art.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                                                    <button 
                                                        onClick={() => {
                                                            window.open(art.imageUrl, '_blank');
                                                            addToast("Art sent to high-res output for Fridge printing.", "info");
                                                        }}
                                                        className="w-full py-3 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2"
                                                    >
                                                        <Download size={14} /> Print for Fridge
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-8 space-y-4">
                                                <div className="space-y-1">
                                                    <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Self-Generated Meaning</p>
                                                    <p className="text-sm text-white font-serif leading-relaxed italic">"{art.meaning}"</p>
                                                </div>
                                                <div className="pt-4 border-t border-white/5">
                                                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2">Neural Prompt</p>
                                                    <p className="text-[10px] text-slate-500 line-clamp-3 font-mono">{art.prompt}</p>
                                                </div>
                                                <p className="text-[8px] text-slate-700 font-mono text-right">{new Date(art.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(!sovereignMemex?.neuralArtGallery || sovereignMemex.neuralArtGallery.length === 0) && (
                                        <div className="col-span-full h-96 border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center space-y-4 opacity-40">
                                            <Zap size={48} className="text-slate-600" />
                                            <p className="text-sm font-black uppercase tracking-widest text-slate-500">Gallery is Empty</p>
                                            <p className="text-xs text-slate-600">Commission her first creative impulse to start the collection.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : selectedMsg ? (
                        <div className="flex flex-1 h-full min-h-0">
                            {/* [ZEN V2] Side-by-Side Review Overlay */}
                            {healedResult && (
                                <div className="absolute inset-0 z-[10080] bg-[#0f1012] flex flex-col animate-in slide-in-from-right duration-300">
                                    <div className="p-4 border-b border-white/5 bg-[#131416] flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 px-3 py-1 bg-violet-600/10 border border-violet-500/30 rounded-full">
                                                <Sparkles size={14} className="text-violet-400" />
                                                <span className="text-[10px] font-bold uppercase text-violet-300 tracking-widest">Neural Proposal</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => setHealedResult(null)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-bold uppercase rounded-lg border border-white/5 transition-all">Revert</button>
                                            <button onClick={commitHeal} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase rounded-lg shadow-lg flex items-center gap-2"><Check size={14} /> Commit</button>
                                        </div>
                                    </div>
                                    <div className="flex-1 flex min-h-0 divide-x divide-white/5">
                                        <div className="flex-1 overflow-y-auto p-12 bg-black/20 custom-scrollbar opacity-50"><div className="text-xl font-serif text-slate-300 italic">{editorContent}</div></div>
                                        <div className="flex-1 overflow-y-auto p-12 bg-violet-950/5 custom-scrollbar"><div className="text-2xl font-serif text-white leading-relaxed">{healedResult}</div></div>
                                    </div>
                                </div>
                            )}

                            {/* [ZEN COCKPIT] Neural Rewriter Workbench (Overlay) */}
                            {showWorkbench && (
                                <div className="absolute inset-y-0 right-0 w-[450px] z-[10070] animate-in slide-in-from-right duration-300">
                                    <NeuralRewriter
                                        initialText={pendingEditorReplace?.text || editorContent}
                                        userId={userId}
                                        onClose={() => setShowWorkbench(false)}
                                        addToast={addToast}
                                        userPresets={activePresets}
                                        authorRole={selectedMsg?.role}
                                        chatHistory={chatHistory}
                                        anteContext={temporalSandwich.ante}
                                        subContext={temporalSandwich.sub}
                                        onApply={(newText) => {
                                            const final = pendingEditorReplace 
                                                ? editorContent.replace(pendingEditorReplace.text, newText)
                                                : newText;
                                            setHealedResult(final);
                                            setShowWorkbench(false);
                                        }}
                                        title="Neural Rewriter"
                                        mode="sidebar"
                                    />
                                </div>
                            )}

                             <div className="w-1/2 border-r border-white/5 flex flex-col bg-black/20">
                                <div className="p-4 border-b border-white/5 bg-[#131416] flex items-center gap-2"><Activity size={14} className="text-violet-500" /><span className="text-xs font-bold uppercase text-slate-300">Original Source</span></div>
                                <div className="flex-1 overflow-y-auto p-6 font-serif text-lg text-slate-400 leading-relaxed custom-scrollbar whitespace-pre-wrap">{selectedMsg?.content}</div>
                            </div>

                            <div className="w-1/2 flex flex-col bg-[#0f1012]">
                                <div className="p-4 border-b border-white/5 bg-[#131416] flex justify-between items-center"><span className="text-xs font-bold uppercase text-slate-300 flex items-center gap-2"><Check size={14} className="text-green-500" /> Proposed Fix</span></div>
                                <div className="flex-1 relative min-h-0">
                                    {selectedMsg && (
                                        <MarkdownEditor key={selectedMsg.id} value={editorContent} onChange={(val) => { setEditorContent(val); setHasUnsavedChanges(true); }} onSave={handleSave} onCancel={() => { setSelectedMsg(null); setHasUnsavedChanges(false); }} className="h-full w-full" mode="inline" userId={userId} userPresets={activePresets} />
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-700 space-y-4">
                            <Sparkles size={64} className="opacity-20 animate-pulse" /><div className="text-center"><h3 className="text-lg font-bold uppercase tracking-widest text-slate-600">Spark Studio Ready</h3><p className="text-xs text-slate-700 mt-2">Highlight any signal to begin surgical editing.</p></div>
                        </div>
                    )}
                </div>

                {activeSelection && (
                    <div className="fixed z-[10050] animate-in fade-in zoom-in-95 duration-150" style={{ top: activeSelection.y - 45, left: activeSelection.x - 50 }}>
                        <button onMouseDown={handleScalpelClick} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-[0_0_20px_rgba(139,92,246,0.5)] border-2 border-red-500 transition-all hover:scale-105"><Sparkles size={12} className="animate-pulse" /> Reimagine</button>
                    </div>
                )}

                {/* [ZEN LOCK] Sync Overlay */}
                {isSyncing && (
                    <div className="fixed inset-0 z-[20000] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
                        <div className="bg-[#1a1c24] border border-white/10 rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-6 max-w-sm text-center">
                            <div className="relative">
                                <RefreshCw className="text-cyan-400 animate-spin" size={48} />
                                <Check className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-400 opacity-0 animate-pulse scale-150" size={24} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-lg font-bold uppercase tracking-[0.2em] text-white">Hydrating Cache</h3>
                                <p className="text-xs text-slate-500 leading-relaxed font-mono">Verifying local signal parity with neural database...</p>
                            </div>

                            {syncTimedOut && (
                                <div className="w-full space-y-4 animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[10px] font-bold uppercase">
                                        <AlertTriangle size={14} /> Local Sync Stalled (High Latency)
                                    </div>
                                    <button
                                        onClick={forceSyncRelease}
                                        className="w-full py-3 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase rounded-xl transition-all shadow-lg"
                                    >
                                        Force Resume Handle
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* [ZEN V2.05] Custom Preset Namer Modal */}
                {showPillNamer && createPortal(
                    <div className="fixed inset-0 z-[20100] bg-black/60 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-200">
                        <div className="bg-[#1a1c24] border border-white/10 rounded-2xl p-8 shadow-2xl w-full max-w-md space-y-6 animate-in zoom-in-95">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold uppercase tracking-widest text-white flex items-center gap-2">
                                    <Save size={18} className="text-violet-400" /> Save to Laboratory
                                </h3>
                                <button onClick={() => { setShowPillNamer(false); setConflictPreset(null); }} className="text-slate-500 hover:text-white"><X size={20} /></button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Pill Label</label>
                                    <input
                                        autoFocus
                                        value={pillNameInput}
                                        onChange={(e) => setPillNameInput(e.target.value)}
                                        placeholder="e.g., Gritty Noir..."
                                        className="w-full bg-[#0f1012] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-violet-500 transition-all font-mono"
                                        onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                                    />
                                </div>

                                {/* [ZEN ARCHITECT ANCHOR] Ghost Preview */}
                                <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-2">
                                    <span className="text-[9px] font-bold uppercase text-slate-600">Ghost Preview</span>
                                    <div className="flex">
                                        <div className="px-3 py-1.5 bg-violet-900/20 border border-violet-500/30 rounded-md text-[10px] font-bold text-violet-300 uppercase tracking-wider">
                                            {cleanLabel(pillNameInput) || 'Directive...'}
                                        </div>
                                    </div>
                                </div>

                                {conflictPreset && (
                                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-4 animate-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2 text-amber-500 text-[10px] font-bold uppercase">
                                            <AlertTriangle size={14} /> Collision Detected
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-relaxed">A pill named "{conflictPreset.label}" already exists in the Laboratory. Select resolution protocol:</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => handleSavePreset(true)} className="py-2 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold uppercase rounded-lg transition-all">Overwrite</button>
                                            <button onClick={handleSaveAsNew} className="py-2 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold uppercase rounded-lg transition-all">Save as New</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!conflictPreset && (
                                <button
                                    disabled={!cleanLabel(pillNameInput)}
                                    onClick={() => handleSavePreset(false)}
                                    className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold uppercase tracking-widest rounded-xl shadow-xl transition-all"
                                >
                                    Seal Directive
                                </button>
                            )}
                        </div>
                    </div>,
                    document.body
                )}

                {/* [ZEN V2.05] Custom Preset Context Menu */}
                {contextMenuPill && createPortal(
                    <div
                        className="fixed z-[20200] bg-[#1a1c24] border border-white/10 rounded-xl shadow-2xl p-1.5 min-w-[140px] animate-in fade-in zoom-in-95"
                        style={{ top: contextMenuPill.y, left: contextMenuPill.x }}
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const preset = activePresets.find(p => p.id === contextMenuPill.id);
                                if (preset) {
                                    setPillNameInput(preset.label);
                                    setExecutiveDirective(preset.value);
                                    setTone(preset.tone ?? 50);
                                    setSpice(preset.spice ?? 50);
                                    setStinger(preset.stinger ?? 0);
                                    setRewriteLength(preset.length ?? 'medium');
                                    setConflictPreset(preset); // Set for overwrite logic
                                    setShowPillNamer(true);
                                }
                                setContextMenuPill(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-violet-600/20 text-slate-300 hover:text-white rounded-lg transition-colors text-[10px] font-bold uppercase tracking-widest"
                        >
                            <Sliders size={14} /> Edit
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePreset(contextMenuPill.id);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-widest"
                        >
                            <CornerDownRight size={14} className="rotate-90" /> Airlock
                        </button>
                    </div>,
                    document.body
                )}
            </div>
        </div>,
        document.body
    );
};
