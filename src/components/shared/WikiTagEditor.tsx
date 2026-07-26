import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { useOptionalWikiNavigation } from './WikiNavigationProvider';
import { appDataService } from '../../services/serviceManager';
import type { Tag } from '../../types';

interface WikiTagEditorProps {
    value: string;
    onChange: (text: string) => void;
    userId: string;
    onTagCreated?: (tag: Tag) => void;
    placeholder?: string;
    className?: string;
    textSizeClass?: string;
    rows?: number;
    setIsDirty?: (dirty: boolean) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
    onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
    customSuggestions?: any[];
}

const getTagStyles = (type: string) => {
    switch (type) {
        case 'person': return 'text-violet-400 border-b border-violet-500/30 hover:border-violet-400 transition-colors font-semibold cursor-pointer';
        case 'pet': return 'text-pink-400 border-b border-pink-500/30 hover:border-pink-400 transition-colors font-semibold cursor-pointer';
        case 'place': return 'text-emerald-400 border-b border-emerald-500/30 hover:border-emerald-400 transition-colors font-semibold cursor-pointer';
        case 'thing': return 'text-amber-400 border-b border-amber-500/30 hover:border-amber-400 transition-colors font-semibold cursor-pointer';
        case 'event': return 'text-sky-400 border-b border-sky-500/30 hover:border-sky-400 transition-colors font-semibold cursor-pointer';
        case 'concept': return 'text-indigo-400 border-b border-indigo-500/30 hover:border-indigo-400 transition-colors font-semibold cursor-pointer';
        case 'asset': return 'text-cyan-400 border-b border-cyan-500/30 hover:border-cyan-400 transition-colors font-semibold cursor-pointer';
        default: return 'text-slate-400 border-b border-slate-500/30 hover:border-slate-400 transition-colors font-semibold cursor-pointer';
    }
};

const getTagEmoji = (type: string) => {
    switch (type) {
        case 'person': return '👤 ';
        case 'pet': return '🐾 ';
        case 'place': return '📍 ';
        case 'thing': return '📦 ';
        case 'event': return '📅 ';
        case 'concept': return '🧠 ';
        case 'asset': return '🖼️ ';
        default: return '🏷️ ';
    }
};

const getTagIcon = (type: string) => {
    switch (type) {
        case 'person': return <span className="inline mr-1 shrink-0">{getTagEmoji('person')}</span>;
        case 'pet': return <span className="inline mr-1 shrink-0">{getTagEmoji('pet')}</span>;
        case 'place': return <span className="inline mr-1 shrink-0">{getTagEmoji('place')}</span>;
        case 'thing': return <span className="inline mr-1 shrink-0">{getTagEmoji('thing')}</span>;
        case 'event': return <span className="inline mr-1 shrink-0">{getTagEmoji('event')}</span>;
        case 'concept': return <span className="inline mr-1 shrink-0">{getTagEmoji('concept')}</span>;
        case 'asset': return <span className="inline mr-1 shrink-0">{getTagEmoji('asset')}</span>;
        default: return <span className="inline mr-1 shrink-0">{getTagEmoji('default')}</span>;
    }
};

// Conversions from raw markdown [Name](tag://type:id) to rich DOM nodes
const markdownToHtml = (md: string): string => {
    if (!md) return '';
    let html = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Markdown tags regex match
    const regex = /\[([^\[\]]+)\]\(tag:\/\/([a-zA-Z0-9_:-]+)\)/g;
    return html.replace(regex, (match, displayName, tagRef) => {
        let type = 'unknown';
        if (tagRef.includes(':')) {
            type = tagRef.substring(0, tagRef.indexOf(':'));
        }
        const styleClass = getTagStyles(type);
        const emoji = getTagEmoji(type);
        return `<span class="tag-capsule inline px-1 rounded transition-all ${styleClass}" contenteditable="false" data-tag-ref="${tagRef}" data-display-name="${displayName}">${emoji}${displayName}</span>`;
    });
};

// Conversions from DOM nodes back to raw markdown syntax
const htmlToMarkdown = (element: HTMLElement): string => {
    let md = '';
    element.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            md += node.textContent || '';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.classList.contains('tag-capsule')) {
                const displayName = el.getAttribute('data-display-name') || el.innerText;
                const tagRef = el.getAttribute('data-tag-ref');
                md += `[${displayName}](tag://${tagRef})`;
            } else if (el.tagName === 'BR') {
                md += '\n';
            } else if (el.tagName === 'DIV' || el.tagName === 'P') {
                md += '\n' + htmlToMarkdown(el);
            } else {
                md += htmlToMarkdown(el);
            }
        }
    });
    return md;
};

// Multi-browser caret calculator
const getCaretCharacterOffsetWithin = (element: HTMLElement): number => {
    let caretOffset = 0;
    const doc = element.ownerDocument || document;
    const win = doc.defaultView || window;
    const sel = win.getSelection();
    if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        caretOffset = preCaretRange.toString().length;
    }
    return caretOffset;
};

export const WikiTagEditor: React.FC<WikiTagEditorProps> = ({
    value,
    onChange,
    userId,
    onTagCreated,
    placeholder = 'Start writing... Use @ or T: to tag people, pets, places...',
    className = '',
    textSizeClass = 'text-xs',
    rows = 6,
    setIsDirty,
    onKeyDown,
    onPaste,
    customSuggestions = []
}) => {
    const wikiContext = useOptionalWikiNavigation();
    const [localTagsCache, setLocalTagsCache] = useState<Tag[]>([]);

    useEffect(() => {
        if (!wikiContext && userId) {
            appDataService.getAllTags(userId).then(tags => {
                setLocalTagsCache(tags);
            }).catch(e => console.error("[WikiTagEditor] Failed to fetch tags cache fallback:", e));
        }
    }, [wikiContext, userId]);

    const tagsCache = wikiContext ? wikiContext.tagsCache : localTagsCache;

    const refreshTagsCache = useCallback(async () => {
        if (wikiContext) {
            await wikiContext.refreshTagsCache();
        } else if (userId) {
            try {
                const tags = await appDataService.getAllTags(userId);
                setLocalTagsCache(tags);
            } catch (e) {
                console.error("[WikiTagEditor] Failed to refresh local tags cache fallback:", e);
            }
        }
    }, [wikiContext, userId]);

    const textareaRef = useRef<HTMLDivElement>(null);

    // Native capture click listener for inline tag capsules
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;

        const handleNativeClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const capsule = target.closest('.tag-capsule');
            if (capsule) {
                const tagRef = capsule.getAttribute('data-tag-ref');
                console.log("[WikiTagEditor] Native click captured on capsule. tagRef:", tagRef, "wikiContext:", !!wikiContext);
                if (tagRef && wikiContext) {
                    e.preventDefault();
                    e.stopPropagation();
                    let tagId = tagRef;
                    if (tagRef.includes(':')) {
                        tagId = tagRef.substring(tagRef.indexOf(':') + 1);
                    }
                    console.log("[WikiTagEditor] Opening tagId via wikiContext:", tagId);
                    wikiContext.openTag(tagId);
                }
            }
        };

        el.addEventListener('click', handleNativeClick, true);
        return () => {
            el.removeEventListener('click', handleNativeClick, true);
        };
    }, [wikiContext]);

    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestQuery, setSuggestQuery] = useState('');
    const [precedingContext, setPrecedingContext] = useState('');
    const [suggestIndex, setSuggestIndex] = useState(0);
    const [triggerIndex, setTriggerIndex] = useState<number | null>(null);
    const [triggerType, setTriggerType] = useState<'@' | 'T:'>('@');
    const [popoverPos, setPopoverPos] = useState<{ top?: number | string, bottom?: number | string, left: number }>({ top: 0, left: 0 });
    const [localIsDirty, setLocalIsDirty] = useState(false);

    // Sync input updates cleanly
    useEffect(() => {
        if (textareaRef.current) {
            const currentMd = htmlToMarkdown(textareaRef.current);
            if (currentMd !== value) {
                textareaRef.current.innerHTML = markdownToHtml(value);
            }
        }
    }, [value]);

    // DRAFT ANTI-LOSS
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (localIsDirty) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [localIsDirty]);

    const markDirty = (dirty: boolean) => {
        setLocalIsDirty(dirty);
        if (setIsDirty) setIsDirty(dirty);
    };

    // Lightweight Local Semantic Category Predictor
    const predictLikelyCategory = (query: string, contextText: string): Tag['type'] | null => {
        const text = contextText.toLowerCase();
        const q = query.toLowerCase();

        // 1. Check surrounding text context keywords
        if (/\b(song|tune|music|band|album|track|sing|listen|sound|beatles|lyrics|artist|played|playing)\b/.test(text)) {
            return 'concept';
        }
        if (/\b(at|in|on|street|road|city|state|lake|park|restaurant|cafe|hotel|house|home|place|airport|location)\b/.test(text)) {
            return 'place';
        }
        if (/\b(friend|sister|brother|mom|dad|mother|father|uncle|aunt|cousin|boss|colleague|he|she|him|her|met|with|said|talked|told)\b/.test(text)) {
            return 'person';
        }
        if (/\b(cat|dog|pet|puppy|kitten|bird|fish|hamster|bunny|rabbit|veterinarian|vet|meow|bark)\b/.test(text)) {
            return 'pet';
        }
        if (/\b(birthday|wedding|party|trip|concert|meeting|festival|holiday|graduation|anniversary|event|show)\b/.test(text)) {
            return 'event';
        }
        if (/\b(car|jeep|phone|book|camera|watch|ring|necklace|gift|box|guitar|piano|violin|instrument|bag|keys)\b/.test(text)) {
            return 'thing';
        }

        // 2. Fallback to query-specific signals
        if (/\b(the|a|an)\b/.test(q)) return 'concept';

        return null;
    };

    // Clean suggestion queries
    const getFilteredSuggestions = () => {
        let originalQuery = suggestQuery.trim();
        let query = suggestQuery.toLowerCase().trim();
        let forceType: Tag['type'] | null = null;

        // Parse power-user prefix
        if (query.startsWith('[p]')) { forceType = 'person'; query = query.substring(3).trim(); originalQuery = originalQuery.substring(3).trim(); }
        else if (query.startsWith('[pt]')) { forceType = 'pet'; query = query.substring(4).trim(); originalQuery = originalQuery.substring(4).trim(); }
        else if (query.startsWith('[pl]')) { forceType = 'place'; query = query.substring(4).trim(); originalQuery = originalQuery.substring(4).trim(); }
        else if (query.startsWith('[t]')) { forceType = 'thing'; query = query.substring(3).trim(); originalQuery = originalQuery.substring(3).trim(); }
        else if (query.startsWith('[e]')) { forceType = 'event'; query = query.substring(3).trim(); originalQuery = originalQuery.substring(3).trim(); }
        else if (query.startsWith('[c]')) { forceType = 'concept'; query = query.substring(3).trim(); originalQuery = originalQuery.substring(3).trim(); }

        // Prioritize custom suggestions (like images) at the top of the list
        const combinedPool = [...customSuggestions, ...tagsCache];

        const matches = combinedPool.filter(t => 
            t.type !== 'context' && 
            (!forceType || t.type === forceType) && // Filter matches by forced type if specified
            (t.name.toLowerCase().includes(query) || 
             (t.type === 'person' && (t as any).metadata?.displayName?.toLowerCase().includes(query)))
        );

        // Dynamic inline creation options
        let creationOptions: any[] = [];
        if (query.length >= 2 || (forceType && query.length >= 1)) {
            const safeQuery = originalQuery || 'New Entity';
            const rawOptions: any[] = [];

            const personName = safeQuery.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            rawOptions.push({ id: 'create-person', name: `Create Person "${personName}"`, rawName: personName, type: 'person', isCreation: true });

            const petName = safeQuery.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            rawOptions.push({ id: 'create-pet', name: `Create Pet "${petName}"`, rawName: petName, type: 'pet', isCreation: true });

            rawOptions.push({ id: 'create-place', name: `Create Place "${safeQuery}"`, rawName: safeQuery, type: 'place', isCreation: true });
            rawOptions.push({ id: 'create-thing', name: `Create Thing "${safeQuery}"`, rawName: safeQuery, type: 'thing', isCreation: true });
            rawOptions.push({ id: 'create-event', name: `Create Event "${safeQuery}"`, rawName: safeQuery, type: 'event', isCreation: true });
            rawOptions.push({ id: 'create-concept', name: `Create Concept "${safeQuery}"`, rawName: safeQuery, type: 'concept', isCreation: true });

            let filteredOptions = rawOptions.filter(opt => !forceType || opt.type === forceType);

            // Predict best category based on preceding text
            const predictedType = predictLikelyCategory(query, precedingContext);
            if (predictedType && !forceType) {
                const bestIdx = filteredOptions.findIndex(opt => opt.type === predictedType);
                if (bestIdx !== -1) {
                    const [bestOpt] = filteredOptions.splice(bestIdx, 1);
                    bestOpt.isRecommended = true;
                    // Prepend to show recommended option at the absolute top of inline creations
                    filteredOptions.unshift(bestOpt);
                }
            }

            creationOptions = filteredOptions;
        }

        return [...matches, ...creationOptions];
    };

    const suggestions = getFilteredSuggestions();

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        if (!textareaRef.current) return;
        const currentMd = htmlToMarkdown(textareaRef.current);
        onChange(currentMd);
        markDirty(true);

        const val = textareaRef.current.innerText;
        const caret = getCaretCharacterOffsetWithin(textareaRef.current);
        
        // Match tag trigger
        const atIndex = val.lastIndexOf('@', caret - 1);
        const tIndex = val.lastIndexOf('T:', caret - 1);
        
        let activeIdx = -1;
        let type: '@' | 'T:' = '@';
        
        if (atIndex !== -1 && (tIndex === -1 || atIndex > tIndex)) {
            activeIdx = atIndex;
            type = '@';
        } else if (tIndex !== -1 && (atIndex === -1 || tIndex > atIndex)) {
            activeIdx = tIndex;
            type = 'T:';
        }

        if (activeIdx !== -1) {
            const queryLength = type === '@' ? 1 : 2;
            const query = val.substring(activeIdx + queryLength, caret);
            // Allow spaces and commas for full names/places (e.g. "Orion Douglas Layman", "Frederick, MD")
            if (!query.startsWith(' ') && !query.includes('\n') && query.length < 50) {
                setIsSuggesting(true);
                setSuggestQuery(query);
                setPrecedingContext(val.substring(Math.max(0, activeIdx - 150), activeIdx));
                setTriggerIndex(activeIdx);
                setTriggerType(type);
                setSuggestIndex(0);

                // Accurate caret position for dropdown
                const rect = textareaRef.current.getBoundingClientRect();
                
                let caretRect: DOMRect | null = null;
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0).cloneRange();
                    range.collapse(false);
                    const rects = range.getClientRects();
                    if (rects.length > 0) {
                        caretRect = rects[0] as DOMRect;
                    } else {
                        caretRect = range.getBoundingClientRect();
                    }
                }

                // Fallback if caret measurement fails
                if (!caretRect || (caretRect.x === 0 && caretRect.y === 0 && caretRect.width === 0)) {
                    caretRect = {
                        top: rect.bottom - 20,
                        bottom: rect.bottom,
                        left: rect.left + Math.min(activeIdx * 8, 200),
                        right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => {}
                    } as DOMRect;
                }

                const spaceBelow = window.innerHeight - caretRect.bottom;
                const openUpwards = spaceBelow < 250;

                setPopoverPos({
                    top: openUpwards ? undefined : caretRect.bottom + 4,
                    bottom: openUpwards ? window.innerHeight - caretRect.top + 4 : undefined,
                    left: Math.max(10, Math.min(caretRect.left, window.innerWidth - 270))
                });
                return;
            }
        }

        setIsSuggesting(false);
        setTriggerIndex(null);
    };

    const selectSuggestion = async (item: any) => {
        if (!textareaRef.current || triggerIndex === null) return;
        
        let tagId = item.id;
        let displayName = (item.type === 'person' && item.metadata?.displayName) ? item.metadata.displayName : item.name;
        let tagType = item.type;

        // If creation option selected, perform inline Firestore creation
        if (item.isCreation) {
            let rawName = item.rawName || suggestQuery.trim();
            if (tagType === 'person' || tagType === 'pet') {
                rawName = rawName.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            }
            const newTag = {
                id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: rawName,
                type: tagType,
                description: `Inline created ${tagType}`,
                privateNotes: '',
                isPrivate: false,
                tagIds: [],
                mediaIds: [],
                mediaGallery: [],
                metadata: {}
            } as Tag;

            try {
                await appDataService.saveTag(userId, newTag);
                tagId = newTag.id;
                displayName = newTag.name;
                if (onTagCreated) onTagCreated(newTag);
                await refreshTagsCache(); // Sync cache
            } catch (e) {
                console.error("[WikiTagEditor] Failed inline tag creation:", e);
                return;
            }
        }

        // Replace trigger text with Markdown tag link safely to preserve existing tags
        const triggerStr = triggerType === '@' ? '@' : 'T:';
        const fullTrigger = triggerStr + suggestQuery;
        
        const val = textareaRef.current.innerText;
        const beforeText = val.substring(0, triggerIndex);
        
        const occurrencesBefore = beforeText.split(fullTrigger).length - 1;
        const currentMd = htmlToMarkdown(textareaRef.current);
        
        let mdIndex = -1;
        for (let i = 0; i <= occurrencesBefore; i++) {
            mdIndex = currentMd.indexOf(fullTrigger, mdIndex + 1);
        }
        
        let replacementMd = currentMd;
        if (mdIndex !== -1) {
            replacementMd = currentMd.substring(0, mdIndex) + `[${displayName}](tag://${tagType}:${tagId})` + currentMd.substring(mdIndex + fullTrigger.length);
        } else {
            // Fallback if not found (shouldn't happen)
            const afterText = val.substring(val.indexOf(fullTrigger, triggerIndex) + fullTrigger.length);
            replacementMd = `${beforeText}[${displayName}](tag://${tagType}:${tagId})${afterText}`;
        }
        
        textareaRef.current.innerHTML = markdownToHtml(replacementMd);
        setIsSuggesting(false);
        setTriggerIndex(null);
        
        // Notify parent state
        onChange(replacementMd);
        markDirty(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isSuggesting && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSuggestIndex(prev => (prev + 1) % suggestions.length);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSuggestIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                return;
            } else if (e.key === 'Enter') {
                e.preventDefault();
                selectSuggestion(suggestions[suggestIndex]);
                return;
            } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsSuggesting(false);
                setTriggerIndex(null);
                return;
            }
        }

        if (onKeyDown) onKeyDown(e);

        if (e.isDefaultPrevented()) return;

        if (e.key === 'Enter') {
            e.preventDefault();
            
            // Insert line break at cursor
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const br = document.createElement('br');
                range.deleteContents();
                range.insertNode(br);
                
                range.setStartAfter(br);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                
                if (textareaRef.current) {
                    onChange(htmlToMarkdown(textareaRef.current));
                }
            }
        }
    };

    const handleBlur = () => {
        // Delay to allow click events on the popover buttons to fire before unmounting
        setTimeout(() => {
            setIsSuggesting(false);
            setTriggerIndex(null);
        }, 200);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        // Prevent the default browser rich-text / image paste
        e.preventDefault();
        
        let textToInsert = e.clipboardData.getData('text/plain');
        const htmlData = e.clipboardData.getData('text/html');

        if (htmlData) {
            // Convert pasted HTML (which might contain our tag-capsules) back into Markdown
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlData;
            const extractedMd = htmlToMarkdown(tempDiv);
            if (extractedMd) {
                textToInsert = extractedMd;
            }
        }

        // Convert the markdown we just extracted (or raw pasted markdown) back into HTML capsules for insertion
        const htmlToInsert = markdownToHtml(textToInsert);

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlToInsert;
            
            // Insert all nodes from tempDiv
            const frag = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                frag.appendChild(tempDiv.firstChild);
            }
            
            const lastChild = frag.lastChild;
            range.insertNode(frag);
            
            if (lastChild) {
                range.setStartAfter(lastChild);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            
            // Manually trigger our state sync since we prevented default
            if (textareaRef.current) {
                onChange(htmlToMarkdown(textareaRef.current));
                markDirty(true);
            }
        }

        // Pass along to any external handlers
        if (onPaste) onPaste(e);
    };

    const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        
        const range = sel.getRangeAt(0);
        const fragment = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);
        
        const mdText = htmlToMarkdown(tempDiv);
        e.clipboardData.setData('text/plain', mdText);
        e.preventDefault();
    };

    return (
        <div className={`relative w-full flex flex-col h-full ${className}`} onClick={() => textareaRef.current?.focus()}>
            <div className="relative w-full flex-1 flex flex-col border border-white/10 rounded-xl bg-black/40 shadow-inner overflow-hidden focus-within:border-violet-500/50 focus-within:shadow-[0_0_15px_rgba(139,92,246,0.1)] transition-all">
                <div
                    ref={textareaRef}
                    contentEditable
                    onInput={handleInput}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onCopy={handleCopy}
                    onCut={handleCopy}
                    onBlur={handleBlur}
                    className={`w-full h-full flex-1 bg-transparent p-4 ${textSizeClass} text-slate-200 outline-none resize-none leading-relaxed font-sans min-h-[100px] overflow-y-auto whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-slate-600 before:pointer-events-none transition-all duration-300 cursor-text`}
                    data-placeholder={placeholder}
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: 'text' }}
                />
            </div>

            {/* Dynamic Auto-Suggest Popover */}
            {isSuggesting && suggestions.length > 0 && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed z-[9999] w-64 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-200"
                    style={{ 
                        top: popoverPos.top !== undefined ? popoverPos.top : 'auto', 
                        bottom: popoverPos.bottom !== undefined ? popoverPos.bottom : 'auto',
                        left: popoverPos.left 
                    }}
                >
                    <div className="px-3 py-1.5 bg-black/40 border-b border-white/5 flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Wiki Suggestions</span>
                        <span className="text-[7px] font-mono text-cyan-400">⌨ ENTER SELECT</span>
                    </div>
                    
                    <div className="max-h-72 overflow-y-auto custom-scrollbar py-1">
                        {suggestions.map((item: any, idx) => {
                            const isCreation = item.isCreation;
                            const isSelected = idx === suggestIndex;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => selectSuggestion(item)}
                                    className={`w-full px-3 py-2 text-left text-xs transition-all flex items-center justify-between ${
                                        isSelected 
                                        ? 'bg-violet-600/30 text-white font-bold border-l-2 border-violet-500' 
                                        : item.isRecommended
                                            ? 'bg-indigo-500/5 text-indigo-200 border-l border-indigo-500/20 hover:bg-indigo-500/10'
                                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <span className="flex items-center gap-1.5 truncate">
                                        {isCreation ? <Plus size={12} className="text-cyan-400 shrink-0" /> : getTagIcon(item.type)}
                                        <span className="truncate">{item.name}</span>
                                    </span>
                                    
                                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                                        isCreation 
                                        ? item.isRecommended
                                            ? 'text-indigo-400 bg-indigo-950/40 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                                            : 'text-cyan-400 bg-cyan-950/40 border-cyan-500/20' 
                                        : 'text-slate-500 bg-black/20 border-white/5'
                                    }`}>
                                        {isCreation 
                                            ? item.isRecommended
                                                ? '✨ RECOMMENDED'
                                                : `New ${item.type}` 
                                            : item.type
                                        }
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default WikiTagEditor;
