import React, { useState, useEffect } from 'react';
import type { GigiJournalEntry } from '@/types';
import { PaperclipIcon } from '../icons';
import JournalTile from '../JournalTile';

const formatShortDate = (date: Date | string) => {
    const d = new Date(date);
    if (!d || isNaN(d.getTime())) return "Invalid";
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' }).format(d);
};

interface JournalListViewProps {
    entries: GigiJournalEntry[];
    viewMode: 'list' | 'tiles' | 'detail-list';
    onSelectEntry: (entry: GigiJournalEntry) => void;
    selectionMode: boolean; // Kept in interface for parent compatibility
    selectedIds: Set<string>;
    onToggleSelection: (id: string) => void;
    primaryCompanionName?: string; // Optional prop to match usage in parent
}

const JournalListView: React.FC<JournalListViewProps> = ({ entries, viewMode, onSelectEntry, selectedIds, onToggleSelection }) => {
    const [isDragging, setIsDragging] = useState(false);

    // Global listener to stop dragging if mouse goes up outside
    useEffect(() => {
        const stopDrag = () => setIsDragging(false);
        window.addEventListener('mouseup', stopDrag);
        return () => window.removeEventListener('mouseup', stopDrag);
    }, []);

    if (viewMode === 'detail-list') {
        return (
            <div className="glass-capsule rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl border border-white/10 animate-in fade-in zoom-in-95 duration-300" onMouseLeave={() => setIsDragging(false)}>
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 bg-black/20 text-xs font-bold uppercase text-cyan-400 tracking-widest font-orbitron">
                    <div className="col-span-1 text-center">Select</div>
                    <div className="col-span-3">Date</div>
                    <div className="col-span-4">Title</div>
                    <div className="col-span-4">Brief</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-white/5">
                    {entries.map(entry => {
                        const isRead = entry.read === true;
                        const isSelected = selectedIds.has(entry.id);

                        const textColor = isRead ? 'text-gray-400 font-medium' : 'text-white font-bold text-glow';
                        const rowBg = isSelected
                            ? 'bg-violet-500/20 border-l-2 border-violet-500'
                            : !isRead
                                ? 'bg-white/5'
                                : 'hover:bg-white/5';

                        return (
                            <div
                                key={entry.id}
                                className={`grid grid-cols-12 gap-4 p-4 cursor-pointer transition-all duration-200 group relative ${rowBg}`}
                                onClick={() => {
                                    // If we are already selecting, click toggles selection
                                    // If not, click opens entry (unless we click the checkbox explicitly)
                                    if (selectedIds.size > 0) {
                                        onToggleSelection(entry.id);
                                    } else {
                                        onSelectEntry(entry);
                                    }
                                }}
                            >
                                {/* Checkbox / Drag Area */}
                                <div
                                    className="col-span-1 flex justify-center items-center z-10"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setIsDragging(true);
                                        onToggleSelection(entry.id);
                                    }}
                                    onMouseEnter={() => {
                                        if (isDragging) {
                                            onToggleSelection(entry.id);
                                        }
                                    }}
                                    onMouseUp={() => setIsDragging(false)}
                                >
                                    <div className={`
                                        w-5 h-5 rounded border flex items-center justify-center transition-all duration-200
                                        ${isSelected ? 'bg-violet-500 border-violet-500 scale-100' : 'border-gray-500 bg-black/40 scale-90 opacity-0 group-hover:opacity-100'}
                                    `}>
                                        {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                                    </div>

                                    {!isSelected && entry.isAttached && (
                                        <div className="absolute opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
                                            <PaperclipIcon className="w-4 h-4 text-cyan-500" />
                                        </div>
                                    )}
                                </div>

                                <div className={`col-span-3 text-sm ${isRead ? 'text-gray-500' : 'text-cyan-200'}`}>
                                    {formatShortDate(entry.creationDate)}
                                </div>

                                <div className={`col-span-4 truncate ${textColor} flex items-center gap-2`}>
                                    {!isRead && <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>}
                                    {entry.title}
                                </div>

                                <div className="col-span-4 text-sm text-gray-500 truncate italic font-light">
                                    {entry.type === 'deep_dive' ? 'Research Report' :
                                        entry.type === 'daydream' ? 'AI Daydream' : 'Reflection'}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (viewMode === 'tiles') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {entries.map(entry => (
                    <JournalTile key={entry.id} entry={entry} isSelected={selectedIds.has(entry.id)} onClick={() => onSelectEntry(entry)} />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {entries.map(entry => (
                <div
                    key={entry.id}
                    onClick={() => onSelectEntry(entry)}
                    className="p-5 glass-capsule rounded-xl cursor-pointer hover:scale-[1.01] transition-transform border border-white/10 group"
                >
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-white group-hover:text-cyan-300 transition-colors">{entry.title}</h3>
                        <span className="text-xs text-gray-500 font-mono">{formatShortDate(entry.creationDate)}</span>
                    </div>
                    <p className="text-gray-300 line-clamp-2 leading-relaxed opacity-80">{entry.content}</p>
                </div>
            ))}
        </div>
    );
};

export default JournalListView;