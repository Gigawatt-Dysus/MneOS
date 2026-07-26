// [HARDENING_V2] Optimized for High-Performance Staging Edits
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Calendar, FileText, Save, Trash2, Wand2, Tag as TagIcon, User as UserIcon, MapPin, ChevronDown, Sparkles, Check } from 'lucide-react';
import { StagedAsset } from './types';
import { Tag, User } from '../../types';
import { sparkleAssetDescription, reconcileVertexPersona, callXAI } from '../../services/aiOrchestrator';
import { formatLifeOSDate, formatDateForInput } from '../../utils/dateSanitizer';
import { TEMPORAL_SHOEBOX_DATE } from '../../types/constants';
import { Archive } from 'lucide-react';

interface Props {
    asset: StagedAsset;
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<StagedAsset>) => void;
    onRemove: (id: string) => void;
    tags: Tag[];
    user: User;
}

// --- SUB-COMPONENTS ---
const NarrativeEditor = React.memo(({ 
    initialTitle, onTitleChange, isSparkling, handleSparkle 
}: any) => {
    const [localTitle, setLocalTitle] = useState(initialTitle);
    const [museDirective, setMuseDirective] = useState('');

    const handleChange = (val: string) => {
        setLocalTitle(val);
        onTitleChange(val);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Asset Identity / Description</label>
                <button 
                    onClick={() => handleSparkle(museDirective)}
                    disabled={isSparkling || !localTitle}
                    className="flex items-center gap-1.5 px-2 py-1 bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-widest rounded border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all disabled:opacity-50"
                >
                    <Wand2 className={`w-3 h-3 ${isSparkling ? 'animate-pulse text-yellow-400' : ''}`} />
                    {isSparkling ? 'MUSING...' : 'NEURAL MUSE'}
                </button>
            </div>
            
            {/* Neural Muse Optional Directive Input */}
            <input
                type="text"
                value={museDirective}
                onChange={(e) => setMuseDirective(e.target.value)}
                placeholder="Guide the Muse (optional, e.g. 'Grounded short description')..."
                className="w-full bg-[#0a0c10]/40 border border-white/5 rounded-xl px-3 py-2 text-[10px] text-slate-300 focus:border-cyan-500/30 focus:text-white outline-none transition-all placeholder-slate-600 font-sans"
            />

            <div className="flex items-start gap-3 bg-black/40 p-4 rounded-xl border border-white/10 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400/50 transition-all group/input relative">
                <FileText className="w-5 h-5 text-cyan-500/50 group-focus-within/input:text-cyan-400 mt-1 shrink-0" />
                <textarea
                    value={localTitle}
                    onChange={(e) => handleChange(e.target.value)}
                    placeholder="Enter description... (Markdown links supported: [text](url))"
                    className="bg-transparent border-none outline-none text-white text-lg w-full placeholder-slate-600 font-medium resize-none min-h-[100px] custom-scrollbar scrollbar-none"
                    style={{ colorScheme: 'dark', scrollbarWidth: 'thin' }}
                    autoFocus
                    rows={4}
                />
            </div>
        </div>
    );
});

export const StagingEditModal: React.FC<Props> = ({ asset, onClose, onUpdate, onRemove, tags, user }) => {
    const [datePrecision, setDatePrecision] = useState<'exact'|'day'|'month'|'year'|'unknown'>(asset.datePrecision || 'exact');
    const [dateStr, setDateStr] = useState('');
    const [isSparkling, setIsSparkling] = useState(false);
    const [reconciliationSuggestion, setReconciliationSuggestion] = useState<{ matchId: string, confidence: number, reasoning: string } | null>(null);
    const [isReconciling, setIsReconciling] = useState(false);
    
    // Stable Ref for high-performance typing isolation
    const titleRef = useRef(asset.title || '');
    
    // Custom dropdown state
    const [isPrecisionOpen, setIsPrecisionOpen] = useState(false);
    const precisionRef = useRef<HTMLDivElement>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [tagSearch, setTagSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const dateInputRef = useRef<HTMLInputElement>(null);

    // Initialize Date String based on precision and handle conformance
    useEffect(() => {
        if (!asset.logicalDate) return;
        const d = new Date(asset.logicalDate);
        let formatted = '';
        if (datePrecision === 'year') {
            formatted = d.getFullYear().toString();
        } else if (datePrecision === 'month') {
            formatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else if (datePrecision === 'day') {
            formatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } else if (datePrecision === 'unknown') {
            formatted = '5000-01-01';
        } else {
            formatted = formatDateForInput(d);
        }
        setDateStr(formatted);
    }, [asset.logicalDate, datePrecision]);

    // Close Modal on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (precisionRef.current && !precisionRef.current.contains(e.target as Node)) {
                setIsPrecisionOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // [ZEN] Neural Reconciliation Trigger
    useEffect(() => {
        const runReconciliation = async () => {
            // Only run if we have tags but no confirmed person match yet
            const personTags = tags.filter(t => t.type === 'person');
            if (asset.tagIds.length > 0 && personTags.length > 0 && !reconciliationSuggestion) {
                // Find potential extracted name tags (that aren't yet in the user's permanent tags)
                const candidateTagNames = asset.tagIds.filter(id => !tags.some(t => t.id === id));
                if (candidateTagNames.length > 0) {
                    setIsReconciling(true);
                    try {
                        const firstName = candidateTagNames[0].replace('tag-', '').replace(/-/g, ' ');
                        const result = await reconcileVertexPersona(firstName, personTags);
                        if (result.matchId && result.confidence > 0.7) {
                            setReconciliationSuggestion(result as any);
                        }
                    } catch (e) { console.error("Reconciliation failed:", e); }
                    finally { setIsReconciling(false); }
                }
            }
        };
        runReconciliation();
    }, [asset.tagIds, tags]);

    const handleSave = () => {
        const updates: Partial<StagedAsset> = { title: titleRef.current, description: titleRef.current, datePrecision };
        if (dateStr) {
            let d = new Date(asset.logicalDate); // fallback
            if (datePrecision === 'year') {
                d = new Date(`${dateStr}-01-01T00:00:00`);
            } else if (datePrecision === 'month') {
                d = new Date(`${dateStr}-01T00:00:00`);
            } else if (datePrecision === 'day') {
                d = new Date(`${dateStr}T00:00:00`);
            } else if (datePrecision === 'unknown') {
                d = new Date(TEMPORAL_SHOEBOX_DATE);
            } else {
                d = new Date(dateStr);
            }
            if (!isNaN(d.getTime())) {
                updates.logicalDate = d;
            }
        }
        onUpdate(asset.id, updates);
        onClose();
    };

    const handleTitleChange = useCallback((val: string) => {
        titleRef.current = val;
    }, []);

    const handleSparkle = async (directive?: string) => {
        setIsSparkling(true);
        try {
            if (asset.type === 'document') {
                // Documents call Grok with the extracted text to analyze it!
                const docPrompt = `
                You are the AI Document Archivist for GIGI/LifeOS. 
                Below is the raw extracted text from a document drop: "${asset.fileName || 'document'}".
                
                [DOCUMENT CONTENT]
                ${(asset.extractedText || '').substring(0, 8000)}
                
                [USER DIRECTIVE]
                ${directive || 'Provide an elegant, concise archival summary and extract tags.'}
                
                TASK:
                1. Review the document text.
                2. Write a highly high-signal description (caption/summary) for this filing node. Keep it evocative, concise, and focused on facts, names, dates.
                3. Suggest an accurate, clear title for this document.
                4. Identify names of people, specific places, or key subjects mentioned in the text.
                
                Return a strict JSON response containing ONLY:
                {
                  "title": "Suggested Document Title",
                  "description": "Archival summary of the document contents...",
                  "suggestedTags": ["Name 1", "Place Name", "Subject tag"]
                }
                `;
                
                const response = await callXAI("grok-4.3", [{ role: 'user', parts: [{ text: docPrompt }] }], "", { temperature: 0.2 });
                // Strip markdown wrappers if present
                const cleanJson = response.text?.replace(/```json/gi, '').replace(/```/g, '').trim() || '{}';
                const parsed = JSON.parse(cleanJson);
                
                if (parsed.title) titleRef.current = parsed.title;
                
                onUpdate(asset.id, {
                    title: parsed.title || titleRef.current,
                    description: parsed.description || asset.description,
                    extractedVertices: parsed.suggestedTags || []
                });
                
                alert("Smart Filing Analysis Complete! GIGI has extracted key entities and summarized this document.");
            } else {
                const originalText = asset.title || '';
                const polished = await sparkleAssetDescription(titleRef.current, user, directive, originalText);
                titleRef.current = polished;
                alert("Narrative Polished. Save to commit changes.");
            }
        } catch (e) { 
            console.error("Neural Muse execution failed:", e); 
            alert("The Muse was interrupted. Please try again.");
        } finally { 
            setIsSparkling(false); 
        }
    };

    const handleAddTag = (tagId: string) => {
        if (!asset.tagIds.includes(tagId)) {
            onUpdate(asset.id, { tagIds: [...asset.tagIds, tagId] });
        }
    };
    
    const handleRemoveTag = (tagId: string) => {
        onUpdate(asset.id, { tagIds: asset.tagIds.filter(id => id !== tagId) });
    };

    const getIconForTagType = (type: string) => {
        switch (type) {
            case 'person': return <UserIcon className="w-3 h-3" />;
            case 'place': return <MapPin className="w-3 h-3" />;
            default: return <TagIcon className="w-3 h-3" />;
        }
    };

    const isImage = 
        (asset.file?.type || asset.fileType || '').startsWith('image/') || 
        /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(asset.fileName || '') ||
        /\.(jpg|jpeg|png|gif|webp|heic)/i.test(asset.mediaUrl || '') ||
        /\.(jpg|jpeg|png|gif|webp|heic)/i.test(asset.preview || '');

    const isVideo = 
        (asset.file?.type || asset.fileType || '').startsWith('video/') ||
        /\.(mp4|mov|webm|mkv|avi|3gp|m4v)$/i.test(asset.fileName || '') ||
        /\.(mp4|mov|webm|mkv|avi|3gp|m4v)/i.test(asset.mediaUrl || '') ||
        /\.(mp4|mov|webm|mkv|avi|3gp|m4v)/i.test(asset.preview || '');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black pointer-events-none" />
            <div className="absolute inset-0" onClick={onClose} />
            
            <div className="relative bg-[#0B1120] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] w-full max-w-4xl flex flex-col md:flex-row overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh]">
                <div className="w-full md:w-1/2 bg-black/60 relative border-r border-white/10 flex items-center justify-center p-4">
                    {asset.type === 'event' ? (
                        <div className="w-full h-full p-8 flex flex-col items-center justify-center bg-slate-900/40 text-slate-300 relative">
                             <div className="absolute top-8 right-8 opacity-10">
                                <Sparkles size={120} className="text-cyan-400" />
                            </div>
                            <div className="text-xl font-medium leading-relaxed text-center italic font-serif max-w-md z-10">
                                "{asset.description || asset.title || 'No narrative content found.'}"
                            </div>
                            <div className="mt-8 px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 z-10">
                                Narrative Artifact
                            </div>
                        </div>
                    ) : isVideo && (asset.preview || asset.mediaUrl) ? (
                        <video
                            controls
                            playsInline
                            crossOrigin="anonymous"
                            className="w-full h-full object-contain drop-shadow-2xl rounded-lg max-h-[60vh]"
                        >
                            <source src={asset.preview || asset.mediaUrl} type="video/mp4" />
                        </video>
                    ) : isImage && (asset.preview || asset.mediaUrl) ? (
                        <img
                            src={asset.preview || asset.mediaUrl}
                            alt="preview"
                            className="w-full h-full object-contain drop-shadow-2xl rounded-lg"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://dummyimage.com/400x300/1e293b/94a3b8.png&text=PREVIEW+UNAVAILABLE';
                            }}
                        />
                    ) : asset.type === 'document' ? (
                        <div className="w-full h-full flex flex-col justify-between p-6 overflow-hidden relative">
                            {/* Glassmorphic Document Preview Panel */}
                            <div className="flex-1 flex flex-col min-h-0 bg-slate-900/60 rounded-2xl border border-white/5 shadow-2xl relative w-full overflow-hidden">
                                <div className="absolute top-4 right-4 opacity-5 pointer-events-none">
                                    <FileText size={180} className="text-cyan-400" />
                                </div>
                                <div className="px-6 py-4 border-b border-white/5 bg-slate-950/40 flex justify-between items-center z-10">
                                    <div className="flex items-center gap-3">
                                        <FileText size={20} className={
                                            /\.pdf$/i.test(asset.fileName || '') ? 'text-red-400' :
                                            /\.docx?$/i.test(asset.fileName || '') ? 'text-blue-400' :
                                            /\.xlsx?$/i.test(asset.fileName || '') ? 'text-emerald-400' :
                                            'text-slate-400'
                                        } />
                                        <div className="text-left">
                                            <div className="text-sm font-bold text-white max-w-[200px] truncate" title={asset.fileName || asset.title}>
                                                {asset.fileName || asset.title || 'Archival Document'}
                                            </div>
                                            <div className="text-[10px] font-mono text-slate-400 uppercase">
                                                {((asset.file?.size || asset.fileSize || 0) / 1024).toFixed(1)} KB • {asset.fileName?.split('.').pop() || 'DOC'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* RAG Feed Controller */}
                                        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">RAG FEED</span>
                                            <button
                                                onClick={() => onUpdate(asset.id, { ragEnabled: asset.ragEnabled === false ? true : false })}
                                                className={`w-10 h-5 rounded-full transition-all duration-300 relative border flex items-center ${
                                                    asset.ragEnabled !== false 
                                                        ? 'bg-cyan-500/20 border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)] justify-end' 
                                                        : 'bg-slate-800 border-slate-700 justify-start'
                                                }`}
                                            >
                                                <div className={`w-3.5 h-3.5 rounded-full mx-0.5 shadow-md transition-all ${
                                                    asset.ragEnabled !== false ? 'bg-cyan-400' : 'bg-slate-500'
                                                }`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 font-mono text-xs leading-relaxed text-slate-300 text-left whitespace-pre-wrap select-text custom-scrollbar">
                                    {asset.extractedText || (
                                        <span className="italic opacity-40">No text extracted from this document.</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-slate-500 gap-4">
                            <FileText className="w-24 h-24 opacity-30" />
                            <span className="text-sm font-mono uppercase tracking-widest opacity-50">
                                {asset.file?.type || asset.fileType || 'Binary Data'}
                            </span>
                        </div>
                    )}
                </div>

                <div 
                    className="w-full md:w-1/2 p-8 flex flex-col justify-center space-y-8 relative overflow-y-auto custom-scrollbar"
                    style={{ colorScheme: 'dark', scrollbarWidth: 'thin' }}
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div>
                        <h2 className="text-2xl font-black tracking-tighter text-white mb-1">Metadata Extractor</h2>
                        <p className="text-xs font-mono text-cyan-500/70 uppercase tracking-widest">Active Focus Mode</p>
                    </div>

                    <div className="space-y-6">
                        <NarrativeEditor 
                            key={`staged-${asset.id}`}
                            initialTitle={asset.title || ''}
                            onTitleChange={handleTitleChange}
                            isSparkling={isSparkling}
                            handleSparkle={handleSparkle}
                        />

                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Archive Timestamp</label>
                                <div className="relative" ref={precisionRef}>
                                    <button 
                                        className="flex items-center gap-1 bg-black/40 border border-white/10 text-violet-400 text-[10px] font-black uppercase tracking-widest rounded px-2 py-1 outline-none hover:border-violet-500/50 transition-all cursor-pointer"
                                        onClick={() => setIsPrecisionOpen(!isPrecisionOpen)}
                                    >
                                        {datePrecision === 'exact' ? 'Exact Time' : 
                                         datePrecision === 'day' ? 'Date Only' :
                                         datePrecision === 'month' ? 'Month & Year' : 
                                         datePrecision === 'year' ? 'Year Only' : 'Unknown (Shoebox)'}
                                        <ChevronDown className={`w-3 h-3 transition-transform ${isPrecisionOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isPrecisionOpen && (
                                        <div className="absolute right-0 mt-1 w-32 bg-[#1a1d26] border border-white/10 rounded-lg shadow-2xl overflow-hidden z-[110] animate-in fade-in zoom-in-95">
                                            {[
                                                { id: 'exact', label: 'Exact Time' },
                                                { id: 'day', label: 'Date Only' },
                                                { id: 'month', label: 'Month & Year' },
                                                { id: 'year', label: 'Year Only' },
                                                { id: 'unknown', label: 'Unknown (Shoebox)' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    className={`w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-violet-500/20 ${
                                                        datePrecision === opt.id ? 'text-violet-400 bg-violet-500/10' : 'text-slate-400 hover:text-slate-200'
                                                    }`}
                                                    onClick={() => {
                                                        setDatePrecision(opt.id as any);
                                                        setIsPrecisionOpen(false);
                                                    }}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div 
                                className={`flex items-center gap-3 bg-black/40 p-4 rounded-xl border border-white/10 focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-400/50 transition-all group/input cursor-pointer ${datePrecision === 'unknown' ? 'opacity-50 grayscale' : ''}`}
                                onClick={() => {
                                    if (datePrecision === 'unknown') return;
                                    if (datePrecision !== 'year') {
                                        dateInputRef.current?.showPicker();
                                    } else {
                                        dateInputRef.current?.focus();
                                    }
                                }}
                            >
                                <Calendar className="w-5 h-5 text-violet-500/50 group-focus-within/input:text-violet-400" />
                                {datePrecision === 'unknown' ? (
                                    <div className="flex-1 text-amber-400 font-mono text-sm flex items-center gap-2">
                                        <Archive className="w-4 h-4" /> RELEGATED TO SHOEBOX (YEAR 5000)
                                    </div>
                                ) : datePrecision === 'year' ? (
                                    <input
                                        ref={dateInputRef}
                                        type="number"
                                        placeholder="YYYY"
                                        value={dateStr}
                                        onChange={(e) => setDateStr(e.target.value)}
                                        className="bg-transparent border-none outline-none text-white text-lg w-full font-mono cursor-pointer"
                                        style={{ colorScheme: 'dark' }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : datePrecision === 'month' ? (
                                    <input
                                        ref={dateInputRef}
                                        type="month"
                                        value={dateStr}
                                        onChange={(e) => setDateStr(e.target.value)}
                                        className="bg-transparent border-none outline-none text-white text-lg w-full font-mono cursor-pointer"
                                        style={{ colorScheme: 'dark' }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : datePrecision === 'day' ? (
                                    <input
                                        ref={dateInputRef}
                                        type="date"
                                        value={dateStr}
                                        onChange={(e) => setDateStr(e.target.value)}
                                        className="bg-transparent border-none outline-none text-white text-lg w-full font-mono cursor-pointer"
                                        style={{ colorScheme: 'dark' }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <input
                                        ref={dateInputRef}
                                        type="datetime-local"
                                        value={dateStr}
                                        onChange={(e) => setDateStr(e.target.value)}
                                        className="bg-transparent border-none outline-none text-white text-lg w-full font-mono cursor-pointer"
                                        style={{ colorScheme: 'dark' }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                )}
                            </div>
                        </div>

                        {/* [ZEN] Neural Stitching Suggestions */}
                        {reconciliationSuggestion && (
                            <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-violet-500/20 rounded-lg text-violet-400">
                                        <Sparkles size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[10px] font-black text-violet-300 uppercase tracking-widest">Neural Stitching Suggestion</h4>
                                            <span className="text-[9px] font-mono text-violet-500/60 font-black">CONFIDENCE: {(reconciliationSuggestion.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                            {reconciliationSuggestion.reasoning}
                                        </p>
                                        <button 
                                            onClick={() => {
                                                const matchTag = tags.find(t => t.id === reconciliationSuggestion.matchId);
                                                if (matchTag) {
                                                    // Swap the extracted tag for the permanent one
                                                    const newTagIds = asset.tagIds.filter(id => !id.includes(matchTag.name.toLowerCase().replace(/\s+/g, '-')));
                                                    if (!newTagIds.includes(matchTag.id)) {
                                                        newTagIds.push(matchTag.id);
                                                    }
                                                    onUpdate(asset.id, { tagIds: newTagIds });
                                                    setReconciliationSuggestion(null);
                                                }
                                            }}
                                            className="mt-3 px-4 py-1.5 bg-violet-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-violet-400 transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] active:scale-95"
                                        >
                                            Link to {tags.find(t => t.id === reconciliationSuggestion.matchId)?.name}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3 pt-4 border-t border-white/5">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                <TagIcon className="w-4 h-4" /> Related Tags & Verts
                            </label>
                            
                            <div className="flex flex-wrap gap-2">
                                {asset.tagIds.map(tagId => {
                                    const tag = tags.find(t => t.id === tagId);
                                    if (!tag) return null;
                                    return (
                                        <div key={tagId} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1F2833] text-white text-xs font-medium rounded-full border border-white/10 group">
                                            <span className="text-slate-400">{getIconForTagType(tag.type)}</span>
                                            {tag.name}
                                            <button 
                                                onClick={() => handleRemoveTag(tagId)}
                                                className="ml-1 text-slate-500 hover:text-red-400 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    className="w-full bg-black/40 border border-white/10 text-slate-300 text-sm rounded-lg p-3 outline-none hover:border-cyan-500/50 transition-colors flex justify-between items-center"
                                >
                                    <span>+ Add Tag / Person...</span>
                                    <span className="text-xs">▼</span>
                                </button>

                                {isDropdownOpen && (
                                    <div className="absolute z-[110] w-full mt-2 bg-[#0F1423] border border-white/10 rounded-lg shadow-2xl max-h-80 overflow-hidden flex flex-col drop-shadow-2xl animate-in fade-in zoom-in-95">
                                        <div className="p-2 border-b border-white/10 bg-black/20">
                                            <input 
                                                type="text"
                                                autoFocus
                                                placeholder="Search tags..."
                                                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50 transition-all"
                                                value={tagSearch}
                                                onChange={(e) => setTagSearch(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>

                                        <div className="overflow-y-auto custom-scrollbar max-h-60">
                                            {tags
                                                .filter(t => !asset.tagIds.includes(t.id))
                                                .filter(t => t.name.toLowerCase().includes(tagSearch.toLowerCase()))
                                                .sort((a,b) => a.name.localeCompare(b.name))
                                                .map(tag => (
                                                    <div 
                                                        key={tag.id}
                                                        className="px-4 py-3 hover:bg-white/10 cursor-pointer text-sm text-slate-200 flex items-center gap-3 transition-colors border-b border-white/5 last:border-b-0"
                                                        onClick={() => {
                                                            handleAddTag(tag.id);
                                                            setIsDropdownOpen(false);
                                                            setTagSearch('');
                                                        }}
                                                    >
                                                        <span className="opacity-70">{tag.type === 'person' ? '👤' : tag.type === 'place' ? '📍' : '🏷️'}</span>
                                                        <span className="font-medium">{tag.name}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Neural Vertex Harvester for Documents */}
                        {asset.type === 'document' && asset.extractedVertices && asset.extractedVertices.length > 0 && (
                            <div className="space-y-2 bg-slate-900/40 p-4 rounded-xl border border-cyan-500/20 shadow-inner">
                                <div className="flex items-center gap-2 text-cyan-400 text-xs font-black uppercase tracking-widest">
                                    <Sparkles size={14} className="animate-pulse text-cyan-400" />
                                    <span>Neural Vertex Harvester</span>
                                </div>
                                <p className="text-[10px] text-slate-400 italic">
                                    Click any AI-extracted entities below to instantly promote them to GIGI tags:
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {asset.extractedVertices.map((vertex, i) => {
                                        // Check if this tag is already in asset's tags (either by name or id)
                                        const isAlreadyTagged = asset.tagIds.some(id => {
                                            const existingTag = tags.find(t => t.id === id);
                                            return existingTag?.name.toLowerCase() === vertex.toLowerCase();
                                        }) || asset.tagIds.includes(vertex);

                                        return (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    if (isAlreadyTagged) return;
                                                    // Find if there is an existing global tag matching this name
                                                    const matchedTag = tags.find(t => t.name.toLowerCase() === vertex.toLowerCase());
                                                    if (matchedTag) {
                                                        handleAddTag(matchedTag.id);
                                                    } else {
                                                        // Create a provisional tag ID
                                                        const newTagId = `tag-${vertex.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
                                                        handleAddTag(newTagId);
                                                    }
                                                }}
                                                disabled={isAlreadyTagged}
                                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                                                    isAlreadyTagged 
                                                        ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-default'
                                                        : 'bg-cyan-500/10 hover:bg-cyan-500/30 text-cyan-400 border-cyan-500/30 active:scale-95'
                                                }`}
                                            >
                                                {isAlreadyTagged ? <Check size={10} className="text-slate-500" /> : <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />}
                                                {vertex}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-8 flex items-center gap-4">
                        <button
                            onClick={() => { onRemove(asset.id); onClose(); }}
                            className="p-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all border border-red-500/30 flex items-center justify-center active:scale-[0.98]"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            <Save className="w-5 h-5" />
                            Commit Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
