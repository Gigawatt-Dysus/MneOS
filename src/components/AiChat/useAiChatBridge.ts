import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAiChat } from '../../hooks/useAiChat';
import { usePeerChat } from '../../hooks/usePeerChat';
import { useChatSessions } from '../../context/ChatSessionContext';
import { VertService } from '../../services/vertService';
import { typesenseService } from '../../services/typesenseService';
import { subscribeToUserPresets, saveUserPreset, deleteUserPreset } from '../../services/sovereignDbService';
import { uploadFile } from '../../services/storageService';
import { getVideoThumbnail } from '../../utils/mediaUtils';
import { AiChatProps } from './index'; // Importing interface from index not ideal if circular.
// Better to define props interface here or in types.
// But index.tsx exports AiChat. Accessing AiChatProps might be hard if not exported.
// I will redefine AiChatProps or import from a types file if available.
// index.tsx did define AiChatProps locally. I should extract it or copy it.
// Copying it is safest for now to avoid circular dependency (index imports hook, hook imports index).

import { ChatMessage, User, View, LifeEvent, GigiJournalEntry, Tag, Comment, Toast, Media, SettingsTab } from '../../types';

// Duplicate definition to avoid circular dep
export interface AiChatBridgeProps {
    user: User;
    initialMessage?: string;
    contextTagId?: string;
    clearInitialMessage: () => void;
    onNavigate: (view: View, data?: any) => void;
    chatHistory: ChatMessage[];
    onHistoryChange: (history: ChatMessage[]) => void;
    onAiCreateEvent: (args: any) => Promise<LifeEvent>;
    isDataLoading: boolean;
    onGigiJournalEntryCreated: (entry: GigiJournalEntry) => void;
    onAiCreateGigiJournalEntry: (args: { title: string; content: string }) => Promise<GigiJournalEntry>;
    onAiCreateTag: (args: any) => Promise<Tag>;
    onAiUpdateTag: (args: any) => Promise<{ status: string }>;
    apiKeySkipped: boolean;
    currentView: string;
    events: LifeEvent[];
    tags: Tag[];
    media?: Media[];
    recentJournalCommentThread: Comment[] | null;
    clearRecentJournalCommentThread: () => void;
    systemPromptPatches: Record<string, string>;
    isFrozen?: boolean;
    addToast: (message: string, type: Toast['type']) => void;
    onDeepDive?: (queryOrEvent: any) => void;
    peerSessions: any[];
    verts: any[];
    initialVertId?: string;
    initialMode?: 'ai' | 'peer';
    handleStageFiles: (files: File[]) => void;
    onOpenSettings?: (tab?: SettingsTab) => void;
    // [ZEN V34]
    loadMoreChat: () => void;
    hasMoreChat: boolean;
}

export const useAiChatBridge = (props: AiChatBridgeProps) => {
    const { loadMoreChat, hasMoreChat } = props;
    const { currentSessionId, updateSessionPreview, updateSessionTitle } = useChatSessions();

    const sessionFilteredHistory = useMemo(() => {
        return props.chatHistory.filter(m => 
            currentSessionId ? m.sessionId === currentSessionId : !m.sessionId
        );
    }, [props.chatHistory, currentSessionId]);

    // 1. Core Logic Hooks
    const aiChat = useAiChat({ ...props, currentSessionId, chatHistory: sessionFilteredHistory, addToast: props.addToast });

    const prevSessionIdRef = useRef<string | null | undefined>(undefined);
    useEffect(() => {
        if (prevSessionIdRef.current !== undefined && prevSessionIdRef.current !== currentSessionId) {
            aiChat.setMessages(sessionFilteredHistory);
        }
        prevSessionIdRef.current = currentSessionId;
    }, [currentSessionId, sessionFilteredHistory, aiChat.setMessages]);

    const {
        messages: aiMessages, userInput, setUserInput, thinkingAgentId, stagedFile, setStagedFile,
        activeContextTag, selectedModelId, setSelectedModelId,
        chatStyleMode, setChatStyleMode,
        contextMode, setContextMode,
        handleFileUpload, handleRefreshSession, handleDeleteMessage,
        handleEditMessage, injectMessage, handleReaction, handleSaveToTag, submitMessage: submitAiMessage,
        handleVaultChat, handleSetFiction,
        isMicKeyed, stopBurst,
        isBulkMode, setIsBulkMode, selectedMsgIds, toggleBulkMode, toggleMsgSelection, handleBulkSetFiction, handleBulkDelete,
        deletedMessagesBuffer, undoDeletion, // [ZEN V27]
        enrichmentStatus, // [ZEN V29]
        // [ZEN ED #114] integrityStats REMOVED
        lastFocalPoint, // [ZEN PHASE 9]
        isCrisisMode, unreadMailCount, // [ZEN] G.I.G.I. Crisis Protocol
        isVoiceEnabled, setIsVoiceEnabled,
        handleSpeak, handleDownloadAudio, handleCompanionUpdate,
        handleCognitiveOverride, handleCommitSparkEdit, // [ZEN] Override Triad
        inputProcessMode, setInputProcessMode,
        isEnhancingInput
    } = aiChat;

    // [ZEN] Auto-Preview & Auto-Title Update Logic
    useEffect(() => {
        if (!currentSessionId || !aiMessages || aiMessages.length === 0) return;
        const lastMsg = aiMessages[aiMessages.length - 1];
        if (lastMsg && lastMsg.content) {
            const previewText = lastMsg.content.substring(0, 80) + (lastMsg.content.length > 80 ? '...' : '');
            updateSessionPreview(currentSessionId, previewText);

            // Auto-generate title on first AI response
            if (aiMessages.length <= 2 && lastMsg.role !== 'user') {
                const newTitle = lastMsg.content.split('\n')[0].substring(0, 35).replace(/["*_]/g, '').trim() + (lastMsg.content.length > 35 ? '...' : '');
                updateSessionTitle(currentSessionId, newTitle);
            }
        }
    }, [aiMessages, currentSessionId, updateSessionPreview, updateSessionTitle]);

    // 2. Local State
    const [chatMode, setChatMode] = useState<'ai' | 'peer'>(props.initialMode || 'ai');
    const [selectedPeerSessionId, setSelectedPeerSessionId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [showSparkStudio, setShowSparkStudio] = useState(false);

    // Shutter State
    const [isInitialSnap, setIsInitialSnap] = useState(true);
    const [isShutterFading, setIsShutterFading] = useState(false);
    const [isScrollSettled, setIsScrollSettled] = useState(false);
    const syncBurstGuard = useRef(false);

    // Executive State
    const [executiveDirective, setExecutiveDirective] = useState('');
    const [isPinned, setIsPinned] = useState(false);
    const [isDeckExpanded, setIsDeckExpanded] = useState(true);
    const [userPresets, setUserPresets] = useState<any[]>([]);

    // Pill Namer State
    const [showPillNamer, setShowPillNamer] = useState(false);
    const [isSavingPill, setIsSavingPill] = useState(false);
    const [pillNameInput, setPillNameInput] = useState('');
    const [isArchPinned, setIsArchPinned] = useState(() => {
        return localStorage.getItem('gigi_hud_pinned') === 'true';
    });

    // Refs
    // const fileInputRef = useRef<HTMLInputElement>(null); // Passed to Input? Or logic handled here? 
    // handleFileUpload is from useAiChat. It takes event. 
    // So we need to expose a ref for the button to click.
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const prevCountRef = useRef(0);

    // 3. Derived State
    const activePeerSession = props.peerSessions.find(s => s.sessionId === selectedPeerSessionId);
    const otherParticipantId = activePeerSession?.participants.find((id: string) => id !== props.user.id) || props.initialVertId;
    const activeVert = props.verts.find(v => v.uid === otherParticipantId);

    // 4. Peer Chat Hook
    const peerChat = usePeerChat({
        user: props.user,
        sessionId: selectedPeerSessionId,
        activeVertName: activeVert?.displayName || 'Archivist',
        addToast: props.addToast
    });

    const {
        messages: peerMessages,
        isThinking: peerIsThinking,
        sendMessage: sendPeerMessage,
        deleteMessage: deletePeerMessage,
        // messagesEndRef: peerEndRef, // We use shared end ref logic
        lastReadTimestamps,
        participants,
        setTyping,
        typingStatus
    } = peerChat;

    // Unified Data
    const messages = chatMode === 'ai' ? aiMessages : peerMessages;
    const isThinking = chatMode === 'ai' ? !!thinkingAgentId : peerIsThinking;
    const hasFireworksKey = !!props.user.settings?.fireworksApiKey;

    // 5. Effects

    // Auto-link Peer Session
    useEffect(() => {
        localStorage.setItem('gigi_hud_pinned', isArchPinned.toString());
    }, [isArchPinned]);

    useEffect(() => {
        if (props.initialVertId) {
            const connectVert = async () => {
                const sessionId = await VertService.createPeerSession(props.user.id, props.initialVertId!);
                setSelectedPeerSessionId(sessionId);
                setChatMode('peer');
            };
            connectVert().catch(e => {
                console.error("Failed to bridge peer session:", e);
                props.addToast("Transmission beam failed to synchronize.", "error");
            });
        }
    }, [props.initialVertId, props.user.id]);

    // Debounced Typing Indicator
    useEffect(() => {
        if (chatMode !== 'peer' || !userInput.trim()) {
            if (chatMode === 'peer') setTyping(false);
            return;
        }
        setTyping(true);
        const timeout = setTimeout(() => setTyping(false), 3000);
        return () => clearTimeout(timeout);
    }, [userInput, chatMode]);

    // Re-entry Trigger
    useEffect(() => {
        if (props.currentView === 'interviews') {
            setIsInitialSnap(true);
            setIsScrollSettled(false);
            syncBurstGuard.current = false;
        }
    }, [props.currentView]);

    // User Presets
    useEffect(() => {
        if (!props.user.id) return;
        const unsub = subscribeToUserPresets(props.user.id, (presets) => {
            setUserPresets(presets);
        });
        return () => unsub();
    }, [props.user.id]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (activeContextTag || isSidebarOpen || showSparkStudio || showEmojiPicker) return;
            const isInputActive = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
            if (isInputActive) return;

            if (e.key === 'PageUp') {
                e.preventDefault();
                chatContainerRef.current?.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
            } else if (e.key === 'PageDown') {
                e.preventDefault();
                chatContainerRef.current?.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                chatContainerRef.current?.scrollBy({ top: -40, behavior: 'auto' });
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                chatContainerRef.current?.scrollBy({ top: 40, behavior: 'auto' });
            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                textAreaRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeContextTag, isSidebarOpen, showSparkStudio, showEmojiPicker]);

    // Context Mode Reset
    useEffect(() => {
        if (!isPinned && contextMode === 'grounded') {
            setExecutiveDirective('');
        }
    }, [contextMode, isPinned]);

    // Global Search
    const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null);
    const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);

    // [ZEN V34] Filter Logic (Unified Local + Global Search)
    const filteredMessages = useMemo(() => {
        // 1. Priority: Global Search Results
        if (searchQuery && searchResults) return searchResults;
        
        if (!searchQuery) return aiMessages;
        const q = searchQuery.toLowerCase();

        // 2. Room Filtering (Case-Insensitive & Slug/Display Agnostic)
        const roomSlugs = ['living_room', 'sanctuary', 'workshop', 'studio'];
        if (roomSlugs.includes(q)) {
            return aiMessages.filter(m => {
                const room = (m.room || '').toLowerCase().replace(/\s+/g, '_');
                // [ZEN FALLBACK] Default unassigned messages to Living Room
                if (q === 'living_room' && !room) return true;
                return room === q;
            });
        }
        
        // 3. Local Search Fallback
        return aiMessages.filter(m => (m.content || '').toLowerCase().includes(q));
    }, [aiMessages, searchQuery, searchResults]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingGlobal(true);
            try {
                const hits = await typesenseService.searchChatSegments(searchQuery, props.user.id, 100);
                setSearchResults(hits as unknown as ChatMessage[]);
            } catch (e) {
                console.error("Global Search Failed", e);
            } finally {
                setIsSearchingGlobal(false);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [searchQuery, props.user.id]);



    // Shutter Protocol
    useEffect(() => {
        if (!props.isDataLoading && isInitialSnap && !syncBurstGuard.current) {
            syncBurstGuard.current = true;
            const safetyValve = setTimeout(() => {
                if (isInitialSnap) {
                    // console.warn("[ZEN] Shutter Emergency Egress Triggered (3.0s Timeout)"); // [ZEN] Silenced
                    handleDropShutter();
                }
            }, 3000); // [ZEN FIX] Reduced from 8s to 3s for snappier re-entry

            let settlementFrames = 0;
            let heightStabilityFrames = 0;
            let lastHeight = 0;

            const isSettledRef = { current: isScrollSettled };

            const verifySettlement = () => {
                const container = chatContainerRef.current;
                if (!container || !isInitialSnap) return;

                const currentHeight = container.scrollHeight;
                // [ZEN FIX] Introduce a 5px tolerance to prevent micro-jitters (blurs/images) from stalling boot
                const heightDiff = Math.abs(currentHeight - lastHeight);
                if (heightDiff > 5) {
                    lastHeight = currentHeight;
                    heightStabilityFrames = 0;
                    settlementFrames = 0;
                    requestAnimationFrame(verifySettlement);
                    return;
                }
                
                heightStabilityFrames++;
                if (heightStabilityFrames < 3) { // [ZEN FIX] Reduced from 5 to 3 for speed
                    requestAnimationFrame(verifySettlement);
                    return;
                }

                const storageKey = `gigi_chat_scroll_pos_${searchQuery || 'default'}`;
                const savedPos = sessionStorage.getItem(storageKey);
                const target = savedPos ? parseInt(savedPos, 10) : (container.scrollHeight - container.clientHeight);
                
                container.scrollTop = target;
                const diff = container.scrollTop - target;

                if (Math.abs(diff) < 5) {
                    settlementFrames++;
                    if (settlementFrames >= 5 && !isSettledRef.current) {
                        isSettledRef.current = true;
                        handleDropShutter();
                    }
                } else {
                    settlementFrames = 0;
                }

                if (isInitialSnap && !isSettledRef.current) {
                    requestAnimationFrame(verifySettlement);
                }
            };

            const handleDropShutter = () => {
                setIsScrollSettled(true);
                setTimeout(() => {
                    setIsShutterFading(true);
                    setTimeout(() => {
                        setIsInitialSnap(false);
                        setIsShutterFading(false);
                        const container = chatContainerRef.current;
                        if (container) {
                            const storageKey = `gigi_chat_scroll_pos_${searchQuery || 'default'}`;
                            const savedPos = sessionStorage.getItem(storageKey);
                            container.scrollTop = savedPos ? parseInt(savedPos, 10) : container.scrollHeight;
                        }
                    }, 300);
                }, 600);
            };
            requestAnimationFrame(verifySettlement);
            return () => clearTimeout(safetyValve);
        }
    }, [props.isDataLoading, isInitialSnap]);

    // Scroll Persistence
    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;
        const handleScroll = () => {
            if (isInitialSnap) return;
            const storageKey = `gigi_chat_scroll_pos_${searchQuery || 'default'}`;
            sessionStorage.setItem(storageKey, container.scrollTop.toString());
        };
        container.addEventListener('scroll', handleScroll);
        return () => {
            if (container.scrollTop > 0) {
                const storageKey = `gigi_chat_scroll_pos_${searchQuery || 'default'}`;
                sessionStorage.setItem(storageKey, container.scrollTop.toString());
            }
            container.removeEventListener('scroll', handleScroll);
        };
    }, [isInitialSnap]);

    // Smart Scroll
    // Smart Scroll -- [ZEN PHASE 9] DEPRECATED (Moved to MessageList)
    /*
    useEffect(() => {
        if (isInitialSnap) return;
        if (filteredMessages.length > prevCountRef.current || thinkingAgentId) {
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
        prevCountRef.current = filteredMessages.length;
    }, [filteredMessages.length, thinkingAgentId, isInitialSnap]);
    */


    // Data Handlers
    const handleSaveCustom = async (forceOverwrite = false) => {
        // [ZEN DEBUG] User Request: Debug the Ghost
        console.log("[Pill Creation]", { name: pillNameInput, directive: executiveDirective });

        if (!executiveDirective.trim() || !props.user.id) return;
        const name = pillNameInput.trim().toUpperCase();
        if (!name) return;

        const newPreset = {
            id: forceOverwrite ? userPresets.find(p => p.label === name)?.id || `pill-${Date.now()}` : `pill-${Date.now()}`,
            label: name,
            value: executiveDirective.trim(),
            type: 'pill'
        };

        setIsSavingPill(true);

        // [ZEN FIX] Explicit Promise Chain to ensure Modal Death
        saveUserPreset(props.user.id, newPreset)
            .then(() => {
                props.addToast("Directive preserved in Pill Laboratory.", "success");
                // KILL SWITCH
                setShowPillNamer(false);
                setPillNameInput('');
            })
            .catch((e) => {
                console.error("Pill Save Failed", e);
                props.addToast("Failed to preserve Pill.", "error");
            })
            .finally(() => {
                setIsSavingPill(false);
            });
    };

    const removeCustom = async (presetId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!props.user.id) return;
        try {
            await deleteUserPreset(props.user.id, presetId);
            props.addToast("Pill dissolved.", "success");
        } catch (e) {
            props.addToast("Failed to dissolve Pill.", "error");
        }
    };

    const handleExecutiveSubmit = () => {
        submitAiMessage(!!props.isFrozen, executiveDirective);
        // [ZEN V31] Voidrifter Persistence: We DO NOT clear the directive automatically.
        // It stays until manually cleared or swapped.
    };

    const handleSafeDelete = async (index: number) => {
        const msg = messages[index];
        if (chatMode === 'peer') {
            if (msg.id) await deletePeerMessage(msg.id);
        } else {
            handleDeleteMessage(index);
        }
    };

    const handlePeerMessageSubmit = async (text: string) => {
        if (!text.trim() && !stagedFile) return;
        let mediaInfo = undefined;
        if (stagedFile) {
            try {
                const { url } = await uploadFile(stagedFile.file, props.user.id);
                let thumbnailUrl = undefined;
                if (stagedFile.type === 'video') {
                    const thumbBlob = await getVideoThumbnail(stagedFile.file);
                    const { url: tUrl } = await uploadFile(thumbBlob, props.user.id, `thumb-${stagedFile.file.name}.jpg`);
                    thumbnailUrl = tUrl;
                }
                mediaInfo = { url, mimeType: stagedFile.file.type, thumbnailUrl };
            } catch (e) {
                props.addToast("Failed to transmit media signal.", "error");
            }
        }
        await sendPeerMessage(text, false, undefined, mediaInfo);
        setTyping(false);
        setUserInput('');
        setStagedFile(null);
    };

    const handleSaveToMatrix = async (msg: any) => {
        if (!msg.imageUrl) return Promise.resolve(); // Return promise type match
        try {
            props.addToast("Transmitting signal to Staging Area...", "info");
            const response = await fetch(msg.imageUrl);
            const blob = await response.blob();
            const fileName = msg.imageUrl.split('/').pop()?.split('?')[0] || 'chat-asset';
            const file = new File([blob], fileName, { type: blob.type });
            props.handleStageFiles([file]);
            if (chatMode === 'peer') {
                await sendPeerMessage(`${props.user.displayName} added your media to their Matrix.`, false, undefined, undefined, true);
            }
            props.addToast("Media signal successfully bridged to Staging.", "success");
        } catch (e) {
            props.addToast("Failed to bridge media to Matrix.", "error");
        }
        return Promise.resolve();
    };

    const handleEmojiInsert = (emoji: string) => {
        const input = textAreaRef.current;
        if (!input) {
            setUserInput(prev => prev + emoji);
        } else {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const text = userInput;
            const newText = text.substring(0, start) + emoji + text.substring(end);
            setUserInput(newText);
            // Re-focus hack needs requestAnimationFrame or setTimeout in React
            setTimeout(() => {
                if (textAreaRef.current) {
                    const newCursorPos = start + emoji.length;
                    textAreaRef.current.selectionStart = textAreaRef.current.selectionEnd = newCursorPos;
                    textAreaRef.current.focus();
                }
            }, 0);
        }
        setShowEmojiPicker(false);
    };

    return {
        // State
        chatMode, setChatMode,
        selectedPeerSessionId, setSelectedPeerSessionId,
        isSidebarOpen, setIsSidebarOpen,
        showEmojiPicker, setShowEmojiPicker,
        searchQuery, setSearchQuery, isSearchingGlobal, filteredMessages,
        showSparkStudio, setShowSparkStudio,
        isInitialSnap, isScrollSettled, isShutterFading,
        executiveDirective, setExecutiveDirective,
        isPinned, setIsPinned,
        isDeckExpanded, setIsDeckExpanded,
        userPresets,
        showPillNamer, setShowPillNamer,
        isSavingPill, setIsSavingPill,
        pillNameInput, setPillNameInput,

        // Data
        user: props.user,
        messages: aiMessages,
        aiMessages, // Exposed for SparkStudio
        activeContextTag,
        selectedModelId, setSelectedModelId,
        thinkingAgentId, isThinking,
        hasFireworksKey,
        stagedFile, setStagedFile,
        activeVert, otherParticipantId,
        peerSessions: props.peerSessions,
        verts: props.verts,
        deletedMessagesBuffer, // [ZEN V27]

        // Refs
        fileInputRef, textAreaRef, chatEndRef, chatContainerRef,

        // Handlers
        handleSaveCustom, removeCustom, handleExecutiveSubmit,
        handleSafeDelete, handlePeerMessageSubmit, handleSaveToMatrix,
        handleEmojiInsert,
        onNavigate: props.onNavigate,
        handleDetails: {
            handleRefreshSession,
            handleVaultChat,
            chatStyleMode, setChatStyleMode,
            contextMode,
            // [ZEN EWO #27] Dynamic Mode Wrapper
            setContextMode: (mode: any) => {
                console.log("[AiChat] Mode changed to", mode === 'creative' ? 'Creative' : 'Grounded');
                aiChat.setContextMode(mode);
                props.addToast(`Context: Marked as ${mode === 'creative' ? 'Creative' : 'Grounded'}.`, "info");
            },
            handleFileUpload,
            handleEditMessage, handleReaction, handleSaveToTag, handleSetFiction,
            injectMessage, undoDeletion,
            handleCognitiveOverride, handleCommitSparkEdit, executeManualDriftSlice: aiChat.executeManualDriftSlice
            // [ZEN ED #114] handleReconcileContext REMOVED
        },
        // Peer Specifics
        typingStatus, participants, lastReadTimestamps,

        // Input State
        userInput, setUserInput,

        // [ZEN V29] Status
        enrichmentStatus,
        // [ZEN ED #114] integrityStats REMOVED
        lastFocalPoint, // [ZEN PHASE 9]
        isCrisisMode,
        unreadMailCount,
        handleSpeak,
        handleDownloadAudio,
        isVoiceEnabled, setIsVoiceEnabled,

        // [ZEN V14] Bulk Actions
        isBulkMode,
        setIsBulkMode,
        selectedMsgIds,
        toggleBulkMode,
        toggleMsgSelection,
        handleBulkSetFiction,
        handleBulkDelete,

        // [ZEN V34]
        loadMoreChat,
        hasMoreChat,
        handleCompanionUpdate,
        isArchPinned,
        setIsArchPinned,
        inputProcessMode, setInputProcessMode,
        isEnhancingInput,
        tags: props.tags // [ZEN] Exposing for TensorMap identity resolution
    };
};
