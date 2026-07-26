// ============================================================
// AirlockFileCard — Single file card for TakeoutAirlock grid
// Preview is served via the local API (/api/preview?filepath=...)
// NOT from MongoDB or any cloud storage.
// ============================================================
import React, { useState } from 'react';
import {
    FileText, Film, Music, Image, File, ChevronRight,
    AlertTriangle, HardDrive, CheckCircle, Circle, Edit2, Check, Loader2,
    Zap, ExternalLink, Trash2, EyeOff
} from 'lucide-react';
import type { StagingFile } from './types';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'avif', 'bmp', 'tiff']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'mkv', 'avi', '3gp', 'm4v']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg']);
const DOC_EXTS   = new Set(['pdf', 'doc', 'docx', 'txt', 'md', 'xls', 'xlsx', 'csv']);

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

interface AirlockFileCardProps {
    file: StagingFile;
    previewUrl: (filepath: string) => string;
    isSelected?: boolean;
    onToggleSelect?: () => void;
    onClick?: () => void;
    onInspect?: () => void;
    onOpen?: () => void;
    onOpenTriage?: () => void;
    onDelete?: () => void;
}

export const AirlockFileCard: React.FC<AirlockFileCardProps> = ({ 
    file, 
    previewUrl,
    isSelected = false,
    onToggleSelect,
    onClick,
    onInspect,
    onOpen,
    onOpenTriage,
    onDelete
}) => {
    const ext = (file.extension || '').toLowerCase().replace(/^\./, '');
    const isImage = IMAGE_EXTS.has(ext);
    const isVideo = VIDEO_EXTS.has(ext);
    const isAudio = AUDIO_EXTS.has(ext);
    const isDoc   = DOC_EXTS.has(ext);
    const isDuplicate = !!file.duplicate_of;

    const [imgError, setImgError] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [captionText, setCaptionText] = useState(file.caption || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isPrivate, setIsPrivate] = useState(Boolean(file.is_private));

    const handleTogglePrivate = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const newState = !isPrivate;
        setIsPrivate(newState); // Optimistic UI update
        try {
            const res = await fetch('http://localhost:3001/api/files/private', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash: file.hash, is_private: newState })
            });
            if (!res.ok) {
                setIsPrivate(!newState); // revert on error
                console.error('Failed to toggle privacy flag');
            } else {
                file.is_private = newState ? 1 : 0;
            }
        } catch (err) {
            setIsPrivate(!newState);
            console.error('Network error toggling privacy flag', err);
        }
    };

    const handleSaveCaption = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (captionText === file.caption) {
            setIsEditing(false);
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch('http://localhost:3001/api/files/caption', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash: file.hash, caption: captionText })
            });
            if (res.ok) {
                file.caption = captionText;
                file.process_state = 'reembed_pending';
            }
        } catch (err) {
            console.error('Failed to save caption', err);
        }
        setIsSaving(false);
        setIsEditing(false);
    };

    const preview = previewUrl(file.filepath);

    return (
        <div 
            onClick={() => onClick ? onClick() : (onOpenTriage ? onOpenTriage() : window.open(preview, '_blank'))}
            className={`
            relative bg-[#0A1120] rounded-xl border overflow-hidden shadow-xl group flex flex-col cursor-pointer
            transition-all duration-200 hover:scale-[1.02]
            ${isSelected 
                ? 'border-[#66FCF1] ring-2 ring-[#66FCF1]/50'
                : isDuplicate
                    ? 'border-red-500/30 hover:border-red-500/60'
                    : 'border-white/10 hover:border-[#66FCF1]/50'
            }
        `}>
            {/* Selection Overlay Checkbox */}
            {onToggleSelect && (
                <div 
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
                    className="absolute top-2 left-2 z-10 p-1.5 rounded-full bg-black/50 transition-colors"
                >
                    {isSelected ? (
                        <CheckCircle size={20} className="text-[#66FCF1] fill-[#66FCF1]/20" />
                    ) : (
                        <Circle size={20} className="text-white/50 group-hover:text-white/80" />
                    )}
                </div>
            )}
            
            {/* Action Buttons Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 pointer-events-none z-10">
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete && onDelete(); }}
                    className="p-2 bg-red-600/80 hover:bg-red-500 text-white rounded-full transition-transform hover:scale-110 shadow-lg pointer-events-auto"
                    title="EJECT ITEM: Instantly hard-deletes this individual file from staging.db"
                >
                    <Trash2 size={16} />
                </button>
                {onOpenTriage && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenTriage(); }}
                        className="p-2 bg-emerald-600/80 hover:bg-emerald-500 text-white rounded-full transition-transform hover:scale-110 shadow-lg pointer-events-auto"
                        title="AI Triage Re-Roll (Qwen/Grok)"
                    >
                        <Zap size={16} />
                    </button>
                )}
                <button
                    onClick={handleTogglePrivate}
                    className={`p-2 rounded-full transition-transform hover:scale-110 shadow-lg pointer-events-auto ${isPrivate ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white' : 'bg-slate-700/80 hover:bg-slate-600 text-slate-300'}`}
                    title={isPrivate ? "Unmark as Private" : "Mark as Private / NSFW"}
                >
                    <EyeOff size={16} />
                </button>
            </div>

            {/* Preview Area */}
            <div className="relative h-40 bg-black/40 overflow-hidden">
                {isImage && !imgError ? (
                    <>
                        <img
                            src={preview}
                            alt={file.filename}
                            className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                            onError={() => setImgError(true)}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                    </>
                ) : isVideo ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-violet-900/20 text-violet-400 gap-2">
                        <Film size={36} className="opacity-60" />
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">.{ext}</span>
                    </div>
                ) : isAudio ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-900/20 text-emerald-400 gap-2">
                        <Music size={36} className="opacity-60" />
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">.{ext}</span>
                    </div>
                ) : isDoc ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-sky-900/20 text-sky-400 gap-2">
                        <FileText size={36} className="opacity-60" />
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">.{ext}</span>
                    </div>
                ) : (imgError || true) && !isImage ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/40 text-slate-500 gap-2">
                        <File size={36} className="opacity-40" />
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">.{ext || 'bin'}</span>
                    </div>
                ) : null}

                {/* Extension Badge */}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-[9px] font-black uppercase tracking-widest rounded text-amber-400 border border-amber-500/20">
                    .{ext || 'bin'}
                </div>

                {/* Duplicate Warning Badge */}
                {isDuplicate && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[9px] font-black uppercase tracking-widest text-red-400 animate-pulse">
                        <AlertTriangle size={9} /> DUPE
                    </div>
                )}

                {/* Privacy/NSFW Badge */}
                {isPrivate && (
                    <div className="absolute top-2 right-16 flex items-center gap-1 px-2 py-0.5 bg-fuchsia-500/20 border border-fuchsia-500/30 rounded text-[9px] font-black uppercase tracking-widest text-fuchsia-400">
                        <EyeOff size={9} /> PRIVATE
                    </div>
                )}
            </div>


            {/* Info Footer */}
            <div className="p-3 flex flex-col gap-2 flex-1">
                <p
                    className="text-xs font-medium text-slate-200 truncate group-hover:text-amber-300 transition-colors"
                    title={file.filename}
                >
                    {file.filename}
                </p>

                {/* Caption Display & Editor */}
                {file.process_state && (
                    <div className="bg-black/30 rounded border border-white/5 p-2" onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                            <div className="flex flex-col gap-2">
                                <textarea
                                    value={captionText}
                                    onChange={(e) => setCaptionText(e.target.value)}
                                    className="w-full bg-[#050A15] text-[11px] leading-relaxed font-mono text-slate-300 border border-[#66FCF1]/30 rounded p-2 outline-none resize-y min-h-[96px] custom-scrollbar"
                                    autoFocus
                                />
                                <div className="flex justify-end">
                                    <button 
                                        onClick={handleSaveCaption}
                                        disabled={isSaving}
                                        className="px-3 py-1.5 flex items-center gap-1.5 rounded bg-[#66FCF1]/10 text-[#66FCF1] hover:bg-[#66FCF1]/30 disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest transition-colors"
                                    >
                                        {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                        {isSaving ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="group/caption flex items-start justify-between gap-2 cursor-text" onClick={() => setIsEditing(true)}>
                                <p className="text-[10px] font-mono text-slate-400 max-h-24 overflow-y-auto custom-scrollbar pr-1 leading-tight flex-1">
                                    {file.caption || <span className="italic opacity-50">No caption yet...</span>}
                                </p>
                                <Edit2 size={10} className="text-slate-500 opacity-0 group-hover/caption:opacity-100 transition-opacity mt-0.5 shrink-0" />
                            </div>
                        )}
                        {file.process_state === 'reembed_pending' && !isEditing && (
                            <div className="text-[8px] font-bold text-amber-500 uppercase tracking-widest mt-1 animate-pulse">
                                Vector Sync Pending
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between mt-auto pt-1">
                    <div className="flex items-center gap-1 text-slate-600 text-[10px] font-mono">
                        <HardDrive size={10} />
                        <span>{formatBytes(file.size)}</span>
                    </div>
                    <div
                        className="text-slate-600 text-[9px] font-mono truncate max-w-[120px] text-right"
                        title={file.filepath}
                    >
                        {file.filepath.split(/[/\\]/).slice(-2, -1)[0] ?? ''}
                        <ChevronRight size={9} className="inline" />
                    </div>
                </div>
            </div>
        </div>
    );
};
