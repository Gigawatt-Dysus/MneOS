import React, { useState, useEffect } from 'react';
// [STABILITY-SYNC-V2] Purging Ghost useRef References
import ReactMarkdown from 'react-markdown';
import { X, Calendar, FileText, Check, Clock, Maximize2, Wand2, Edit3, AlertTriangle, Sparkles, User as UserIcon, Link as LinkIcon, MessageSquare } from 'lucide-react';
import { StagedAsset } from './types';
import { formatLifeOSDate, formatDateForInput } from '../../utils/dateSanitizer';
import { getPolishFilter } from '../../utils/mediaUtils';

interface StagingCardProps {
    asset: StagedAsset;
    onRemove: (id: string) => void;
    onUpdate: (id: string, updates: Partial<StagedAsset>) => void;
    onEdit: (id: string) => void;
}

export const StagingCard: React.FC<StagingCardProps> = ({ asset, onRemove, onEdit, onUpdate }) => {

    const displayPreview = asset.preview || asset.mediaUrl;
    
    const isImage = 
        (asset.file?.type || asset.fileType || '').startsWith('image/') || 
        /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(asset.fileName || '') ||
        /\.(jpg|jpeg|png|gif|webp|heic)/i.test(asset.mediaUrl || '') ||
        /\.(jpg|jpeg|png|gif|webp|heic)/i.test(asset.preview || '') ||
        (asset.type === 'event' && !!displayPreview); // [ZEN] Treat events with previews as images

    const isVideo = 
        (asset.file?.type || asset.fileType || '').startsWith('video/') ||
        /\.(mp4|mov|webm|mkv|avi|3gp|m4v)$/i.test(asset.fileName || '') ||
        /\.(mp4|mov|webm|mkv|avi|3gp|m4v)/i.test(asset.mediaUrl || '') ||
        /\.(mp4|mov|webm|mkv|avi|3gp|m4v)/i.test(asset.preview || '');

    const fileName = asset.file?.name || asset.fileName || '';
    const fileType = asset.file?.type || asset.fileType || '';

    const isPdf = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
    const isWord = fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileType === 'application/msword' || fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc');
    const isExcel = fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileType === 'application/vnd.ms-excel' || fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');
    const isText = fileType.startsWith('text/') || fileName.toLowerCase().endsWith('.txt') || fileName.toLowerCase().endsWith('.md');

    const sourceLabel = asset.source === 'email' ? 'Email Ingest' : 
                       asset.source === 'shoebox' ? 'Shoebox' : 
                       asset.source === 'google-photos-sideload' ? 'Google Photos' :
                       'Local Drop';

    const sourceColor = asset.source === 'email' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 
                       asset.source === 'google-photos-sideload' ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' :
                       'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';

    const [isFocused, setIsFocused] = useState(false);
    const [localDateStr, setLocalDateStr] = useState(formatDateForInput(new Date(asset.logicalDate)));
    const [localTitle, setLocalTitle] = useState(asset.title || '');

    // Sync local state ONLY when global props change AND we aren't editing
    useEffect(() => {
        if (!isFocused) {
            setLocalDateStr(formatDateForInput(new Date(asset.logicalDate)));
        }
    }, [asset.logicalDate]);

    useEffect(() => {
        if (!isFocused) {
            setLocalTitle(asset.title || '');
        }
    }, [asset.title]);

    const handleDateChange = (val: string) => {
        setLocalDateStr(val);
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
            onUpdate(asset.id, { logicalDate: d });
        }
    };

    const handleDateBlur = () => {
        setIsFocused(false);
        const d = new Date(localDateStr);
        if (isNaN(d.getTime())) {
            // Revert to global state if invalid on blur
            setLocalDateStr(formatDateForInput(new Date(asset.logicalDate)));
            return;
        }
        
        let year = d.getFullYear();
        // [ZEN] Post-Processing Repair
        if (year >= 10 && year <= 99 && year !== 19 && year !== 20) {
            year += (year > 50 ? 1900 : 2000);
            d.setFullYear(year);
        }
        
        onUpdate(asset.id, { logicalDate: d });
        setLocalDateStr(formatDateForInput(d));
    };

    const handleTitleBlur = () => {
        setIsFocused(false);
        if (localTitle !== asset.title) {
            onUpdate(asset.id, { title: localTitle });
        }
    };

    return (
        <div className="bg-[#0A1120] rounded-xl border border-white/10 overflow-hidden shadow-2xl hover:border-cyan-500/50 transition-colors group flex flex-col h-full relative">
            {/* Header / Remove */}
            <div className="relative h-48 bg-black/40 overflow-hidden">
                {(asset.type === 'event' && !displayPreview) ? (
                    <div className="w-full h-full p-6 flex flex-col items-center justify-center bg-slate-900/40 text-slate-300 relative group-hover:bg-slate-900/60 transition-colors overflow-hidden">
                        <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles size={48} className="text-cyan-400" />
                        </div>
                        <div className="text-sm font-medium leading-relaxed line-clamp-5 text-center italic font-serif break-all px-2">
                            "{asset.description || 'No narrative content found.'}"
                        </div>
                        <div className="mt-4 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[9px] font-black uppercase tracking-widest text-cyan-400">
                            Narrative Jot
                        </div>
                    </div>
                ) : isVideo && displayPreview ? (
                    <>
                        <video
                            muted
                            playsInline
                            loop
                            autoPlay
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105 pointer-events-none"
                            style={{ filter: getPolishFilter(asset) }}
                        >
                            <source src={displayPreview} type="video/mp4" />
                        </video>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    </>
                ) : isImage && displayPreview ? (
                    <>
                        <img
                            src={displayPreview}
                            alt="preview"
                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                            style={{ filter: getPolishFilter(asset) }}
                            onError={(e) => {
                                console.warn("Staging preview failed to load:", displayPreview);
                                (e.target as HTMLImageElement).src = 'https://dummyimage.com/400x300/1e293b/94a3b8.png&text=PREVIEW+UNAVAILABLE';
                                (e.target as HTMLImageElement).onerror = null; // Prevent infinite loop
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    </>
                ) : asset.type === 'messenger_log' ? (
                    <div className="w-full h-full p-6 flex flex-col items-center justify-center bg-violet-500/10 text-violet-300 relative group-hover:bg-violet-900/40 transition-colors overflow-hidden">
                        <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <MessageSquare size={48} className="text-violet-400" />
                        </div>
                        <div className="text-[10px] font-mono leading-relaxed line-clamp-6 text-left opacity-80 break-all px-2 bg-black/20 p-2 rounded border border-white/5">
                            {asset.description || (asset as any).content || 'No message log content.'}
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <div className="px-3 py-1 bg-violet-500/20 border border-violet-500/30 rounded-full text-[9px] font-black uppercase tracking-widest text-violet-400">
                                Message Log
                            </div>
                            {asset.metadata?.messageCount && (
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    <Clock size={10} /> {asset.metadata.messageCount} Turns • {asset.metadata.durationMinutes}m
                                </div>
                            )}
                        </div>
                    </div>
                ) : asset.type === 'signal' ? (
                    <div className="w-full h-full p-6 flex flex-col items-center justify-center bg-cyan-500/10 text-cyan-300 relative group-hover:bg-cyan-900/40 transition-colors overflow-hidden">
                        <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles size={48} className="text-cyan-400" />
                        </div>
                        <div className="text-xs font-bold text-center mb-1 text-cyan-200">
                            {asset.title}
                        </div>
                        <div className="text-[9px] font-mono text-center opacity-60 line-clamp-3">
                            {asset.description || (asset as any).body}
                        </div>
                        <div className="mt-4 px-3 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-[9px] font-black uppercase tracking-widest text-cyan-400">
                            Digital Signal
                        </div>
                    </div>
                ) : asset.type === 'tag' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-amber-500/10 text-amber-400 gap-4">
                        <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                            <UserIcon size={40} />
                        </div>
                        <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-[9px] font-black uppercase tracking-widest">
                            Person Discovery
                        </div>
                    </div>
                ) : asset.type === 'document' ? (
                    <div className={`w-full h-full p-4 flex flex-col justify-between overflow-hidden relative transition-colors ${
                        isPdf ? 'bg-red-500/10 text-red-300 group-hover:bg-red-950/20' :
                        isWord ? 'bg-blue-500/10 text-blue-300 group-hover:bg-blue-950/20' :
                        isExcel ? 'bg-emerald-500/10 text-emerald-300 group-hover:bg-emerald-950/20' :
                        'bg-slate-500/10 text-slate-300 group-hover:bg-slate-900/20'
                    }`}>
                        {/* Glow effect */}
                        <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <FileText size={48} className={
                                isPdf ? 'text-red-400' :
                                isWord ? 'text-blue-400' :
                                isExcel ? 'text-emerald-400' :
                                'text-slate-400'
                            } />
                        </div>

                        {/* Extracted Text Sniek Peek */}
                        <div className="flex-1 flex flex-col justify-center overflow-hidden z-10">
                            <div className="text-[10px] font-mono leading-relaxed line-clamp-5 text-left opacity-90 break-all bg-black/40 p-2 rounded border border-white/5 shadow-inner select-none custom-scrollbar scrollbar-none">
                                {asset.extractedText ? (
                                    asset.extractedText.length > 200 
                                        ? asset.extractedText.substring(0, 200) + '...'
                                        : asset.extractedText
                                ) : (
                                    <span className="italic opacity-40">No preview text available.</span>
                                )}
                            </div>
                        </div>

                        {/* Document Type Badge */}
                        <div className="mt-3 flex items-center justify-between z-10">
                            <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                isPdf ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                isWord ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                isExcel ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                'bg-slate-500/20 text-slate-400 border-slate-500/30'
                            }`}>
                                {isPdf ? 'PDF ARCHIVE' : isWord ? 'WORD DOCUMENT' : isExcel ? 'EXCEL SHEET' : 'TEXT FILE'}
                            </div>
                            <span className="text-[8px] font-mono opacity-50 uppercase tracking-widest">{fileName.split('.').pop() || 'DOC'}</span>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-2">
                        <FileText className="w-12 h-12 opacity-30" />
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">{asset.file?.type || asset.fileType || 'Binary Data'}</span>
                    </div>
                )}

                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(asset.id); }}
                    className="absolute top-3 right-3 p-2 bg-black/60 text-red-400 rounded-full hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-xl border border-white/10 active:scale-95 z-20"
                    title="Reject Artifact"
                >
                    <X className="w-4 h-4" />
                </button>

                <div className={`absolute top-3 left-3 px-2 py-1 ${sourceColor} text-[10px] font-black uppercase tracking-tighter rounded border flex items-center gap-1 backdrop-blur-md z-20`}>
                    <Check className="w-3 h-3" /> {sourceLabel}
                </div>

                {/* GIGI Polish Indicator */}
                <div className="absolute top-12 left-3 px-2 py-1 bg-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-tighter rounded border border-violet-500/30 flex items-center gap-1 backdrop-blur-md z-20">
                    <Wand2 className="w-3 h-3" /> GIGI Polish Ready
                </div>
                
                {/* Duplicate Warning */}
                {asset.isDuplicate && (
                    <div className="absolute top-20 left-3 px-2 py-1 bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-tighter rounded border border-red-500/30 flex items-center gap-1 backdrop-blur-md z-20 animate-pulse">
                        <AlertTriangle className="w-3 h-3" /> Duplicate Detected
                    </div>
                )}

                <div className="absolute bottom-3 left-3 right-3 text-[10px] font-mono text-slate-400 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {asset.file?.name || asset.fileName}
                </div>
            </div>

            {/* Content / View Fields (Click to Edit) */}
            <div className="p-4 space-y-4 flex-1 flex flex-col relative hover:bg-white/[0.02] transition-colors group/fields">
                
                {/* [ZEN FIX] Review Trigger - Hidden when focused to avoid blocking the user's view */}
                {!isFocused && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/fields:opacity-100 transition-all z-20 pointer-events-none bg-black/20 rounded-b-xl">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(asset.id); }}
                            className="pointer-events-auto bg-cyan-500 text-black px-6 py-2 rounded-full text-xs font-black tracking-widest border border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Maximize2 size={14} /> ACCESSION REVIEW
                        </button>
                    </div>
                )}

                {/* Title Display / Inline Editor */}
                <div className="space-y-1 relative z-10">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <FileText size={10} /> Asset Identity
                    </label>
                    <div className={`flex items-start gap-3 bg-black/40 p-3 rounded-lg border transition-colors ${isFocused ? 'border-cyan-500/50' : 'border-white/5'}`}>
                        <textarea
                            value={localTitle}
                            onChange={(e) => setLocalTitle(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={handleTitleBlur}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Pending identification..."
                            rows={2}
                            className="bg-transparent border-none outline-none text-white text-sm w-full font-medium resize-none custom-scrollbar scrollbar-none placeholder-slate-600"
                        />
                    </div>
                </div>

                {/* Date Display / Inline Editor */}
                <div className="space-y-1 relative z-10">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                        <Calendar size={10} /> Archive Timestamp
                    </label>
                    <div className={`flex items-center gap-3 bg-black/40 p-3 rounded-lg border transition-colors ${isFocused ? 'border-violet-500/50' : 'border-white/5'}`}>
                        <input
                            type="datetime-local"
                            value={localDateStr}
                            onChange={(e) => handleDateChange(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={handleDateBlur}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent border-none outline-none text-white text-[11px] w-full font-mono uppercase tracking-wider cursor-pointer"
                            style={{ colorScheme: 'dark' }}
                        />
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-3">
                    {asset.type === 'tag' && asset.metadata.potentialMatchId && (
                        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-cyan-400 text-[10px] font-black uppercase tracking-widest">
                                <Sparkles size={12} /> Neural Match Found
                            </div>
                            <div className="text-xs text-white font-medium">
                                Matches existing: <span className="text-cyan-400 font-bold">{asset.metadata.potentialMatchName}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 italic leading-tight">
                                {asset.metadata.matchReasoning}
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdate(asset.id, { 
                                        matchedToId: asset.metadata.potentialMatchId,
                                        title: asset.metadata.potentialMatchName,
                                        status: 'merged' 
                                    });
                                }}
                                className="mt-1 w-full bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest border border-cyan-500/30 transition-all flex items-center justify-center gap-2"
                            >
                                <LinkIcon size={12} /> Link to {asset.metadata.potentialMatchName.split(' ')[0]}
                            </button>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                            {asset.type === 'tag' ? (
                                <>
                                    <UserIcon size={12} className="opacity-50" />
                                    <span>Person Entity</span>
                                </>
                            ) : asset.type === 'document' ? (
                                <>
                                    <FileText size={12} className="opacity-50" />
                                    <span>{isPdf ? 'PDF' : isWord ? 'DOCX' : isExcel ? 'XLSX' : 'TXT'} Ingest</span>
                                </>
                            ) : (
                                <>
                                    <Maximize2 size={12} className="opacity-50" />
                                    <span>{asset.metadata.width || 0}x{asset.metadata.height || 0}</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock size={12} className="opacity-50" />
                            <span>{asset.file ? (asset.file.size / 1024 / 1024).toFixed(2) : (asset.fileSize ? (asset.fileSize / 1024 / 1024).toFixed(2) : '0.00')} MB</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};