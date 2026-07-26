import React from 'react';
import { Printer, FileText, Trash2, Archive, Inbox, Brain, Link as LinkIcon, X } from 'lucide-react';
import { GlassButton } from './GlassButton';

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
    className
}) => {
    if (selectedCount === 0) return null;

    // [ZEN FIX] Use passed className or default to fixed bottom-0
    const containerClass = className || "fixed bottom-0 left-0 right-0 z-[100] pb-6";

    return (
        <div className={`${containerClass} animate-in slide-in-from-bottom-5 duration-300 pointer-events-none flex justify-center`}>
            <div className="pointer-events-auto bg-[#1a1d26]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 flex items-center gap-2 flex-wrap justify-center">
                
                <div className="px-3 py-2 bg-violet-600/20 border border-violet-500/30 rounded-xl text-violet-300 text-xs font-bold flex items-center gap-2 mr-2">
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
                
                {onDeepDive && (
                    <GlassButton onClick={onDeepDive} variant="secondary" className="text-xs text-indigo-400">
                        <Brain size={14} /> Deep Dive
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
        </div>
    );
};

export default SelectionActionsBar;