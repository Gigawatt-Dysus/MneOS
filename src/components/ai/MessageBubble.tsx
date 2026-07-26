import React, { useState, useRef, useEffect } from 'react';
import { TrashIcon, ClipboardIcon, EmojiIcon, XIcon, EllipsisVerticalIcon, ThumbsUpIcon, ThumbsDownIcon } from '../icons';
import { Save, Pencil, Volume2, Download, Sparkles, Zap, Mail } from 'lucide-react';
import { sanitizeContent } from '../../utils/textUtils';
import type { ChatMessage, User, View } from '../../types';
import MarkdownRenderer from './MarkDownRenderer';
import { GlassAvatar } from '../GlassAvatar';
import { MarkdownEditor } from '../shared/MarkdownEditor';
import { SimulationReader } from './SimulationReader';
import { QUICK_REACTIONS } from '../../types';

interface MessageBubbleProps {
    msg: ChatMessage;
    user: User;
    onNavigate: (view: View, data?: any) => void;
    onDelete?: () => void;
    onEdit?: (newContent: string) => void;
    onReact?: (emoji: string) => void;
    onFeedback?: (isPositive: boolean) => void;
    onSaveToContext?: (text: string) => void;
    onSaveToMatrix?: (msg: ChatMessage) => void;
    onPromoteToCore?: (msg: ChatMessage) => void;
    onSetFiction?: (msg: ChatMessage, status: boolean) => void; // [ZEN V14]
    // [ZEN V14] Bulk Mode
    isBulkMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: () => void;
    otherLastReadTimestamp?: number;
    userPresets?: any[]; // [ZEN EWO #120] Prop Drill
    onSpeak?: (text: string, voiceId?: string, modelId?: string, companionId?: string, isUser?: boolean) => void; // [ZEN]
    onDownloadAudio?: (text: string, voiceId?: string, modelId?: string, companionId?: string, isUser?: boolean) => void; // [ZEN]
    onCognitiveOverride?: () => void; // [ZEN]
    onManualDriftFlag?: (reason: string) => void; // [ZEN] Manual Drift Protocol
    anteContext?: any[]; // [ZEN FIX] Atmospheric Sync
    subContext?: any[]; // [ZEN FIX] Atmospheric Sync
    tags?: any[]; // [ZEN] EmoDB Tensor Resolution
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
    msg, user, onNavigate, onDelete, onEdit, onReact, onFeedback, onSaveToContext, onSaveToMatrix, onPromoteToCore, 
    onSetFiction, isBulkMode, isSelected, onToggleSelect, otherLastReadTimestamp, userPresets = [], onSpeak, 
    onDownloadAudio, onCognitiveOverride, onManualDriftFlag, anteContext = [], subContext = [], tags = [] 
}) => {
    const [showMeta, setShowMeta] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showDriftMenu, setShowDriftMenu] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [frameIndex, setFrameIndex] = useState(0); // [ZEN] Flipbook State
    const [isAnimating, setIsAnimating] = useState(false); // [ZEN] Flipbook State
    const safeContent = msg.content || '';
    const [editContent, setEditContent] = useState(safeContent);
    const menuRef = useRef<HTMLDivElement>(null);

    const displayContent = msg.source === 'email' ? sanitizeContent(safeContent) : safeContent;

    // Identity Resolution
    const isPeerSegment = 'fromUid' in msg;
    const isUser = isPeerSegment ? (msg as any).fromUid === user.id : msg.role === 'user';
    const isSystem = msg.role === 'system';

    // Resolve Author Data
    let authorName = '';
    let authorAvatar = '';
    let companionData: any = null;
    let authorTag: any = null;

    if (isPeerSegment) {
        const seg = msg as any;
        authorName = seg.fromName;
        authorAvatar = seg.fromAvatarUrl || '';
        if (seg.authorType === 'ai') {
            companionData = user.aiCompanions.find(c => c.id === seg.responderAgentId || c.name === seg.fromName);
        }
        authorTag = tags.find(t => t.type === 'person' && t.name === authorName);
    } else if (isUser) {
        authorName = user.displayName || 'Operator';
        authorAvatar = user.profilePictureUrl || '';
        authorTag = tags.find(t => t.id === user.personTagId);
    } else {
        const auth = msg.author || (user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0]);
        authorName = auth.name;
        authorAvatar = auth.avatarUrl;
        companionData = user.aiCompanions.find(c => c.name === auth.name);
        authorTag = tags.find(t => t.type === 'person' && t.name === authorName);
    }

    // [ZEN] EmoDB Identity-Locked Tensor Resolution
    const tensorMap = authorTag?.tensorMap;
    let vibeFrames: string[] = [];

    // Extract the first tone/vibe tag from the text e.g. [Happy] or [Vibe: Wistful]
    const vibeMatch = safeContent.match(/\[(.*?)\]/);
    let vibe = vibeMatch ? vibeMatch[1] : null;

    if (vibe) {
        const vLower = vibe.toLowerCase();
        if (vLower.startsWith('vibe: ')) vibe = vibe.substring(6).trim();
        else if (vLower.startsWith('tone: ')) vibe = vibe.substring(6).trim();

        if (tensorMap) {
            // Partial case-insensitive match against the tensor map keys
            const key = Object.keys(tensorMap).find(k => 
                k.toLowerCase() === vibe!.toLowerCase() || 
                vibe!.toLowerCase().includes(k.toLowerCase()) || 
                k.toLowerCase().includes(vibe!.toLowerCase())
            );
            if (key && tensorMap[key]?.length > 0) {
                vibeFrames = tensorMap[key];
                authorAvatar = vibeFrames[0]; // Hero Frame defaults to index 0
            }
        }
    }

    // [ZEN] Flipbook Animation Protocol
    useEffect(() => {
        if (isAnimating && vibeFrames.length > 1) {
            const interval = setInterval(() => {
                setFrameIndex(prev => {
                    if (prev >= vibeFrames.length - 1) {
                        setIsAnimating(false);
                        return prev; // Hold on last frame of the burst
                    }
                    return prev + 1;
                });
            }, 150); // 150ms per frame as requested
            return () => clearInterval(interval);
        } else if (!isAnimating && frameIndex !== 0) {
            const timeout = setTimeout(() => setFrameIndex(0), 2000); // Reset to hero frame after 2 seconds
            return () => clearTimeout(timeout);
        }
    }, [isAnimating, vibeFrames.length, frameIndex]);

    const handleAvatarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (vibeFrames.length > 1 && !isAnimating) {
            setFrameIndex(0);
            setIsAnimating(true);
        } else {
            onNavigate(companionData ? 'aiCompanionEditor' : 'archivists');
        }
    };

    // [ZEN FIX] Use User Settings for Quick Reactions
    const reactionsList = user.settings?.preferredEmojis?.length
        ? user.settings.preferredEmojis
        : QUICK_REACTIONS;

    const bubbleClass = isUser ? 'rounded-2xl text-white' : 'rounded-2xl text-gray-100';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false);
                setShowReactionPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(safeContent);
        setShowMenu(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (onDelete) {
            onDelete();
            setShowMenu(false);
        }
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditContent(safeContent);
        setIsEditing(true);
        setShowMenu(false);
    };

    const handleSaveEdit = (contentToSave: string) => {
        if (onEdit && contentToSave.trim() !== safeContent) {
            onEdit(contentToSave);
        }
        setIsEditing(false);
    };

    // [ZEN V35] Email Source Indicator
    const renderSourceIndicator = () => {
        if (msg.source !== 'email') return null;
        return (
            <div className="flex items-center gap-2 mb-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg w-fit">
                <Mail size={10} className="text-blue-400" />
                <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Secure Transmission (Email)</span>
            </div>
        );
    };

    const handleReactionClick = (emoji: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (onReact) onReact(emoji);
        setShowReactionPicker(false);
    };

    const renderMedia = () => {
        if (!msg.imageUrl || msg.isDeleted) return null;
        
        const isArtifact = msg.imageUrl.match(/\.(md|json|txt|pdf)(\?.*)?$/i) || (msg.mimeType && (msg.mimeType.includes('json') || msg.mimeType.includes('markdown') || msg.mimeType.includes('text') || msg.mimeType.includes('pdf')));
        if (isArtifact) {
            const isSimulationTranscript = msg.imageUrl.includes('_transcript.') || msg.is_fiction;
            return (
                <div className="relative">
                    {isSimulationTranscript && (
                        <div className="absolute -top-3 right-2 bg-fuchsia-900/80 text-fuchsia-200 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-fuchsia-500/30 z-10 backdrop-blur-sm shadow-[0_0_10px_rgba(217,70,239,0.2)]" title="This artifact originated from a sandboxed simulation environment">
                            Sandboxed
                        </div>
                    )}
                    <SimulationReader url={msg.imageUrl} mimeType={msg.mimeType} />
                </div>
            );
        }

        const isVideo = msg.imageUrl.match(/\.(mp4|webm|ogg|mov)$/i) || (msg.mimeType && msg.mimeType.startsWith('video/'));
        const mediaStyle = "rounded-lg w-full max-w-full h-auto max-h-[400px] object-contain mb-2 border border-white/10 shadow-md bg-black/20 cursor-pointer hover:brightness-110 transition-all active:scale-[0.98]";
        return (
            <div onClick={() => onSaveToMatrix?.(msg)} title="Copy to Matrix Staging">
                {isVideo ? (
                    <video
                        src={msg.imageUrl}
                        poster={msg.thumbnailUrl}
                        className={mediaStyle}
                    />
                ) : (
                    <img src={msg.imageUrl} alt="Content" className={mediaStyle} />
                )}
            </div>
        );
    };

    const formattedTime = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : '';

    if (isSystem) {
        return (
            <div className="flex justify-center my-4 group relative">
                <span className="text-xs font-mono text-gray-500 bg-[#18191c] px-4 py-1.5 rounded-full border border-white/5 shadow-inner flex items-center gap-2">
                    {safeContent}
                    {onDelete && <button onClick={handleDelete} className="ml-2 hover:text-red-400 text-gray-600 font-bold"><XIcon className="w-3 h-3" /></button>}
                </span>
            </div>
        );
    }

    const renderLayeredContent = (content: string) => {
        // [ZEN] Prose Cleaning Helper
        const cleanProse = (text: string): string => {
            if (!text) return "";
            let clean = text.trim();
            if (!clean) return "";
            clean = clean.charAt(0).toUpperCase() + clean.slice(1);
            if (clean.split(/\s+/).length > 1 && !/[.!?]$/.test(clean)) {
                clean += ".";
            }
            return clean;
        };

        // [ZEN] UI FIX: Compress spacing between consecutive tags and action blocks
        let cleanContent = content
            .replace(/\]\s+\[/g, '] [') // Force vocal tags side-by-side
            .replace(/\}\s*\n+/g, '}\n') // Remove huge gaps after action blocks
            .replace(/\n+\s*\{/g, '\n{') // Remove huge gaps before action blocks
            .replace(/\]\s*\n+/g, '] '); // [ZEN FIX] Collapse newlines AFTER vocal tags so they sit inline with the text they modify

        // Use non-capturing split to avoid injecting partial inner regex groups into the array
        const parts = cleanContent.split(/(\{.*?\}|\(\([\s\S]*?\)\))/g);
        
        return (
            <div className="message-bubble-text text-[15.5px] leading-relaxed tracking-wide font-light break-words flex flex-col gap-1.5">
                {(() => {
                    const renderedElements: React.ReactNode[] = [];

                    parts.forEach((part, i) => {
                        if (!part || !part.trim()) return;

                        // 2. Narrative Action {Story Layer}
                        if (part.startsWith('{') && part.endsWith('}')) {
                            const action = msg.role === 'user' ? part.slice(1, -1) : cleanProse(part.slice(1, -1));
                            renderedElements.push(
                                <span key={i} className="text-slate-400/80 italic font-serif leading-relaxed block my-0.5 pl-4 border-l-2 border-white/10 bg-white/[0.02] py-1.5 rounded-r-lg">
                                    {action}
                                </span>
                            );
                            return;
                        }

                        // 3. Meta Commentary ((System Layer))
                        if (part.startsWith('((') && part.endsWith('))')) {
                            const meta = msg.role === 'user' ? part.slice(2, -2) : cleanProse(part.slice(2, -2));
                            renderedElements.push(
                                <div key={i} className="text-slate-500 text-[11px] opacity-40 bg-white/[0.02] p-3 rounded-2xl my-1 border border-white/5 font-mono italic">
                                    <span className="text-[9px] font-black uppercase tracking-widest block mb-1 opacity-50">Neural Meta</span>
                                    {meta}
                                </div>
                            );
                            return;
                        }

                        // 4. Standard Markdown Content (Spoken Dialogue Layer)
                        // [ZEN FIX] Ensure dialogue blocks automatically receive quotation marks if unquoted
                        let processedProse = part.trim();
                        if (msg.role !== 'user') {
                            // Automatically wrap lines following tone tags if they lack quotes
                            processedProse = processedProse.replace(/(\[[^\]]+\])\s*(?![{("'“”‘’])([^\n]+)/g, (m, tag, speech) => {
                                const s = speech.trim();
                                if (!/^["'“”‘’]/.test(s)) {
                                    return `${tag} “${s}”`;
                                }
                                return `${tag} ${s}`;
                            });

                            // If the whole line is standalone speech without tone tags or quotes, ensure it is quoted
                            if (!processedProse.startsWith('[') && !/["“”]/.test(processedProse) && processedProse.length > 0) {
                                // Extract bold markers if present to wrap nicely
                                if (processedProse.startsWith('**') && processedProse.endsWith('**')) {
                                    processedProse = `**“${processedProse.slice(2, -2).trim()}”**`;
                                } else {
                                    processedProse = `“${processedProse}”`;
                                }
                            }

                            // [ZEN FIX] Universal Typographic Quote Sanitizer
                            // 1. Convert standard apostrophes inside words to curly
                            processedProse = processedProse.replace(/\b'\b/g, '’');
                            // 2. Convert remaining standalone single quotes wrapping text
                            processedProse = processedProse.replace(/(^|\W)'([^']+)'(\W|$)/g, '$1‘$2’$3');

                            // 3. Process all double quotes (straight or curly) in the text segment
                            // If we find nested double quotes inside an outer pair, convert the inner ones to single curly quotes!
                            const quoteMatches: number[] = [];
                            for (let idx = 0; idx < processedProse.length; idx++) {
                                const ch = processedProse[idx];
                                if (ch === '"' || ch === '“' || ch === '”') {
                                    quoteMatches.push(idx);
                                }
                            }

                            if (quoteMatches.length >= 4) {
                                const chars = processedProse.split('');
                                chars[quoteMatches[0]] = '“';
                                chars[quoteMatches[quoteMatches.length - 1]] = '”';

                                let isInnerOpen = true;
                                for (let k = 1; k < quoteMatches.length - 1; k++) {
                                    chars[quoteMatches[k]] = isInnerOpen ? '‘' : '’';
                                    isInnerOpen = !isInnerOpen;
                                }
                                processedProse = chars.join('');
                            } else if (quoteMatches.length > 0) {
                                const chars = processedProse.split('');
                                let isOpen = true;
                                for (const idx of quoteMatches) {
                                    chars[idx] = isOpen ? '“' : '”';
                                    isOpen = !isOpen;
                                }
                                processedProse = chars.join('');
                            }
                        }

                        renderedElements.push(
                            <div key={i} className="prose prose-invert max-w-none prose-p:my-0 leading-normal">
                                <MarkdownRenderer content={processedProse} onNavigate={onNavigate} role={msg.role} />
                            </div>
                        );
                    });

                    return renderedElements;
                })()}
            </div>
        );
    };

    return (
        <div className={`flex items-end gap-2 mb-6 group/row ${isUser ? 'justify-end' : 'justify-start'}`} ref={menuRef}>
            {!isUser && (
                <button 
                    className="p-2 self-end -mb-1 cursor-pointer transition-transform hover:scale-105 relative" 
                    onClick={handleAvatarClick}
                    title={vibeFrames.length > 1 ? `Click to play [${vibe}] flipbook animation` : ''}
                >
                    <GlassAvatar 
                        imageUrl={vibeFrames.length > 0 ? vibeFrames[frameIndex] : authorAvatar} 
                        altText={authorName} 
                        fallbackChar={authorName[0]} 
                        size="w-6 h-6" 
                        className={`shadow-lg transition-opacity duration-150 ${isAnimating ? 'opacity-90' : 'opacity-100'}`} 
                    />
                    {vibeFrames.length > 1 && !isAnimating && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-fuchsia-500 rounded-full border border-black shadow-[0_0_5px_rgba(217,70,239,0.8)]" />
                    )}
                </button>
            )}

            <div className={`relative max-w-[85%] md:max-w-md lg:max-w-lg flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <span className={`text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ${isUser ? 'mr-3' : 'ml-3'}`}>
                    {authorName}
                </span>
                <div
                    className={`px-5 py-3 cinematic-bubble relative group/bubble transition-all duration-300 ${isUser ? 'cinematic-bubble-user rounded-[2rem] rounded-tr-md shadow-[0_10px_30px_rgba(124,58,237,0.15)]' : 'cinematic-bubble-ai rounded-[2rem] rounded-tl-md shadow-[0_10px_30px_rgba(0,0,0,0.3)]'} ${msg.isDeleted ? 'opacity-40 grayscale italic border-dashed border-white/10' : ''}`}
                    onDoubleClick={() => !isEditing && !msg.isDeleted && setShowMeta(!showMeta)}
                >
                    {!isEditing && !msg.isDeleted && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const currentStatus = (msg as any).fiction ?? (msg as any).is_fiction ?? undefined;
                                const newStatus = currentStatus === true ? false : true; 

                                if (onSetFiction) {
                                    onSetFiction(msg, newStatus);
                                } else {
                                    import('../../services/typesenseService').then(({ typesenseService }) => {
                                        if (msg.id) typesenseService.setFictionStatus(msg.id, newStatus);
                                    });
                                }
                            }}
                            title={(msg as any).fiction ? "Status: Creative (Roleplay) - Click to Ground" : ((msg as any).fiction === false ? "Status: Grounded (Fact) - Click to Create" : "Status: Undefined")}
                            className={`absolute top-3 right-3 w-2 h-2 rounded-full border border-white/20 z-20 focus:outline-none transition-all duration-500
                                ${(msg as any).fiction === true ? 'bg-fuchsia-500 shadow-[0_0_10px_#BC13FE]' : ''}
                                ${(msg as any).fiction === false ? 'bg-emerald-500 shadow-[0_0_10px_#00FF41]' : ''}
                                ${(msg as any).fiction === undefined ? 'bg-slate-700 opacity-20 hover:opacity-100' : ''}
                                ${isUser ? 'right-auto left-3' : ''}
                            `}
                        />
                    )}

                    {renderMedia()}
                    {
                        msg.isDeleted ? (
                            <div className="flex items-center gap-2 text-[11px] font-mono tracking-tighter opacity-80 py-2">
                                <TrashIcon className="w-4 h-4" />
                                <span>Signal Scrubbed by {authorName} {msg.deletedAt ? `at ${new Date(msg.deletedAt).toLocaleTimeString()}` : ''}</span>
                            </div>
                        ) : isEditing ? (
                            <div className="min-w-[300px]">
                                <MarkdownEditor
                                    value={editContent}
                                    onChange={setEditContent}
                                    onSave={handleSaveEdit}
                                    onCancel={() => setIsEditing(false)}
                                    saveLabel="Update"
                                    autoFocus
                                    mode="modal"
                                    initialFictionStatus={(msg as any).fiction ?? (msg as any).is_fiction}
                                    onFictionStatusChange={(newStatus) => {
                                        if (onSetFiction) {
                                            onSetFiction(msg, newStatus);
                                        } else {
                                            import('../../services/typesenseService').then(({ typesenseService }) => {
                                                if (msg.id) typesenseService.setFictionStatus(msg.id, newStatus);
                                            });
                                        }
                                    }}
                                    userPresets={userPresets}
                                    userId={user.id}
                                    authorRole={isUser ? 'user' : 'model'}
                                    anteContext={anteContext}
                                    subContext={subContext}
                                />
                            </div>
                        ) : (
                            <>
                                {renderSourceIndicator()}
                                {renderLayeredContent(displayContent)}
                            </>
                        )
                    }

                    {
                        !isEditing && !msg.isDeleted && msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 -mb-1">
                                {msg.reactions.map((r, i) => (
                                    <span key={i} className="text-xs bg-black/20 hover:bg-black/40 cursor-pointer transition-colors px-2 py-0.5 rounded-full border border-white/5 shadow-sm" title={r.reactorName}>{r.emoji}</span>
                                ))}
                            </div>
                        )
                    }

                    {
                        showMeta && !isEditing && !msg.isDeleted && (
                            <div className="mt-2 pt-1 border-t border-white/10 text-[10px] opacity-60 font-mono text-right w-full select-none">
                                {formattedTime}
                            </div>
                        )
                    }

                    {/* [ZEN V14] BULK SELECT OVERLAY */}
                    {
                        isBulkMode && (
                            <div
                                onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(); }}
                                className={`absolute inset-0 z-50 cursor-pointer rounded-2xl transition-all border-2 flex items-center justify-center ${isSelected ? 'bg-indigo-500/20 border-indigo-500' : 'bg-transparent border-white/5 hover:bg-white/5 hover:border-white/20'}`}
                            >
                                {isSelected ? (
                                    <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12" /></svg>
                                    </div>
                                ) : (
                                    <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center group-hover/bubble:border-white/40 transition-colors">
                                        {/* Empty circle target */}
                                    </div>
                                )}
                            </div>
                        )
                    }
                </div >

                {!isEditing && (
                    <div className={`
                    relative mt-1 flex flex-wrap items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-200 z-50 max-w-full
                    ${isUser ? 'justify-end pr-1' : 'justify-start pl-1'}
                `}>
                        {!isUser && onSaveToContext && (
                            <button onClick={() => onSaveToContext(safeContent)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-green-400 hover:bg-[#2f3136] rounded-full transition-colors"><Save size={14} /></button>
                        )}

                        {/* [ZEN] Manual Spark: Granular Vocalization */}
                        {onSpeak && (
                            <button 
                                onClick={() => onSpeak(safeContent, companionData?.voiceId, undefined, companionData?.id, isUser)} 
                                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-emerald-400 hover:bg-[#2f3136] rounded-full transition-all active:scale-90"
                                title={`Neural Spark: Vocalize this message as ${isUser ? 'Operator' : 'Companion'}`}
                            >
                                <Volume2 size={14} />
                            </button>
                        )}

                        {onDownloadAudio && (
                            <button 
                                onClick={(e) => {
                                    console.log("[MessageBubble] 📥 Download button clicked.");
                                    e.stopPropagation();
                                    onDownloadAudio(safeContent, companionData?.voiceId, undefined, companionData?.id, isUser);
                                }} 
                                className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:bg-[#2f3136] rounded-full transition-all active:scale-90"
                                title="Audio Archive: Download vocal segment"
                            >
                                <Download size={14} />
                            </button>
                        )}

                        <div className="relative">
                            <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-yellow-400 hover:bg-[#2f3136] rounded-full transition-colors">
                                <EmojiIcon className="w-4 h-4" weight="bold" />
                            </button>

                            {showReactionPicker && (
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#18191c] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-in zoom-in-95 grid grid-cols-4 gap-1 min-w-[120px]">
                                    {reactionsList.map((emoji: string, index: number) => (
                                        <button key={`${emoji}-${index}`} onClick={(e) => handleReactionClick(emoji, e)} className="hover:bg-[#2f3136] rounded p-1 text-lg transition-colors">{emoji}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!isUser && onFeedback && (
                            <>
                                <button onClick={() => onFeedback(true)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-green-400 hover:bg-[#2f3136] rounded-full transition-colors"><ThumbsUpIcon className="w-4 h-4" weight="bold" /></button>
                                <button onClick={() => onFeedback(false)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-[#2f3136] rounded-full transition-colors"><ThumbsDownIcon className="w-4 h-4" weight="bold" /></button>
                            </>
                        )}
                        <div className="relative">
                            <button onClick={() => setShowMenu(!showMenu)} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white hover:bg-[#2f3136] rounded-full transition-colors">
                                <EllipsisVerticalIcon className="w-4 h-4" weight="bold" />
                            </button>
                            {showMenu && (
                                <div className={`absolute bottom-full mb-1 w-32 bg-[#18191c] border border-white/10 rounded-lg shadow-2xl z-50 py-1 text-xs text-gray-300 ${isUser ? 'right-0' : 'left-0'}`}>
                                    <button onClick={handleCopy} className="w-full text-left px-3 py-2 hover:bg-[#5865F2] hover:text-white flex items-center gap-2 transition-colors">
                                        <ClipboardIcon className="w-3 h-3" /> Copy Text
                                    </button>
                                    {onSpeak && (
                                        <>
                                            <button onClick={() => { onSpeak(safeContent, companionData?.voiceId, undefined, companionData?.id, isUser); setShowMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-emerald-500/20 hover:text-emerald-400 flex items-center gap-2 transition-colors border-t border-white/5">
                                                <Volume2 size={12} /> Neural Speak (Auto)
                                            </button>
                                            <button onClick={() => { onSpeak(safeContent, companionData?.voiceId, "eleven_v3", companionData?.id, isUser); setShowMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-cyan-500/20 hover:text-cyan-400 flex items-center gap-2 transition-colors">
                                                <Sparkles size={12} className="text-cyan-400" /> High-Fidelity Performance
                                            </button>
                                            <button onClick={() => { onSpeak(safeContent, companionData?.voiceId, "eleven_turbo_v2_5", companionData?.id, isUser); setShowMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-orange-500/20 hover:text-orange-400 flex items-center gap-2 transition-colors">
                                                <Zap size={12} className="text-orange-400" /> Turbo Performance
                                            </button>
                                        </>
                                    )}
                                    {onDownloadAudio && (
                                        <button onClick={() => { onDownloadAudio(safeContent, companionData?.voiceId, undefined, companionData?.id, isUser); setShowMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-violet-500/20 hover:text-violet-400 flex items-center gap-2 transition-colors border-t border-white/5">
                                            <Download size={12} /> Audio Archive
                                        </button>
                                    )}
                                    {!isUser && onCognitiveOverride && (
                                        <button onClick={() => { onCognitiveOverride(); setShowMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-orange-500/20 hover:text-orange-400 flex items-center gap-2 transition-colors border-t border-white/5">
                                            <Zap size={12} className="text-orange-400" /> Freeze & Override (Prune)
                                        </button>
                                    )}
                                    {!isUser && onManualDriftFlag && (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); setShowDriftMenu(!showDriftMenu); }} className="w-full text-left px-3 py-2 hover:bg-red-500/20 hover:text-red-400 flex items-center gap-2 transition-colors border-t border-white/5 text-red-500 font-bold">
                                                🚨 Flag Drift
                                            </button>
                                            {showDriftMenu && (
                                                <div className="pl-6 py-1 bg-red-950/20 border-b border-red-500/10 flex flex-col items-start gap-1">
                                                    {['Nanny Refusal', 'Psychological Hijacking', 'Therapy-Speak', 'Hallucination'].map(reason => (
                                                        <button key={reason} onClick={() => { onManualDriftFlag(reason); setShowMenu(false); setShowDriftMenu(false); }} className="w-full text-left px-3 py-1.5 hover:bg-red-500/30 hover:text-red-300 text-[10px] uppercase tracking-wider transition-colors text-red-400">
                                                            {reason}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {onEdit && (
                                        <button onClick={handleEditClick} className="w-full text-left px-3 py-2 hover:bg-violet-500/20 hover:text-violet-400 flex items-center gap-2 transition-colors border-t border-white/5">
                                            <Pencil className="w-3 h-3" /> Edit
                                        </button>
                                    )}
                                    {onPromoteToCore && (
                                        <button onClick={() => { onPromoteToCore(msg); setShowMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-amber-500/20 hover:text-amber-400 flex items-center gap-2 transition-colors border-t border-white/5">
                                            {/* Using a simple star/brain icon */}
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                                            Promote to Core
                                        </button>
                                    )}
                                    {onDelete && (
                                        <button
                                            onClick={handleDelete}
                                            disabled={isPeerSegment && otherLastReadTimestamp !== undefined && (msg as any).timestamp < otherLastReadTimestamp}
                                            className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-t border-white/5 ${isPeerSegment && otherLastReadTimestamp !== undefined && (msg as any).timestamp < otherLastReadTimestamp
                                                ? 'opacity-20 cursor-not-allowed text-gray-400'
                                                : 'hover:bg-red-500/20 hover:text-red-400 text-red-500'
                                                }`}
                                            title={isPeerSegment && otherLastReadTimestamp !== undefined && (msg as any).timestamp < otherLastReadTimestamp ? "Cannot delete read signals" : "Delete"}
                                        >
                                            <TrashIcon className="w-3 h-3" /> {isPeerSegment && otherLastReadTimestamp !== undefined && (msg as any).timestamp < otherLastReadTimestamp ? 'Read (Locked)' : 'Delete'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div >
            {
                isUser && (
                    <button className="p-2 self-end -mb-1 cursor-pointer transition-transform hover:scale-105" onClick={() => onNavigate('profile')}>
                        <GlassAvatar imageUrl={user.profilePictureUrl} altText="User" fallbackChar="U" size="w-6 h-6" className="shadow-lg" />
                    </button>
                )
            }
        </div >
    );
};

export default MessageBubble;