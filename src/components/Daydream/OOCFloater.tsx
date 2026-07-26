import React, { useState, useRef, useEffect } from 'react';
import { Draggable } from '../Draggable';
import { useOOCChat } from '../../hooks/useOOCChat';
import { User } from '../../types';
import { X, MessageSquare, Send, Minimize2, Maximize2, Hash, Calendar } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import { GlassAvatar } from '../GlassAvatar';
import { appDataService } from '../../services/serviceManager';

interface OOCFloaterProps {
    user: User;
    storyId: string;
    storyTitle: string;
    onClose: () => void;
}

export const OOCFloater: React.FC<OOCFloaterProps> = ({ user, storyId, storyTitle, onClose }) => {
    const { messages, sendMessage, isThinking } = useOOCChat({ user, storyId, storyTitle });
    const [input, setInput] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];

    // --- DATA HYDRATION ---
    const [availableTags, setAvailableTags] = useState<any[]>([]);
    const [availableEvents, setAvailableEvents] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredTags, setFilteredTags] = useState<any[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadDt = async () => {
            if (user.id) {
                try {
                    const [t, e] = await Promise.all([
                        appDataService.getAllTags(user.id),
                        appDataService.getAllEvents(user.id)
                    ]);
                    setAvailableTags(t);
                    setAvailableEvents(e);
                } catch (err) { console.error("Error loading contexts", err); }
            }
        };
        loadDt();
    }, [user.id]);

    useEffect(() => {
        // [ZEN FIX] Scroll to bottom on message change (Optimized)
        const anchor = document.getElementById("ooc-scroll-anchor");
        if (anchor) {
            anchor.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages, isThinking]);

    // --- MENTION LOGIC ---
    useEffect(() => {
        const lastWord = input.split(' ').pop();
        if (lastWord && lastWord.startsWith('@') && lastWord.length > 1 && !lastWord.includes('x_')) {
            const query = lastWord.substring(1).toLowerCase();
            const matches = availableTags.filter(t => t.name.toLowerCase().includes(query));
            setFilteredTags(matches.slice(0, 5));
            setShowSuggestions(matches.length > 0);
        } else {
            setShowSuggestions(false);
        }
    }, [input, availableTags]);

    const injectTag = (tagName: string) => {
        const words = input.split(' ');
        words.pop(); // Remove partial
        setInput(words.join(' ') + ' @' + tagName + ' ');
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        // 1. Resolve Contexts
        let hydrationContext = "";

        // Parse @Tags
        const tagMatches = input.match(/@(\w+)/g);
        if (tagMatches) {
            tagMatches.forEach(match => {
                // exclude @x_
                if (match.startsWith('@x_')) return;
                const tagName = match.substring(1);
                const tag = availableTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
                if (tag) {
                    hydrationContext += `\n[CONTEXT: Tag "${tag.name}"]\nDescription: ${tag.description || 'N/A'}\nType: ${tag.type || 'General'}\n`;
                }
            });
        }

        // Parse @x_Date (e.g. @x_04/15/1985)
        const dateMatches = input.match(/@x_(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/g);
        if (dateMatches) {
            dateMatches.forEach(match => {
                const dateStr = match.substring(3).replace(/-/g, '/');
                const targetDate = new Date(dateStr);
                if (!isNaN(targetDate.getTime())) {
                    // Find events +/- 7 days
                    const nearEvents = availableEvents.filter(e => {
                        const eDate = new Date(e.date); // assuming 'date' field exists
                        const diffTime = Math.abs(targetDate.getTime() - eDate.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return diffDays <= 7;
                    });

                    if (nearEvents.length > 0) {
                        hydrationContext += `\n[CONTEXT: Events around ${dateStr}]\n`;
                        nearEvents.forEach(e => {
                            hydrationContext += `- ${e.date ? new Date(e.date).toLocaleDateString() : ''}: ${e.title} (${e.description || ''})\n`;
                        });
                    } else {
                        hydrationContext += `\n[CONTEXT: No events found around ${dateStr}]\n`;
                    }
                }
            });
        }

        sendMessage(input, hydrationContext);
        setInput('');
    };

    if (isMinimized) {
        return (
            <div className="fixed bottom-20 right-8 z-[100] flex gap-2 items-center bg-[#09090b]/90 backdrop-blur-xl border border-white/10 p-2 rounded-full shadow-2xl animate-in fade-in zoom-in-95 cursor-default">
                <GlassAvatar imageUrl={companion.avatarUrl} altText={companion.name} size="w-10 h-10" className="border border-white/20" />
                <div className="flex flex-col mr-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OOC Chat</span>
                    <span className="text-xs text-white font-bold">{companion.name}</span>
                </div>
                <button onClick={() => setIsMinimized(false)} className="p-1 hover:bg-white/10 rounded-full text-cyan-400"><Maximize2 size={14} /></button>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full text-slate-500"><X size={14} /></button>
            </div>
        );
    }

    return (
        <Draggable initialPosition={{ x: window.innerWidth - 400, y: 100 }} className="fixed" persistenceKey="ooc_floater_pos">
            <div className="w-[350px] h-[500px] flex flex-col bg-[#09090b]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 cursor-default">
                {/* HEADER */}
                <div className="h-12 border-b border-white/10 flex items-center justify-between px-3 bg-black/40">
                    <div className="flex items-center gap-2">
                        <GlassAvatar imageUrl={companion.avatarUrl} altText={companion.name} size="w-8 h-8" className="border border-white/10" />
                        <div className="leading-tight">
                            <div className="text-xs font-bold text-white flex items-center gap-1">
                                {companion.name} <span className="text-[9px] px-1 bg-violet-500/20 text-violet-300 rounded uppercase">OOC</span>
                            </div>
                            <div className="text-[10px] text-slate-400">Discussing "{storyTitle}"</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setIsMinimized(true)} className="p-1.5 hover:bg-white/10 rounded text-slate-400"><Minimize2 size={14} /></button>
                        <button onClick={onClose} className="p-1.5 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400"><X size={14} /></button>
                    </div>
                </div>

                {/* MESSAGES */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 bg-black/20" ref={scrollRef}>
                    {messages.length === 0 && (
                        <div className="text-center py-10 opacity-50 text-xs">
                            <MessageSquare size={24} className="mx-auto mb-2 text-violet-400" />
                            <p>Discuss the plot, characters, or ask for feedback.</p>
                            <p className="mt-2 text-slate-500">Tip: Type @Tag for context or @x_MM/DD/YYYY for time travel.</p>
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
                            <div className="flex items-end gap-2 max-w-[90%]">
                                {m.role !== 'user' && (
                                    <GlassAvatar imageUrl={companion.avatarUrl} size="w-6 h-6" className="mb-1" />
                                )}
                                <div
                                    className={`relative px-4 py-2.5 text-sm shadow-sm
                                        ${m.role === 'user'
                                            ? 'bg-cyan-600 text-white rounded-2xl rounded-tr-none'
                                            : m.role === 'system'
                                                ? 'bg-red-900/40 text-red-200 border border-red-500/30 rounded-xl w-full text-center text-xs italic'
                                                : 'bg-[#1e1e1e] text-slate-200 border border-white/5 rounded-2xl rounded-tl-none'
                                        }`}
                                >
                                    {/* Content */}
                                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                                    {/* Timestamp (Simulated) */}
                                    <div className={`text-[10px] mt-1 opacity-50 ${m.role === 'user' ? 'text-right text-cyan-200' : 'text-left text-slate-500'}`}>
                                        Just now
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {isThinking && (
                        <div className="flex items-start gap-2 animate-pulse">
                            <GlassAvatar imageUrl={companion.avatarUrl} size="w-6 h-6" />
                            <div className="bg-[#1e1e1e] px-4 py-3 rounded-2xl rounded-tl-none border border-white/5">
                                <span className="flex gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-75" />
                                    <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150" />
                                </span>
                            </div>
                        </div>
                    )}
                    {/* [ZEN FIX] Invisible anchor for auto-scroll */}
                    <div id="ooc-scroll-anchor" />
                </div>

                {/* INPUT */}
                <div className="p-3 border-t border-white/10 bg-black/40 relative">
                    {/* SUGGESTIONS */}
                    {showSuggestions && (
                        <div className="absolute bottom-full mb-2 left-3 w-[200px] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20">
                            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase bg-black/20">Suggestions</div>
                            <div className="max-h-32 overflow-y-auto">
                                {filteredTags.map(tag => (
                                    <button
                                        key={tag.id}
                                        onClick={() => injectTag(tag.name)}
                                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-violet-500/20 hover:text-white flex items-center gap-2"
                                    >
                                        <Hash size={12} className="text-violet-400" /> {tag.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="relative">
                        <input
                            ref={inputRef}
                            className="w-full bg-white/5 border border-white/10 rounded-full pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder-white/20"
                            placeholder="Brief Brita... (@Tag or @x_Date)"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isThinking}
                            className="absolute right-1 top-1 p-1.5 bg-cyan-500 text-black rounded-full hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </div>

            </div>
        </Draggable>
    );
};

