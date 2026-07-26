import React, { useRef, useEffect } from 'react';
import { CheckSquare, Square, RefreshCw, CheckCircle, Trash2, SkipForward, ArrowRight, ThumbsUp } from 'lucide-react';
import { Patient } from './types';

interface ChronoListProps {
    patients: Patient[];
    selectedIds: Set<string>;
    reviewIndex: number;
    fixedCount: number;
    deletedCount: number;
    onSelect: (index: number) => void;
    onToggleSelect: (id: string, state: boolean) => void;
    onSelectAll: () => void;
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    safeDateStr: (val: any) => string;
}

export const ChronoList: React.FC<ChronoListProps> = ({
    patients, selectedIds, reviewIndex, fixedCount, deletedCount,
    onSelect, onToggleSelect, onSelectAll, setSelectedIds, safeDateStr
}) => {
    // Drag-Select State (Local UI interaction)
    const isDraggingRef = useRef(false);
    const dragModeRef = useRef(true);

    useEffect(() => {
        const handleGlobalMouseUp = () => { isDraggingRef.current = false; };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    const handleMouseDown = (id: string, currentChecked: boolean) => {
        isDraggingRef.current = true;
        dragModeRef.current = !currentChecked;
        onToggleSelect(id, dragModeRef.current);
    };

    const handleMouseEnter = (id: string) => {
        if (isDraggingRef.current) {
            onToggleSelect(id, dragModeRef.current);
        }
    };

    if (patients.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <RefreshCw size={48} className="mb-4 opacity-20" />
                <p className="font-mono text-sm uppercase tracking-widest">System Ready.</p>
            </div>
        );
    }

    return (
        <>
            <div className="p-3 bg-slate-900 border-b border-white/5 text-xs font-bold text-slate-500 flex justify-between items-center">
                <div className="flex items-center gap-2 cursor-pointer hover:text-white select-none" onClick={onSelectAll}>
                    {selectedIds.size === patients.length && patients.length > 0 ? <CheckSquare size={14}/> : <Square size={14}/>}
                    <span>QUEUE ({patients.length})</span>
                </div>
                <div className="flex gap-2">
                    <span className="text-emerald-400">Fixed: {fixedCount}</span>
                    <span className="text-red-400">Del: {deletedCount}</span>
                </div>
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar pb-24 select-none">
                {patients.map((p, idx) => (
                    <div 
                        key={p.id} 
                        onClick={() => p.status !== 'fixed' && p.status !== 'deleted' && onSelect(idx)}
                        className={`p-2 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors flex items-center ${reviewIndex === idx ? 'bg-cyan-900/20 border-l-2 border-l-cyan-400' : ''} ${p.status === 'fixed' || p.status === 'deleted' || p.status === 'verified' ? 'opacity-40 grayscale' : ''}`}
                    >
                        {/* COL 1: THUMBNAIL */}
                        <div className="w-12 h-12 bg-black rounded-lg overflow-hidden shrink-0 border border-white/10 mr-3 relative">
                            <img src={p.url} className="w-full h-full object-cover" alt="" loading="lazy" />
                        </div>

                        {/* COL 2: DATA */}
                        <div className="flex-1 min-w-0">
                            <div className="text-slate-300 text-xs font-medium truncate" title={p.originalName}>
                                {p.originalName}
                            </div>
                            <div className="text-[10px] font-mono mt-1 flex gap-2 items-center">
                                <span className="text-red-400/80">{safeDateStr(p.currentDate).substring(0, 10)}</span>
                                <ArrowRight size={10} className="text-slate-600"/>
                                <span className={p.proposedDate ? "text-emerald-400" : "text-slate-600"}>
                                    {p.proposedDate?.substring(0, 10) || '???'}
                                </span>
                            </div>
                        </div>

                        {/* COL 3: CHECKBOX */}
                        <div className="pl-2 pr-2 h-12 flex items-center justify-center min-w-[40px] cursor-ns-resize"
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); handleMouseDown(p.id, selectedIds.has(p.id)); }}
                                onMouseEnter={() => handleMouseEnter(p.id)}
                        >
                            {(p.status === 'pending' || p.status === 'unfixable') && (
                                <div className={`w-4 h-4 rounded border transition-colors ${selectedIds.has(p.id) ? 'bg-cyan-500 border-cyan-500' : 'bg-slate-800 border-slate-600'}`}>
                                    {selectedIds.has(p.id) && <CheckSquare size={16} className="text-black -ml-0.5 -mt-0.5" strokeWidth={3}/>}
                                </div>
                            )}
                            {(p.status === 'fixed') && <CheckCircle size={16} className="text-emerald-500" />}
                            {(p.status === 'verified') && <ThumbsUp size={16} className="text-blue-500" />}
                            {(p.status === 'deleted') && <Trash2 size={16} className="text-red-500" />}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};