import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, User, View, LifeEvent, GigiJournalEntry, Tag, Comment, Toast, Media, AiCompanion } from '@/types';
import { useAiChat } from '../hooks/useAiChat';
import { SnowflakeIcon, Tag as TagIconSvg, BrainIcon, ArrowLeft, Users, MoreVertical, Search, X, Cpu, Flame } from 'lucide-react';
import '../styles/incineration.css';

// Sub-components
import MessageBubble from './ai/MessageBubble';
import ChatInput from './ai/ChatInput';
import { NeuralAgentsSidebar } from './ai/NeuralAgentsSidebar'; // [ZEN FIX] New Sidebar
import { GlassAvatar } from './GlassAvatar';

// Utilities
const scrollbarHideClass = "overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']";

const formatChatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (diffDays < 7) {
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        return `${dayName} AT ${timeStr}`;
    }
    return `${date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${date.getDate()} AT ${timeStr}`;
};

interface AiChatProps {
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
    events: LifeEvent[];
    tags: Tag[];
    media?: Media[];
    recentJournalCommentThread: Comment[] | null;
    clearRecentJournalCommentThread: () => void;
    systemPromptPatches: Record<string, string>;
    isFrozen?: boolean;
    addToast: (message: string, type: Toast['type']) => void;
    onDeepDive?: (queryOrEvent: any) => void;
}

const AiChat: React.FC<AiChatProps> = (props) => {
    const { user, onNavigate, isFrozen, addToast, onDeepDive } = props;

    // [ZEN FIX] Destructure new features from the hook
    const {
        messages,
        userInput, setUserInput,
        thinkingAgentId,
        stagedFile, setStagedFile,
        activeContextTag,
        handleFileUpload,
        handleRefreshSession,
        handleDeleteMessage,
        handleEditMessage, // New
        injectMessage,     // New
        handleReaction,
        handleSaveToTag,
        submitMessage
    } = useAiChat({ ...props, addToast });

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isIncinerating, setIsIncinerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Dynamic Model Resolution
    const primaryCompanion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
    const activeAgent = thinkingAgentId
        ? user.aiCompanions.find(c => c.id === thinkingAgentId)
        : primaryCompanion;

    const activeModel = activeAgent?.preferredModel || "Gemini 1.5 Pro";
    const hasFireworksKey = !!user.settings?.fireworksApiKey;

    useEffect(() => {
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, [messages, thinkingAgentId]);

    useEffect(() => {
        const handleIncinerate = () => {
            setIsIncinerating(true);
            // Auto-clear after animation sequence
            setTimeout(() => {
                setIsIncinerating(false);
                props.onHistoryChange([]); // Clear local UI view
            }, 5500);
        };
        window.addEventListener('incinerate-chat', handleIncinerate);
        return () => window.removeEventListener('incinerate-chat', handleIncinerate);
    }, [props]);

    return (
        <div className="flex flex-col h-full bg-[#101014] relative">

            {/* FROZEN OVERLAY */}
            {isFrozen && (
                <div className="absolute inset-0 bg-blue-900/10 z-10 pointer-events-none rounded-xl backdrop-blur-[1px] flex items-center justify-center">
                    <div className="bg-black/80 text-blue-400 px-6 py-3 rounded border border-blue-500/50 flex items-center gap-3 shadow-2xl">
                        <SnowflakeIcon className="w-6 h-6 animate-pulse" />
                        <span className="font-mono font-bold tracking-widest">MOTOR FUNCTIONS FROZEN</span>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="h-14 min-h-[56px] flex items-center justify-between px-4 border-b border-white/5 bg-[#101014]/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => onNavigate('dashboard')} className="p-2 -ml-2 text-gray-400 hover:text-white">
                        <ArrowLeft size={20} />
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-3" onClick={() => setIsSidebarOpen(true)}>
                            {user.aiCompanions.slice(0, 3).map((companion: AiCompanion, idx: number) => (
                                <GlassAvatar
                                    key={companion.id || idx}
                                    imageUrl={companion.avatarUrl}
                                    fallbackChar={companion.name[0]}
                                    size="w-8 h-8"
                                    className={`border-2 border-[#101014] ${idx === 0 ? 'z-30' : idx === 1 ? 'z-20' : 'z-10'}`}
                                />
                            ))}
                            {user.aiCompanions.length === 0 && (
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center border-2 border-[#101014] z-30"><Users size={14} className="text-gray-400" /></div>
                            )}
                        </div>
                        <div onClick={() => setIsSidebarOpen(true)}>
                            <h2 className="text-sm font-bold text-gray-100 tracking-wide">Neural Uplink</h2>
                            <p className="text-[10px] text-cyan-500 font-mono tracking-wider animate-pulse">{thinkingAgentId ? "TRANSMITTING..." : "ACTIVE STREAM"}</p>
                        </div>
                    </div>
                </div>

                {/* NEURAL CORE STATUS BAR */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full border border-white/5">
                    <Cpu size={14} className={hasFireworksKey ? "text-green-400" : "text-yellow-500"} />
                    <div className="flex flex-col items-end leading-none">
                        <span className="text-[10px] text-slate-400 font-bold tracking-wider">NEURAL CORE</span>
                        <span className="text-[10px] font-mono text-cyan-300 max-w-[150px] truncate" title={activeModel}>
                            {activeModel.split('/').pop()}
                        </span>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${thinkingAgentId ? 'bg-green-500 animate-ping' : (hasFireworksKey ? 'bg-green-900' : 'bg-yellow-900')}`} />
                </div>

                <div className="flex gap-2">
                    <button className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5"><Search size={18} /></button>
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5"><MoreVertical size={18} /></button>
                </div>
            </div>

            {/* DRAWER (Updated for NeuralAgentsSidebar) */}
            {isSidebarOpen && (
                <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSidebarOpen(false)}>
                    {/* [ZEN FIX] Adjusted width to w-auto to fit the sidebar component naturally */}
                    <div className="w-auto h-full bg-[#0f1219] border-r border-white/10 shadow-2xl animate-in slide-in-from-left duration-300 flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
                            <span className="text-sm font-bold text-white uppercase tracking-widest mr-8">Neural Agents</span>
                            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
                        </div>

                        {/* [ZEN FIX] New Modular Sidebar */}
                        <div className="flex-1 overflow-y-auto bg-slate-900/50">
                            <NeuralAgentsSidebar
                                agents={user.aiCompanions}
                                onAgentSelect={(agent) => addToast(`Focusing ${agent.name}`, "info")}
                                onInjectMessage={injectMessage}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col flex-1 relative min-w-0 overflow-hidden">
                {/* Context Banner */}
                {activeContextTag && (
                    <div className="absolute top-0 left-0 right-0 z-20 bg-violet-900/90 backdrop-blur-md border-b border-violet-700/50 px-4 py-2 flex justify-between items-center shadow-lg animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 text-violet-100">
                            <TagIconSvg size={16} />
                            <span className="text-sm font-bold truncate">Context: <span className="underline">{activeContextTag.name}</span></span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            {onDeepDive && <button onClick={() => onDeepDive(activeContextTag.name)} className="flex items-center gap-1 text-xs font-bold bg-cyan-500/20 text-cyan-300 px-3 py-1.5 rounded border border-cyan-500/30"><BrainIcon size={14} /> Research</button>}
                            <button onClick={() => onNavigate('tagEditor', { tagId: activeContextTag.id })} className="flex items-center gap-1 text-xs font-bold bg-black/30 px-3 py-1.5 rounded hover:bg-black/50 border border-white/10"><ArrowLeft size={14} /> Editor</button>
                        </div>
                    </div>
                )}

                {/* MESSAGES */}
                <div className={`flex-grow px-3 pt-4 pb-4 ${scrollbarHideClass} ${activeContextTag ? 'pt-14' : ''}`}>
                    <div className="max-w-4xl mx-auto flex flex-col justify-end min-h-full">
                        {messages.map((msg, index) => {
                            const prevMsg = messages[index - 1];
                            const currentDate = new Date(msg.timestamp || Date.now());
                            const prevDate = prevMsg ? new Date(prevMsg.timestamp || Date.now()) : null;
                            const showTimestamp = !prevDate || (currentDate.getTime() - prevDate.getTime() > 20 * 60 * 1000) || (currentDate.getDate() !== prevDate.getDate());

                            return (
                                <React.Fragment key={msg.timestamp?.toString() + index}>
                                    {showTimestamp && (
                                        <div className="flex justify-center my-6 opacity-70">
                                            <span className="text-[10px] font-bold text-white/90 shadow-[0_0_20px_rgba(139,92,246,0.4)] bg-black/50 px-3 py-1 rounded-full border border-violet-400/30 uppercase tracking-wider backdrop-blur-sm">
                                                {formatChatTimestamp(currentDate)}
                                            </span>
                                        </div>
                                    )}
                                    <MessageBubble
                                        msg={msg}
                                        user={user}
                                        onNavigate={onNavigate}
                                        onDelete={() => handleDeleteMessage(index)}
                                        onEdit={(newContent) => handleEditMessage(index, newContent)}
                                        onReact={(emoji: string) => handleReaction(index, emoji)}
                                        onFeedback={(isPositive: boolean) => addToast(isPositive ? "Recorded!" : "Recorded.", "info")}
                                        onSaveToContext={activeContextTag && msg.role === 'model' ? handleSaveToTag : undefined}
                                        isIncinerating={isIncinerating}
                                    />
                                </React.Fragment>
                            );
                        })}

                        {thinkingAgentId && (
                            <div className="flex items-end gap-3 mb-4 pl-1">
                                <div className="w-7 h-7 rounded-full bg-gray-800 animate-pulse border border-white/10" />
                                <div className="bg-[#2f3136] rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center border border-white/5 shadow-lg">
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />

                        {isIncinerating && (
                            <div className="portal-bloom-overlay">
                                <div className="portal-bloom-effect" />
                            </div>
                        )}
                    </div>
                </div>

                {/* INPUT */}
                <div className="shrink-0 bg-[#101014] border-t border-white/5 z-20">
                    <ChatInput
                        userInput={userInput} setUserInput={setUserInput} onSend={() => submitMessage(!!isFrozen)}
                        isFrozen={!!isFrozen} isThinking={!!thinkingAgentId}
                        onRefreshSession={handleRefreshSession}
                        stagedFile={stagedFile} setStagedFile={setStagedFile}
                        fileInputRef={fileInputRef} onFileUpload={handleFileUpload}
                        user={user}
                    />
                </div>
            </div>
        </div>
    );
};

export default AiChat;