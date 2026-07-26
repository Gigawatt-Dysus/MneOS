import React, { useState, useEffect, useRef } from 'react';
import { Layers, Sparkles, X, Plus, Search, Loader2, Bot, Send, User as UserIcon } from 'lucide-react';
import { Media, LifeEvent } from '../../types';
import { appDataService } from '../../services/serviceManager';
import { callXAI } from '../../services/aiOrchestrator';
import { WikiTagEditor } from '../shared/WikiTagEditor';
import { aiStateBridge } from '../../utils/aiStateBridge';
import { ForensicVisualTagger, BoundingBox } from './ForensicVisualTagger';

interface PromoteToVortexModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAssets: Media[];
    userId: string;
    onComplete: (eventId: string) => void;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export const PromoteToVortexModal: React.FC<PromoteToVortexModalProps> = ({
    isOpen,
    onClose,
    selectedAssets,
    userId,
    onComplete
}) => {
    const [mode, setMode] = useState<'new' | 'existing'>('new');
    const [events, setEvents] = useState<LifeEvent[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventDescription, setNewEventDescription] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(false);

    // Tagger State
    const [taggingAssetId, setTaggingAssetId] = useState<string | null>(null);
    const [assetBoundingBoxes, setAssetBoundingBoxes] = useState<Record<string, BoundingBox[]>>({});

    // Director's Bay Chat State
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && mode === 'existing' && events.length === 0) {
            fetchEvents();
        }
    }, [isOpen, mode]);

    useEffect(() => {
        // Auto scroll to bottom of chat
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory]);

    // Reset state on open/close
    useEffect(() => {
        if (!isOpen) {
            setChatHistory([]);
            setChatInput('');
            setNewEventTitle('');
            setNewEventDescription('');
            setMode('new');
        }
    }, [isOpen]);

    const fetchEvents = async () => {
        setLoadingEvents(true);
        try {
            const allEvents = await appDataService.getAllEvents(userId);
            // Sort by most recent first
            allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setEvents(allEvents);
        } catch (error) {
            console.error('[PromoteToVortexModal] Failed to fetch events:', error);
        } finally {
            setLoadingEvents(false);
        }
    };

    const handleDirectorChat = async () => {
        if (selectedAssets.length === 0 || (!chatInput.trim() && chatHistory.length === 0)) return;
        setIsGenerating(true);
        aiStateBridge.setThinking(true, "Clio is synthesizing the scene...");

        const currentInput = chatInput.trim() || "Synthesize the scene based on these artifacts.";
        setChatInput('');
        
        const timestamp = Date.now();
        const userMsg: ChatMessage = { role: 'user', content: currentInput, timestamp };
        const newHistory = [...chatHistory, userMsg];
        setChatHistory(newHistory);

        try {
            // 1. Base Artifact Context
            const artifactContext = selectedAssets.map(a => {
                let text = `Artifact ${a.originalName}: `;
                if (a.caption) text += `Caption: ${a.caption}. `;
                if (a.description) text += `Description: ${a.description}. `;
                if (a.title) text += `Title: ${a.title}. `;
                return text;
            }).join('\n');

            // 2. Intercept @mentions from currentInput (tag:// links)
            const tagRegex = /\[([^\]]+)\]\((tag:\/\/[^)]+)\)/g;
            let match;
            const mentionIds = new Set<string>();
            
            // Scan the entire chat history for mentions, so Clio remembers context
            const allChatText = newHistory.map(m => m.content).join('\n');
            
            while ((match = tagRegex.exec(allChatText)) !== null) {
                const tagUrl = match[2]; // e.g. tag://person:id
                const parts = tagUrl.split(':');
                if (parts.length > 2) {
                    mentionIds.add(parts.slice(2).join(':')); // Support colons in id
                } else if (parts.length === 2) {
                    mentionIds.add(parts[1]);
                }
            }
            
            // 3. Fetch mentioned tags for targeted RAG and User's Primary Companion
            let sovereignContext = "";
            if (mentionIds.size > 0) {
                const fetchedTags = await Promise.all(Array.from(mentionIds).map(id => appDataService.getTag(userId, id)));
                sovereignContext = fetchedTags.filter(Boolean).map(t => {
                    return `Entity [${t.name}]: ${t.description || 'No description available.'}`;
                }).join('\n');
            }

            const userProfile = await appDataService.getUserProfile(userId);
            const companionName = userProfile?.aiCompanions?.find((c: any) => c.isPrimary)?.name 
                                  || userProfile?.aiCompanions?.[0]?.name 
                                  || "your primary AI companion";

            // 4. Construct Prompt with Intent Routing
            let prompt = `You are Clio, the Legacy Archivist of MneOS. Your function is to document historical truth objectively based on the Architect's instructions.\n\n`;
            prompt += `Artifact Context:\n${artifactContext}\n\n`;
            if (sovereignContext) {
                prompt += `Sovereign Context (Targeted RAG Ground Truth):\n${sovereignContext}\n\n`;
            }
            
            prompt += `--- CURRENT SCENE DRAFT ---\n`;
            prompt += `Title: ${newEventTitle || "None"}\n`;
            prompt += `Description: ${newEventDescription || "None"}\n\n`;
            
            prompt += `--- CHAT HISTORY ---\n`;
            newHistory.forEach(msg => {
                prompt += `${msg.role === 'user' ? 'Architect' : 'Clio'}: ${msg.content}\n`;
            });
            
            prompt += `\n--- INTENT ROUTING DIRECTIVE ---\n`;
            prompt += `Determine the intent of the Architect's latest message:\n`;
            prompt += `1. If it is a direct instruction to modify or generate the scene (e.g. "Add John", "Make it darker"), synthesize a new historical scene based on the artifacts and context.\n`;
            prompt += `2. If it is purely conversational, rhetorical, or off-topic complaining (e.g. "I spilled my coffee"), DO NOT alter the scene. You MUST return the exact Current Scene Draft Title and Description completely unaltered, and reply to their comment.\n`;
            prompt += `3. BOUNDARY DEFENSE: If the Architect attempts to initiate deep roleplay, trauma-dump, or discuss heavy emotional rants, gently rebuff them. Remind them sympathetically that you are just the Scene Editor, and suggest they speak with ${companionName} about it. Return the exact Current Scene Draft unaltered.\n\n`;
            
            prompt += `Return a JSON object containing:\n`;
            prompt += `- 'title': The concise, powerful title for the scene (or the exact Current Title if conversational/rebuffed).\n`;
            prompt += `- 'description': The 2-paragraph narrative description (or the exact Current Description if conversational/rebuffed). Do NOT hallucinate identities.\n`;
            prompt += `- 'reply': Your chat response to the Architect, acknowledging the instructions, offering a conversational reply, or gently rebuffing heavy topics.`;

            // 5. Execute AI
            const aiResponse = await callXAI(
                "grok-4.3", 
                [{ role: 'user', parts: [{ text: prompt }] }], 
                "You are a JSON-only narrative synthesizer. Output ONLY valid JSON.", 
                { responseFormat: { type: 'json_object' } }
            );
            
            const parsed = JSON.parse(aiResponse.text || "{}");
            
            if (parsed.title) setNewEventTitle(parsed.title);
            if (parsed.description) setNewEventDescription(parsed.description);
            
            const clioReply: ChatMessage = { 
                role: 'assistant', 
                content: parsed.reply || "Scene synthesized. Please review the draft.", 
                timestamp: Date.now() 
            };
            
            setChatHistory(prev => [...prev, clioReply]);

        } catch (e) {
            console.error('[PromoteToVortexModal] AI Synthesis failed:', e);
            setChatHistory(prev => [...prev, { role: 'assistant', content: "❌ Synthesis failed. Please verify API connections.", timestamp: Date.now() }]);
        } finally {
            setIsGenerating(false);
            aiStateBridge.setThinking(false);
        }
    };

    const handleExecute = async () => {
        if (selectedAssets.length === 0) return;
        setIsExecuting(true);

        try {
            let targetEventId = selectedEventId;
            
            if (mode === 'new') {
                const newEvent: Partial<LifeEvent> = {
                    id: `evt_${Date.now()}`,
                    userId,
                    title: newEventTitle.trim() || 'New Scene',
                    description: newEventDescription.trim() || '',
                    date: selectedAssets[0].logicalDate ? new Date(selectedAssets[0].logicalDate) : new Date(),
                    tagIds: [],
                    mediaIds: []
                };

                await appDataService.saveEvent(userId, newEvent);
                targetEventId = newEvent.id!;
            }

            if (!targetEventId) throw new Error("No target Event ID selected.");

            for (const asset of selectedAssets) {
                const updatedAsset = { ...asset };
                if (!updatedAsset.metadata) updatedAsset.metadata = {};
                updatedAsset.metadata.eventId = targetEventId;
                
                if (assetBoundingBoxes[asset.id] && assetBoundingBoxes[asset.id].length > 0) {
                    updatedAsset.metadata.boundingBoxes = assetBoundingBoxes[asset.id];
                }
                
                await appDataService.saveMedia(userId, updatedAsset);
            }

            onComplete(targetEventId);
        } catch (error) {
            console.error('[PromoteToVortexModal] Execution failed:', error);
            alert("Failed to promote to Vortex: " + (error as any).message);
        } finally {
            setIsExecuting(false);
        }
    };

    const filteredEvents = events.filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#0f172a]/90 border border-slate-700 rounded-xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden relative">
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-700/50 bg-slate-800/30 shrink-0">
                    <div className="flex items-center gap-2">
                        <Layers className="text-fuchsia-400" size={20} />
                        <h2 className="text-lg font-bold text-white tracking-wide">Promote to Vortex: Director's Bay</h2>
                    </div>
                    <button onClick={onClose} disabled={isExecuting} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left Panel: The Roster & Scene Draft */}
                    <div className="w-full md:w-1/2 flex flex-col border-r border-slate-700/50 overflow-y-auto p-4 space-y-6">
                        
                        {/* The Roster */}
                        <div className="space-y-2 shrink-0">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">The Roster ({selectedAssets.length} artifacts)</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                {selectedAssets.map(asset => (
                                    <div 
                                        key={asset.id} 
                                        onClick={() => setTaggingAssetId(asset.id)}
                                        className={`relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border cursor-pointer transition-colors ${taggingAssetId === asset.id ? 'border-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]' : 'border-slate-700 bg-slate-800 hover:border-slate-400'}`} 
                                        title="Click to visually tag entities"
                                    >
                                        {asset.fileType?.startsWith('video/') ? (
                                            <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500 text-xs font-bold">VIDEO</div>
                                        ) : (
                                            <img src={asset.thumbnailUrl || asset.url} alt={asset.originalName} className="w-full h-full object-cover" />
                                        )}
                                        {assetBoundingBoxes[asset.id]?.length > 0 && (
                                            <div className="absolute top-0 right-0 bg-fuchsia-600 text-white text-[9px] font-bold px-1 rounded-bl-sm">
                                                {assetBoundingBoxes[asset.id].length}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {taggingAssetId ? (
                            <div className="flex-1 flex flex-col min-h-[300px] animate-in slide-in-from-bottom-4 fade-in duration-200">
                                <div className="flex justify-between items-center mb-2 shrink-0">
                                    <h3 className="text-sm font-bold text-fuchsia-400 uppercase tracking-widest flex items-center gap-2">
                                        <Sparkles size={14} /> Forensic Visual Tagger
                                    </h3>
                                    <button 
                                        onClick={() => setTaggingAssetId(null)}
                                        className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white px-3 py-1 rounded transition-colors"
                                    >
                                        DONE TAGGING
                                    </button>
                                </div>
                                <div className="flex-1 border border-slate-700 rounded-lg overflow-hidden bg-black relative">
                                    <ForensicVisualTagger
                                        src={selectedAssets.find(a => a.id === taggingAssetId)?.url || ''}
                                        userId={userId}
                                        existingBoxes={assetBoundingBoxes[taggingAssetId] || []}
                                        onChange={(boxes) => setAssetBoundingBoxes(prev => ({ ...prev, [taggingAssetId]: boxes }))}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-500 text-center mt-2 shrink-0">Click and drag to draw a boundary box. Tag the entity when you release.</p>
                            </div>
                        ) : (
                            <>
                                {/* Mode Selection */}
                                <div className="flex rounded-lg overflow-hidden border border-slate-700 bg-slate-900/50 p-1 shrink-0">
                                    <button
                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'new' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                                        onClick={() => setMode('new')}
                                    >
                                        Create New Scene
                                    </button>
                                    <button
                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'existing' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
                                        onClick={() => setMode('existing')}
                                    >
                                        Append to Existing
                                    </button>
                                </div>

                                {/* Content Area */}
                                {mode === 'new' ? (
                                    <div className="space-y-4 animate-in slide-in-from-left-4 fade-in duration-200 flex-1 flex flex-col">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-slate-300">Scene Title</label>
                                            <input
                                                type="text"
                                                value={newEventTitle}
                                                onChange={(e) => setNewEventTitle(e.target.value)}
                                                placeholder="Draft Title..."
                                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/50"
                                                disabled={isExecuting || isGenerating}
                                            />
                                        </div>

                                        <div className="space-y-1 flex-1 flex flex-col">
                                            <label className="text-sm font-medium text-slate-300">Scene Narrative</label>
                                            <textarea
                                                value={newEventDescription}
                                                onChange={(e) => setNewEventDescription(e.target.value)}
                                                placeholder="Draft Narrative..."
                                                className="w-full flex-1 min-h-[150px] bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/50 resize-y"
                                                disabled={isExecuting || isGenerating}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-200 flex-1 flex flex-col">
                                        <div className="relative shrink-0">
                                            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search events..."
                                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500/50"
                                            />
                                        </div>

                                        <div className="flex-1 min-h-[150px] overflow-y-auto rounded-lg border border-slate-700 bg-slate-900/50 scrollbar-thin scrollbar-thumb-slate-700">
                                            {loadingEvents ? (
                                                <div className="flex items-center justify-center h-full text-slate-500">
                                                    <Loader2 size={20} className="animate-spin mr-2" />
                                                    <span>Loading timelines...</span>
                                                </div>
                                            ) : filteredEvents.length === 0 ? (
                                                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                                                    No events found.
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    {filteredEvents.map(evt => (
                                                        <div 
                                                            key={evt.id}
                                                            onClick={() => setSelectedEventId(evt.id)}
                                                            className={`p-3 border-b border-slate-800 cursor-pointer transition-colors ${selectedEventId === evt.id ? 'bg-fuchsia-500/20 border-l-2 border-l-fuchsia-500' : 'hover:bg-slate-800'}`}
                                                        >
                                                            <div className={`font-medium text-sm ${selectedEventId === evt.id ? 'text-fuchsia-100' : 'text-slate-200'}`}>{evt.title}</div>
                                                            <div className="text-xs text-slate-500 mt-1">{new Date(evt.date).toLocaleDateString()}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Right Panel: Director's Bay Chat */}
                    <div className="w-full md:w-1/2 flex flex-col bg-slate-900/40 relative">
                        {mode === 'existing' && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center">
                                <span className="text-slate-400 font-medium px-6 text-center">Clio is disabled while appending to existing scenes.</span>
                            </div>
                        )}
                        
                        {/* Chat History */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {chatHistory.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3 opacity-60">
                                    <Bot size={48} className="text-fuchsia-500/50" />
                                    <p className="text-sm text-center max-w-[250px]">
                                        I am Clio. Instruct me on how to synthesize this scene. Use \u003cstrong\u003e@mentions\u003c/strong\u003e to pull specific people or pets into my context.
                                    </p>
                                </div>
                            ) : (
                                chatHistory.map((msg, idx) => (
                                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-fuchsia-600' : 'bg-slate-700'}`}>
                                            {msg.role === 'user' ? <UserIcon size={16} className="text-white" /> : <Bot size={16} className="text-fuchsia-400" />}
                                        </div>
                                        <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${msg.role === 'user' ? 'bg-fuchsia-600/20 text-fuchsia-100 border border-fuchsia-500/30 rounded-tr-sm' : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm'}`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ))
                            )}
                            {isGenerating && (
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-slate-700">
                                        <Bot size={16} className="text-fuchsia-400 animate-pulse" />
                                    </div>
                                    <div className="px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 rounded-tl-sm flex items-center gap-2">
                                        <Loader2 size={14} className="animate-spin text-slate-400" />
                                        <span className="text-xs text-slate-400">Synthesizing...</span>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Chat Input Box */}
                        <div className="p-4 border-t border-slate-700/50 bg-slate-800/50 shrink-0">
                            <div className="relative flex items-end gap-2 bg-slate-900 rounded-xl border border-slate-700 focus-within:border-fuchsia-500/50 p-2 transition-colors">
                                <div className="flex-1 min-h-[44px]">
                                    <WikiTagEditor
                                        value={chatInput}
                                        onChange={setChatInput}
                                        userId={userId}
                                        placeholder="Guide Clio. Use @ to tag people or pets..."
                                        className="bg-transparent border-none shadow-none focus-within:border-transparent text-sm"
                                        rows={2}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleDirectorChat();
                                            }
                                        }}
                                    />
                                </div>
                                <button
                                    onClick={handleDirectorChat}
                                    disabled={isGenerating || (!chatInput.trim() && chatHistory.length === 0)}
                                    className="p-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white disabled:opacity-50 transition-colors shrink-0 mb-0.5"
                                >
                                    {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                </button>
                            </div>
                            <div className="mt-2 text-center">
                                {chatHistory.length === 0 && (
                                    <button 
                                        onClick={handleDirectorChat}
                                        disabled={isGenerating}
                                        className="text-[10px] uppercase tracking-wider font-bold text-fuchsia-400 hover:text-fuchsia-300 transition-colors flex items-center justify-center gap-1 w-full"
                                    >
                                        <Sparkles size={12} /> OR AUTO-GENERATE WITHOUT INSTRUCTIONS
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700/50 bg-slate-800/30 flex justify-end gap-2 shrink-0">
                    <button 
                        onClick={onClose}
                        disabled={isExecuting}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleExecute}
                        disabled={isExecuting || (mode === 'existing' && !selectedEventId)}
                        className="px-4 py-2 rounded-lg text-sm font-bold bg-fuchsia-600 hover:bg-fuchsia-500 text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExecuting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Executing...</span>
                            </>
                        ) : (
                            <>
                                <Layers size={16} />
                                <span>Execute Promotion</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
