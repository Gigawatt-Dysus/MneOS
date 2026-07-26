import React, { useEffect, useRef, useMemo } from 'react';
import { Search, Cpu, Globe, MessageSquare, ChevronRight, RefreshCw } from 'lucide-react';
import { GlassAvatar } from '../GlassAvatar';
import MessageBubble from '../ai/MessageBubble';
import { ChatMessage, User, View, AiCompanion } from '../../types';
import { formatLifeOSDate } from '../../utils/dateSanitizer';

export interface MessageListProps {
    // Data
    messages: any[]; // Using any[] to accomodate ChatMessage | PeerChatSegment without complex union imports for now
    filteredMessages: any[];
    user: User;
    chatMode: 'ai' | 'peer';
    // [ZEN EWO #27] Render Guard Dependency
    activeMode: string; // 'grounded' | 'creative' | 'raw'
    // State
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    activeContextTag: any | null;
    selectedPeerSessionId: string | null;
    peerSessions: any[];
    userPresets?: any[]; // [ZEN EWO #120] Prop Drill
    verts: any[];
    isThinking: boolean;
    thinkingAgentId: string | null;
    // Shutter State (Passed from Hook)
    isInitialSnap: boolean;
    isScrollSettled: boolean;
    isShutterFading: boolean;
    // Render Refs
    chatContainerRef: React.RefObject<HTMLDivElement>;
    chatEndRef: React.RefObject<HTMLDivElement>;
    // Handlers
    onNavigate: (view: View, data?: any) => void;
    handleSafeDelete: (index: number) => void;
    handleEditMessage: (index: number, content: string) => void;
    handleReaction: (index: number, emoji: string) => void;
    handleSaveToTag: (msg: any) => Promise<any>;
    handleSaveToMatrix: (msg: any) => Promise<any>;
    handleSetFiction: (msg: ChatMessage, status: boolean) => void; // Fixed Signature
    handlePromoteToCore: (m: ChatMessage) => void;
    onFeedback: (isPositive: boolean) => void; // Added Prop
    // UI Helpers
    setIsSidebarOpen: (v: boolean) => void;
    setSelectedPeerSessionId: (id: string | null) => void;
    activeVert?: any;
    chatStyleMode: 'lite' | 'full';
    // Peer Specifics
    otherParticipantId?: string;
    typingStatus?: Record<string, boolean>;
    participants?: string[];
    lastReadTimestamps?: Record<string, number>;
    lastFocalPoint?: string | null;
    // [ZEN V14] Bulk Actions
    isBulkMode?: boolean;
    selectedMsgIds?: Set<string>;
    onToggleSelect?: (id: string) => void;
    // [ZEN V34]
    loadMoreChat?: () => void;
    hasMoreChat?: boolean;
    onSpeak?: (text: string, voiceId?: string, modelId?: string) => void; // [ZEN]
    onDownloadAudio?: (text: string, voiceId?: string, modelId?: string) => void; // [ZEN]
    onCognitiveOverride?: (msgId: string) => void; // [ZEN]
    onCommitSparkEdit?: (msgId: string, originalText: string, editedText: string) => void; // [ZEN]
    onManualDriftFlag?: (msgId: string, reason: string) => void; // [ZEN]
    tags?: any[]; // [ZEN] For identity-locked EmoDB
}

// Helper from original file
const formatChatTimestamp = (date: Date): string => {
    return formatLifeOSDate(date, 'exact');
};

export const MessageList: React.FC<MessageListProps> = (props) => {
    const {
        messages, filteredMessages, user, chatMode, searchQuery, setSearchQuery,
        activeContextTag, selectedPeerSessionId, peerSessions, verts,
        activeMode, // [ZEN EWO #27]
        isThinking, thinkingAgentId,
        isInitialSnap, isScrollSettled, isShutterFading,
        chatContainerRef, chatEndRef,
        onNavigate, handleSafeDelete, handleEditMessage, handleReaction,
        handleSaveToTag, handleSaveToMatrix, handleSetFiction, handlePromoteToCore, onFeedback,
        setIsSidebarOpen, setSelectedPeerSessionId, activeVert,
        otherParticipantId, typingStatus, participants, lastReadTimestamps,
        userPresets = [], // [ZEN EWO #120]
        // [ZEN ED #114] integrityStats REMOVED
        lastFocalPoint, // [ZEN PHASE 9]
        isBulkMode, selectedMsgIds, onToggleSelect,
        loadMoreChat, hasMoreChat, // [ZEN V34]
        onSpeak, onDownloadAudio,
        onCognitiveOverride, onCommitSparkEdit, onManualDriftFlag,
        tags
    } = props;

    // [ZEN PHASE 9] Surgical Scroll Logic
    const prevMessagesLength = useRef(0);
    const prevFocalPoint = useRef<string | null | undefined>(null);
    const hasInitiallyScrolled = useRef(false); // [ZEN FIX] Track initial scroll
    
    // [ZEN V34] Pagination Anchor State
    const lastScrollHeight = useRef(0);
    const [isPaginating, setIsPaginating] = React.useState(false);

    // [ZEN EWO #25] Render Guard: Moved out of JSX to avoid hook violation
    const renderedMessages = useMemo(() => {
        return filteredMessages.map((msg: any, index: number) => {
            const prevMsg = messages[index - 1];
            const currentDate = new Date(msg.timestamp || Date.now());
            const prevDate = prevMsg ? new Date(prevMsg.timestamp || Date.now()) : null;
            const showTimestamp = !prevDate || (currentDate.getTime() - prevDate.getTime() > 20 * 60 * 1000) || (currentDate.getDate() !== prevDate.getDate());

            return (
                <React.Fragment key={msg.id || `msg-${index}-${msg.timestamp || 'new'}`}>
                    {showTimestamp && (
                        <div className="flex justify-center my-6 opacity-70">
                            <span className="text-[10px] font-bold text-white/90 shadow-[0_0_20px_rgba(139,92,246,0.4)] bg-black/50 px-3 py-1 rounded-full border border-violet-400/30 uppercase tracking-wider backdrop-blur-sm font-mono">
                                {formatChatTimestamp(currentDate)}
                            </span>
                        </div>
                    )}
                    <div id={msg.id} className="w-full">
                        {(() => {
                            // [ZEN FIX] Fluid Context Window (Total 6 neighbors)
                            const contextWindow = 6;
                            const totalMessages = filteredMessages.length;
                            let start = index - Math.floor(contextWindow / 2);
                            let end = index + Math.ceil(contextWindow / 2) + 1;

                            if (start < 0) {
                                end = Math.min(totalMessages, end - start);
                                start = 0;
                            }
                            if (end > totalMessages) {
                                start = Math.max(0, start - (end - totalMessages));
                                end = totalMessages;
                            }

                            const anteContext = filteredMessages.slice(start, index);
                            const subContext = filteredMessages.slice(index + 1, end);

                            return (
                                <MessageBubble
                                    msg={msg}
                                    user={user}
                                    onNavigate={onNavigate}
                                    onDelete={() => handleSafeDelete(index)}
                                    onEdit={(newContent) => {
                                        if (onCommitSparkEdit && msg.role === 'model' && msg.id) {
                                            onCommitSparkEdit(msg.id, msg.content, newContent);
                                        } else {
                                            handleEditMessage(index, newContent);
                                        }
                                    }}
                                    onReact={(emoji: string) => handleReaction(index, emoji)}
                                    onFeedback={onFeedback}
                                    onSaveToContext={activeContextTag && msg.role === 'model' ? handleSaveToTag : undefined}
                                    onSaveToMatrix={handleSaveToMatrix}
                                    onSetFiction={handleSetFiction}
                                    onPromoteToCore={handlePromoteToCore}
                                    otherLastReadTimestamp={chatMode === 'peer' && participants ? (lastReadTimestamps?.[participants.find((id: string) => id !== user.id) || ''] || 0) : undefined}
                                    userPresets={userPresets}
                                    isBulkMode={isBulkMode}
                                    isSelected={selectedMsgIds?.has(msg.id)}
                                    onToggleSelect={() => onToggleSelect?.(msg.id)}
                                    onSpeak={onSpeak}
                                    onDownloadAudio={onDownloadAudio}
                                    onCognitiveOverride={onCognitiveOverride ? () => onCognitiveOverride(msg.id) : undefined}
                                    onManualDriftFlag={onManualDriftFlag && msg.id ? (reason) => onManualDriftFlag(msg.id, reason) : undefined}
                                    anteContext={anteContext}
                                    subContext={subContext}
                                    tags={tags}
                                />
                            );
                        })()}
                    </div>
                </React.Fragment>
            );
        });
    }, [filteredMessages, lastFocalPoint, searchQuery, chatMode, activeContextTag?.id, typingStatus, activeMode, userPresets, isBulkMode, selectedMsgIds, onSpeak, onDownloadAudio]);

    // [ZEN FIX] Initial Scroll on Hydration (Priority: Last Focal Point -> Bottom)
    React.useLayoutEffect(() => {
        if (!hasInitiallyScrolled.current && filteredMessages.length > 0) {

            // 1. Try to snap to Last Touching Point (Focal Point)
            if (lastFocalPoint) {
                const target = document.getElementById(lastFocalPoint) || document.getElementById(`msg-${lastFocalPoint}`);
                if (target) {
                    console.log(`[Scroll] Initial hydration snap to last focal point: ${lastFocalPoint}`);
                    target.scrollIntoView({ behavior: 'auto', block: 'center' });
                    hasInitiallyScrolled.current = true;
                    return;
                }
            }

            // 2. Default: Snap to Bottom (Latest Message)
            if (chatEndRef.current) {
                console.log(`[Scroll] Initial hydration snap to bottom (${filteredMessages.length} messages)`);
                // [ZEN FIX] Add a more robust delay to allow bubbles to calculate their heights
                setTimeout(() => {
                    if (chatEndRef.current) {
                        chatEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
                        // Hard-set scrollTop as backup for stubborn browsers
                        if (chatContainerRef.current) {
                            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                        }
                    }
                    hasInitiallyScrolled.current = true;
                }, 500); // 500ms for safety
            }
        }
    }, [filteredMessages.length, lastFocalPoint]);

    // [ZEN V33] Shutter Drop Sync: Final attempt to scroll when visibility is 100%
    const hasSnapped = useRef(false);
    useEffect(() => {
        if ((isShutterFading || !isInitialSnap) && !hasSnapped.current) {
            hasSnapped.current = true;
            // console.log(`[Scroll] Shutter dropped. Forcing final scroll sync...`); // [ZEN] Silenced
            // [ZEN FIX] Increase delay and use 'auto' for an uninterruptible snap
            const timer = setTimeout(() => {
                if (chatEndRef.current) {
                    chatEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
                    if (chatContainerRef.current) {
                        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                    }
                    // console.log("[Scroll] Final snap complete."); // [ZEN] Silenced
                }
            }, 800);
            return () => clearTimeout(timer);
        }
        // Reset snap if we go back to initial snap (re-entry)
        if (isInitialSnap) hasSnapped.current = false;
    }, [isShutterFading, isInitialSnap]);

    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;

        // Scenario A (Editing): Anchor
        // We only verify anchor if the focal point has CHANGED.
        if (lastFocalPoint && lastFocalPoint !== prevFocalPoint.current) {
            const el = document.getElementById(lastFocalPoint);
            // Fallback for wrapped IDs
            const target = el || document.getElementById(`msg-${lastFocalPoint}`);

            if (target) {
                console.log(`[Anchor] Scrolling to focal point: ${lastFocalPoint}`);
                // [ZEN EWO #25] Decoupled Anchor Logic
                requestAnimationFrame(() => {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                prevFocalPoint.current = lastFocalPoint;
                return; // Priority: Anchor wins
            }
        }
        // Sync ref if it changed but element wasn't found (prevent loop)
        if (lastFocalPoint !== prevFocalPoint.current) prevFocalPoint.current = lastFocalPoint;

        // Scenario B (New AI Turn): Auto-Scroll
        const count = filteredMessages.length;
        const hasNewMessage = count > prevMessagesLength.current;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;

        if (hasNewMessage && !isInitialSnap) {
            if (isNearBottom || thinkingAgentId) {
                setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }
        }

        // Scenario C (Background Sync):
        // Implicitly handled: If hasNewMessage is false (e.g. just an update to existing), we do nothing.
        // [ZEN ED #114] integrityStats dependency REMOVED

        prevMessagesLength.current = count;

    }, [filteredMessages.length, lastFocalPoint, thinkingAgentId, isInitialSnap]);

    // [ZEN V34] Scroll Anchoring Logic: Keep position when new messages arrive at top
    React.useLayoutEffect(() => {
        if (isPaginating && chatContainerRef.current) {
            const delta = chatContainerRef.current.scrollHeight - lastScrollHeight.current;
            if (delta > 0) {
                chatContainerRef.current.scrollTop += delta;
            }
            setIsPaginating(false);
        }
    }, [filteredMessages.length]);

    const handleScroll = () => {
        const container = chatContainerRef.current;
        if (!container || !hasMoreChat || !loadMoreChat || isThinking || isInitialSnap) return;

        // If we hit the top (100px threshold), request more data
        if (container.scrollTop < 100) {
            lastScrollHeight.current = container.scrollHeight;
            setIsPaginating(true);
            loadMoreChat();
        }
    };

    return (
        <div className="flex flex-col flex-1 relative min-w-0 overflow-hidden">
            {activeContextTag && (
                <div className="absolute top-0 left-0 right-0 z-20 bg-violet-900/80 backdrop-blur-xl border-b border-violet-700/50 px-4 py-2 flex justify-between items-center shadow-lg animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-violet-100">
                        <span className="text-sm font-bold truncate">Context: <span className="underline">{activeContextTag.name}</span></span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button onClick={() => onNavigate('tagEditor', { tagId: activeContextTag.id })} className="flex items-center gap-1 text-xs font-bold bg-black/30 px-3 py-1.5 rounded hover:bg-black/50 border border-white/10 active:scale-95">Editor</button>
                    </div>
                </div>
            )}

            <div
                ref={chatContainerRef}
                onScroll={handleScroll}
                className={`flex-grow px-3 pt-4 pb-4 overflow-y-auto custom-scrollbar ${activeContextTag ? 'pt-14' : ''} relative ${isInitialSnap ? 'overflow-hidden' : ''}`}
            >
                {isInitialSnap && (
                    <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 z-[60] bg-[#0a0c10] transition-opacity duration-500 ${isShutterFading ? 'opacity-0' : 'opacity-100'}`}>
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full border border-cyan-500/20 animate-[ping_3s_infinite]" />
                                <Cpu className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-400 opacity-50" size={24} />
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-400/60 animate-pulse">
                                Hydrating Log...
                            </span>
                        </div>
                    </div>
                )}

                <div className={`max-w-4xl mx-auto flex flex-col justify-end min-h-full transition-all duration-300 ${!isInitialSnap || isShutterFading ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                    
                    {/* [ZEN V34] Loading Indicator at Top */}
                    {hasMoreChat && (
                        <div className="flex justify-center py-8">
                            <div className="flex flex-col items-center gap-2">
                                <RefreshCw className="text-indigo-400/40 animate-spin" size={16} />
                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-500/30">Hydrating Archive...</span>
                            </div>
                        </div>
                    )}

                    {chatMode === 'peer' && !selectedPeerSessionId && (
                        <div className="flex flex-col h-full py-4 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-black text-white tracking-widest uppercase italic">The Matrix</h3>
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="text-[10px] font-bold text-violet-400 hover:text-violet-300 transition-colors uppercase tracking-[0.2em] flex items-center gap-1"
                                >
                                    <Globe size={12} /> Open Roster
                                </button>
                            </div>

                            {peerSessions.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-6">
                                    <div className="w-20 h-20 rounded-full bg-violet-500/10 flex items-center justify-center text-violet-500 border border-violet-500/20 shadow-[0_0_30px_rgba(139,92,246,0.1)]">
                                        <MessageSquare size={40} />
                                    </div>
                                    <div className="max-w-xs space-y-2">
                                        <h3 className="text-lg font-bold text-white tracking-wide">Signal Void Detected</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed">No active peer links established. Initialize a bridge through the Archivist Roster.</p>
                                    </div>
                                    <button
                                        onClick={() => setIsSidebarOpen(true)}
                                        className="px-8 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-black transition-all shadow-lg active:scale-95 text-xs uppercase tracking-[0.2em] border border-violet-400/20"
                                    >
                                        Initialize Link
                                    </button>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {[...peerSessions]
                                        .sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0))
                                        .map((session) => {
                                            const otherId = session.participants.find((id: string) => id !== user.id);
                                            const vert = verts.find(v => v.uid === otherId);
                                            const isUnread = (session.unreadCount?.[user.id] || 0) > 0;

                                            return (
                                                <button
                                                    key={session.sessionId}
                                                    onClick={() => setSelectedPeerSessionId(session.sessionId)}
                                                    className={`group relative flex items-center gap-4 p-4 rounded-2xl transition-all duration-500 border overflow-hidden ${isUnread
                                                        ? 'bg-violet-600/10 border-violet-500/50 shadow-[0_0_25px_rgba(139,92,246,0.2)]'
                                                        : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/5'
                                                        }`}
                                                >
                                                    {isUnread && (
                                                        <div className="absolute inset-0 bg-violet-500/5 animate-pulse pointer-events-none" />
                                                    )}
                                                    <div className="relative">
                                                        <GlassAvatar
                                                            imageUrl={vert?.profilePictureUrl}
                                                            fallbackChar={vert?.displayName?.[0] || '?'}
                                                            size="w-14 h-14"
                                                            className={isUnread ? "ring-2 ring-violet-400 ring-offset-2 ring-offset-[#0a0c10]" : ""}
                                                        />
                                                        {isUnread && (
                                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-[#0a0c10] shadow-lg animate-bounce">
                                                                {session.unreadCount?.[user.id]}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 text-left overflow-hidden">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className={`font-bold transition-colors ${isUnread ? 'text-white text-lg' : 'text-slate-200'}`}>
                                                                {vert?.displayName || 'Unknown Archivist'}
                                                            </h4>
                                                            {session.lastTimestamp && (
                                                                <span className="text-[10px] font-mono text-slate-500">
                                                                    {formatLifeOSDate(session.lastTimestamp, 'exact')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className={`text-sm truncate mt-0.5 ${isUnread ? 'text-violet-200 font-medium' : 'text-slate-400 font-mono'}`}>
                                                            {session.lastMessage || 'Bridge awaiting signal...'}
                                                        </div>
                                                    </div>

                                                    <ChevronRight size={20} className={`text-slate-600 transition-transform group-hover:translate-x-1 ${isUnread ? 'text-violet-400' : ''}`} />
                                                </button>
                                            )
                                        })
                                    }
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2 mb-4">
                        {searchQuery && (
                            <div className="flex items-center justify-between px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                                <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">
                                    Filtering: {filteredMessages.length} Matches
                                </span>
                                <button onClick={() => setSearchQuery('')} className="text-[8px] font-black text-cyan-500 hover:text-white uppercase transition-colors">Clear</button>
                            </div>
                        )}
                    </div>

                    {filteredMessages.length === 0 && searchQuery ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4">
                            <Search size={40} className="text-slate-700 animate-pulse" />
                            <div className="space-y-1">
                                <h4 className="text-white font-bold uppercase tracking-widest text-sm">No Signal Match</h4>
                                <p className="text-[10px] text-slate-500 font-mono">"{searchQuery}" not found in current uplink history.</p>
                            </div>
                            <button onClick={() => setSearchQuery('')} className="text-[10px] font-black text-cyan-500 hover:text-cyan-400 uppercase tracking-widest border-b border-cyan-500/20 pb-0.5">Reset Archive Scan</button>
                        </div>
                    ) : (
                        renderedMessages
                    )}

                    {thinkingAgentId && (
                        <div className="flex items-end gap-3 mb-4 pl-1">
                            <GlassAvatar
                                imageUrl={user.aiCompanions.find(c => c.id === thinkingAgentId)?.avatarUrl}
                                fallbackChar={user.aiCompanions.find(c => c.id === thinkingAgentId)?.name?.[0] || 'G'}
                                size="w-7 h-7"
                                className="border border-white/10 shadow-lg"
                            />
                            <div className="bg-[#2f3136]/80 backdrop-blur-md rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center border border-white/5 shadow-lg">
                                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}

                    {chatMode === 'peer' && otherParticipantId && typingStatus?.[otherParticipantId] && (
                        <div className="flex items-end gap-3 mb-4 pl-1 animate-in fade-in slide-in-from-left-2 duration-300">
                            <GlassAvatar
                                imageUrl={activeVert?.profilePictureUrl}
                                fallbackChar={activeVert?.displayName?.[0] || '?'}
                                size="w-7 h-7"
                                className="border border-white/10 shadow-lg"
                            />
                            <div className="bg-violet-900/40 backdrop-blur-md rounded-2xl rounded-tl-none px-4 py-3 flex gap-1.5 items-center border border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </div>
        </div>
    );
};
