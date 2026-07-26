import React from 'react';
import { Loader2, Check, Save, Trash2, Link as LinkIcon, X, FileText, Brain } from 'lucide-react';
import { GlassButton } from '../GlassButton';
import { GigiCoreIcon } from '../icons/GigiCoreIcon';
import type { Tag } from '../../types';

interface TagEditorFooterProps {
    tag: Tag;
    aiName: string;
    saveState: 'idle' | 'saving' | 'saved';
    isDirty: boolean;
    
    // Selection Props
    selectedCount: number;
    onClearSelection: () => void;
    
    // Standard Handlers
    onDiscuss: (tag: Tag) => void;
    onCancel: () => void;
    onSave: () => void;

    // Batch Handlers
    onBatchDelete?: () => void;
    onBatchUnlink?: () => void;
    onBatchAlias?: () => void;
    onPDF?: () => void;
}

export const TagEditorFooter: React.FC<TagEditorFooterProps> = ({ 
    tag, 
    aiName, 
    saveState, 
    isDirty, 
    selectedCount,
    onClearSelection,
    onDiscuss, 
    onCancel, 
    onSave,
    onBatchDelete,
    onBatchUnlink,
    onBatchAlias,
    onPDF
}) => {
    
    // MODE 1: SELECTION ACTIVE (The "Gallery Actions" View)
    if (selectedCount > 0) {
        return (
            <div className="p-4 border-t border-white/5 bg-[#13161f] flex justify-between items-center animate-in slide-in-from-bottom-2 fade-in duration-200">
                
                {/* Left: Indicator */}
                <div className="flex items-center gap-4">
                    <div className="px-3 py-1.5 bg-violet-500/20 border border-violet-500/50 rounded-lg text-violet-300 text-xs font-bold flex items-center gap-2">
                        <span className="bg-violet-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{selectedCount}</span>
                        <span>Selected</span>
                    </div>
                    
                    <div className="h-6 w-px bg-white/10"></div>

                    {/* Batch Actions */}
                    <div className="flex gap-2">
                        {onBatchAlias && (
                            <GlassButton onClick={onBatchAlias} variant="primary" className="text-xs h-9">
                                <LinkIcon size={14} /> Link Tag
                            </GlassButton>
                        )}
                        {onBatchUnlink && (
                            <GlassButton onClick={onBatchUnlink} variant="secondary" className="text-xs h-9 text-amber-400 hover:text-amber-300">
                                <X size={14} /> Unlink
                            </GlassButton>
                        )}
                        {onPDF && (
                            <GlassButton onClick={onPDF} variant="secondary" className="text-xs h-9">
                                <FileText size={14} /> PDF
                            </GlassButton>
                        )}
                        {onBatchDelete && (
                            <GlassButton onClick={onBatchDelete} variant="danger" className="text-xs h-9">
                                <Trash2 size={14} /> Delete
                            </GlassButton>
                        )}
                    </div>
                </div>

                {/* Right: Exit Selection Mode */}
                <GlassButton onClick={onClearSelection} variant="ghost" className="text-slate-400 hover:text-white text-xs">
                    Done Selecting
                </GlassButton>
            </div>
        );
    }

    // MODE 2: STANDARD FOOTER
    return (
        <div className="p-4 md:p-6 border-t border-white/5 bg-[#13161f] flex justify-between items-center">
            <GlassButton onClick={() => onDiscuss(tag)} variant="secondary" className="group">
                <GigiCoreIcon className="w-5 h-5 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] group-hover:scale-110 transition-transform" />
                <span className="group-hover:text-cyan-400">Ask {aiName}</span>
            </GlassButton>
            
            <div className="flex gap-2 md:gap-4">
                <GlassButton onClick={onCancel} variant="ghost" className="text-slate-400 hover:text-white px-4 md:px-6">Cancel</GlassButton>
                <GlassButton 
                    onClick={onSave} 
                    disabled={saveState === 'saving'} 
                    variant={!isDirty && saveState !== 'saving' ? 'success' : 'primary'} 
                    className="shadow-lg min-w-[100px] md:min-w-[140px] px-4 md:px-6"
                >
                    {saveState === 'saving' ? (
                        <><Loader2 className="animate-spin" size={18} /> Saving...</>
                    ) : !isDirty ? (
                        <><Save size={18} /> Save</>
                    ) : (
                        <><Save size={18} /> Save & Close</>
                    )}
                </GlassButton>
            </div>
        </div>
    );
};