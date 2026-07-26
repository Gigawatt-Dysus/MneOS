import React from 'react';
import { Printer, FileText, Trash2, Archive, Inbox, Brain, Link as LinkIcon, X, Share2, Shield, Wand2, Layers, ChevronUp } from 'lucide-react';
import { GlassButton } from './GlassButton';
import type { Bucket } from '../types';

interface SelectionActionsBarProps {
    selectedCount: number;
    onClearSelection: () => void;
    onPrint?: () => void;
    onExportTxt?: () => void;
    onMarkRead?: () => void;
    onMarkUnread?: () => void;
    onDelete?: () => void;
    onDeepDive?: () => void;
    onAlias?: () => void;
    onPDF?: () => void;
    onUnlink?: () => void;
    onEditDate?: () => void; // [ZEN]
    onShare?: () => void; // [ZEN NEW]
    onHealThumbnails?: () => void; // [ZEN LAZY HITL FIX]
    buckets?: Bucket[]; // [ZEN]
    onMoveToBucket?: (bucketId: string | null) => void; // [ZEN]
    onCreateBucket?: () => void; // [ZEN]
    onPromoteToVortex?: () => void; // [ZEN] Promote to Vortex
    onAssignTensor?: () => void; // [ZEN] Assign EmoDB Tensor
    className?: string; // [ZEN FIX] Allow positioning overrides
}

const SelectionActionsBar: React.FC<SelectionActionsBarProps> = ({
    selectedCount,
    onClearSelection,
    onPrint,
    onExportTxt,
    onMarkRead,
    onMarkUnread,
    onDelete,
    onDeepDive,
    onAlias,
    onPDF,
    onUnlink,
    onEditDate,
    onShare,
    onHealThumbnails,
    buckets,
    onMoveToBucket,
    onCreateBucket,
    onPromoteToVortex,
    onAssignTensor,
    className
}) => {
    const [showBucketMenu, setShowBucketMenu] = React.useState(false);
    const [isMinimized, setIsMinimized] = React.useState(false);
    const bucketMenuRef = React.useRef<HTMLDivElement>(null);
    const barRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (bucketMenuRef.current && !bucketMenuRef.current.contains(event.target as Node)) {
                setShowBucketMenu(false);
            }
            if (barRef.current && !barRef.current.contains(event.target as Node)) {
                setIsMinimized(true);
            }
        };
        const timeout = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);
        return () => {
            clearTimeout(timeout);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Only maximize the bar when making the first selection
    const prevCountRef = React.useRef(0);
    React.useEffect(() => {
        if (selectedCount > 0 && prevCountRef.current === 0) {
            setIsMinimized(false);
        } else if (selectedCount === 0) {
            setIsMinimized(false);
            setShowBucketMenu(false);
        }
        prevCountRef.current = selectedCount;
    }, [selectedCount]);

    if (selectedCount === 0) return null;

    // [ZEN FIX] Use passed className or default to fixed bottom-24 above the Muses dock
    const containerClass = className || "fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] pb-6";

    return (
        <div className={`${containerClass} pointer-events-none flex justify-center`} ref={barRef}>
            {isMinimized ? (
                <div 
                    onClick={() => setIsMinimized(false)}
                    className="pointer-events-auto bg-[#1a1d26]/90 hover:bg-[#1a1d26] backdrop-blur-xl border border-cyan-500/30 rounded-full shadow-[0_0_30px_rgba(6,182,212,0.3)] px-4 py-2 flex items-center gap-3 cursor-pointer animate-in slide-in-from-bottom-5 duration-300 hover:scale-105 transition-all"
                >
                    <span className="bg-cyan-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                        {selectedCount}
                    </span>
                    <span className="text-cyan-400 font-bold text-xs uppercase tracking-widest">
                        Actions Ready
                    </span>
                    <ChevronUp size={16} className="text-cyan-500" />
                </div>
            ) : (
                <div className="pointer-events-auto bg-[#1a1d26]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 flex items-center gap-2 flex-wrap justify-center animate-in slide-in-from-bottom-5 duration-300">

                <div 
                    onClick={() => setIsMinimized(true)}
                    className="px-3 py-2 bg-violet-600/20 border border-violet-500/30 rounded-xl text-violet-300 text-xs font-bold flex items-center gap-2 mr-2 cursor-pointer hover:bg-violet-600/40 transition-colors"
                    title="Minimize Actions Ribbon"
                >
                    <span className="bg-violet-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{selectedCount}</span>
                    <span>Selected</span>
                </div>

                {onAlias && (
                    <GlassButton onClick={onAlias} variant="primary" className="text-xs">
                        <LinkIcon size={14} /> Add Tag
                    </GlassButton>
                )}

                {onUnlink && (
                    <GlassButton onClick={onUnlink} variant="secondary" className="text-xs text-amber-400 hover:text-amber-300">
                        <X size={14} /> Remove Tag
                    </GlassButton>
                )}

                {onPromoteToVortex && (
                    <GlassButton onClick={onPromoteToVortex} variant="primary" className="text-xs text-fuchsia-400 hover:text-fuchsia-300">
                        <Layers size={14} /> Promote to Vortex
                    </GlassButton>
                )}

                {/* [ZEN] EmoDB Tensor Triage Action */}
                {onAssignTensor && (
                    <GlassButton onClick={onAssignTensor} variant="primary" className="text-xs text-indigo-400 hover:text-indigo-300 border-indigo-500/30">
                        <Brain size={14} /> Assign Tensor
                    </GlassButton>
                )}

                {onEditDate && (
                    <GlassButton onClick={onEditDate} variant="primary" className="text-xs text-cyan-400 hover:text-cyan-300">
                        <Archive size={14} /> Edit Date
                    </GlassButton>
                )}

                {onDeepDive && (
                    <GlassButton onClick={onDeepDive} variant="secondary" className="text-xs text-indigo-400">
                        <Brain size={14} /> Deep Dive
                    </GlassButton>
                )}

                {onShare && (
                    <GlassButton onClick={onShare} variant="secondary" className="text-xs text-cyan-400">
                        <Share2 size={14} /> Share
                    </GlassButton>
                )}

                {onHealThumbnails && (
                    <GlassButton onClick={onHealThumbnails} variant="secondary" className="text-xs text-fuchsia-400 hover:text-fuchsia-300">
                        <Wand2 size={14} /> Heal Thumbs
                    </GlassButton>
                )}

                {onPDF && (
                    <GlassButton onClick={onPDF} variant="secondary" className="text-xs">
                        <FileText size={14} /> PDF
                    </GlassButton>
                )}

                {onPrint && (
                    <GlassButton onClick={onPrint} variant="secondary" className="text-xs">
                        <Printer size={14} /> Print
                    </GlassButton>
                )}

                {onExportTxt && (
                    <GlassButton onClick={onExportTxt} variant="secondary" className="text-xs">
                        <FileText size={14} /> Export TXT
                    </GlassButton>
                )}

                {onMarkRead && (
                    <GlassButton onClick={onMarkRead} variant="secondary" className="text-xs text-emerald-400">
                        <Archive size={14} /> Mark Read
                    </GlassButton>
                )}

                {onMarkUnread && (
                    <GlassButton onClick={onMarkUnread} variant="secondary" className="text-xs text-blue-400">
                        <Inbox size={14} /> Mark Unread
                    </GlassButton>
                )}

                {onMoveToBucket && buckets && (
                    <div className="relative" ref={bucketMenuRef}>
                        <GlassButton 
                            onClick={() => setShowBucketMenu(!showBucketMenu)}
                            variant="secondary" 
                            className={`text-xs text-cyan-400 border-cyan-500/30 ${showBucketMenu ? 'bg-cyan-500/10' : ''}`}
                        >
                            <Shield size={14} /> Move to Silo
                        </GlassButton>
                        {showBucketMenu && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col gap-1 p-2 bg-[#0f1219] border border-white/10 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-xl min-w-[160px] animate-in slide-in-from-bottom-2 z-50">
                                <button
                                    onClick={() => { onMoveToBucket(null); setShowBucketMenu(false); }}
                                    className="px-3 py-2 text-left rounded-lg text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    Global Matrix
                                </button>
                                <div className="h-px w-full bg-white/10 my-1" />
                                {buckets.map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => { onMoveToBucket(b.id); setShowBucketMenu(false); }}
                                        className="px-3 py-2 text-left rounded-lg text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        {b.name}
                                    </button>
                                ))}
                                {onCreateBucket && (
                                    <>
                                        <div className="h-px w-full bg-white/10 my-1" />
                                        <button
                                            onClick={() => { onCreateBucket(); setShowBucketMenu(false); }}
                                            className="px-3 py-2 text-left rounded-lg text-xs font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all flex items-center gap-2"
                                        >
                                            <Shield size={12} /> + New Silo
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {onDelete && (
                    <>
                        <div className="w-px h-6 bg-white/10 mx-1"></div>
                        <GlassButton onClick={onDelete} variant="danger" className="text-xs">
                            <Trash2 size={14} /> Delete
                        </GlassButton>
                    </>
                )}

                <div className="w-px h-6 bg-white/10 mx-1"></div>

                <GlassButton onClick={onClearSelection} variant="ghost" className="text-xs text-slate-400 hover:text-white">
                    Cancel
                </GlassButton>
            </div>
            )}
        </div>
    );
};

export default SelectionActionsBar;