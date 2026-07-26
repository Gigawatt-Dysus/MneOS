import React, { useState, useEffect, useRef } from 'react';
import { CheckCircleIcon, PaperclipIcon, BrainIcon, PencilIcon, EllipsisVerticalIcon, CopyIcon, DownloadIcon, TrashIcon, XIcon } from '../icons';
import type { GigiJournalEntry, User, LifeEvent } from '../../types';
import { JournalEntry } from './JournalEntry';
import { appDataService } from '../../services/serviceManager';

// Inlined Helpers
const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
};
const formatJournalDate = (date: Date | string) => {
    try {
        const d = new Date(date);
        if (!d || isNaN(d.getTime())) return "Invalid Date";
        const day = d.getDate();
        const year = d.getFullYear();
        return `${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(d)} ${day}${getOrdinalSuffix(day)}, ${year}`;
    } catch (e) { return "Invalid Date"; }
};
const extractContextDates = (text: string) => {
    const dateMatch = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+(19|20)\d{2}\b/i);
    if (dateMatch) { const d = new Date(dateMatch[0]); if (!isNaN(d.getTime())) return { specificDate: d }; }
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) return { year: parseInt(yearMatch[0]) };
    return {};
};

interface JournalDetailViewProps {
    entry: GigiJournalEntry;
    user: User;
    events: LifeEvent[];
    onClose: () => void;
    onAddComment: (entryId: string, commentText: string) => void;
    onUpdateEntry: (entry: GigiJournalEntry) => void;
    onUpdateEvent: (event: LifeEvent) => void;
    onDelete?: (id: string) => void; 
}

const JournalDetailView: React.FC<JournalDetailViewProps> = ({ entry, user, events, onClose, onAddComment, onUpdateEntry, onUpdateEvent, onDelete }) => {
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [isAttaching, setIsAttaching] = useState(false);
    const [filteredEvents, setFilteredEvents] = useState<LifeEvent[]>([]);
    const [filterReason, setFilterReason] = useState<string>('');
    const [suggestedEvent, setSuggestedEvent] = useState<LifeEvent | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(entry.title);
    const [editContent, setEditContent] = useState(entry.content);
    const [showMenu, setShowMenu] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    useEffect(() => {
        if (entry.relatedEventId) {
            const linked = events.find(e => e.id === entry.relatedEventId);
            if (linked) { setFilteredEvents([linked]); setSelectedEventId(linked.id); setSuggestedEvent(linked); setFilterReason("Explicitly linked."); return; }
        }
        const context = extractContextDates(entry.content + " " + entry.title);
        if (context.specificDate) {
            const target = context.specificDate.getTime();
            const matches = events.filter(e => Math.abs(e.date.getTime() - target) < 604800000); // 7 days
            setFilteredEvents(matches);
            setFilterReason(`Found date "${context.specificDate.toLocaleDateString()}".`);
            if (matches.length === 1) { setSuggestedEvent(matches[0]); setSelectedEventId(matches[0].id); }
        } else {
            setFilteredEvents([...events].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 20));
            setFilterReason("Recent events.");
        }
    }, [entry, events]);

    const handleAttach = (isPrivate: boolean) => {
        if (!selectedEventId) return alert("Select an event.");
        const event = events.find(e => e.id === selectedEventId);
        if (!event) return;
        setIsAttaching(true);
        const note = `\n\n[Journal: ${entry.title} - ${new Date().toLocaleDateString()}]\n${entry.content}`;
        onUpdateEvent({ ...event, privateDetails: (event.privateDetails || '') + note, isPrivateDetailsCloaked: isPrivate });
        onUpdateEntry({ ...entry, read: true, isAttached: true });
        setTimeout(() => { setIsAttaching(false); onClose(); }, 500);
    };

    const handleDelete = async () => {
        if (!confirm("Delete this journal entry permanently?")) return;
        setIsDeleting(true);
        try {
            await appDataService.deleteGigiJournalEntry(user.id, entry.id);
            if (onDelete) onDelete(entry.id);
            onClose();
        } catch (e) {
            console.error(e);
            alert("Delete failed.");
            setIsDeleting(false);
        }
    };

    const handleSaveEdit = () => { onUpdateEntry({ ...entry, title: editTitle, content: editContent }); setIsEditing(false); };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
            {/* Glass Capsule Container */}
            <div 
                className="glass-capsule bg-[#1a1d21]/90 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-white/10" 
                onClick={e => e.stopPropagation()}
            >
                 {/* Header */}
                 <div className="flex-shrink-0 p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                    <div className="flex-grow mr-4">
                        {isEditing ? (
                            <input 
                                type="text" 
                                value={editTitle} 
                                onChange={e => setEditTitle(e.target.value)} 
                                className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-xl font-bold text-white focus:ring-2 focus:ring-violet-500 focus:outline-none placeholder-gray-500"
                                placeholder="Entry Title"
                            />
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <h2 className="text-xl font-bold text-white tracking-wide truncate pr-4 drop-shadow-md">{entry.title}</h2>
                                    {entry.type === 'deep_dive' && <span className="text-[10px] bg-cyan-900/50 border border-cyan-500/30 px-2 py-0.5 rounded text-cyan-300 font-mono tracking-widest uppercase shadow-[0_0_10px_rgba(6,182,212,0.2)]">RESEARCH</span>}
                                    {/* [ZEN FIX] Wrapped Icon in div to support title prop */}
                                    {entry.isAttached && (
                                        <div title="Attached to Event" className="flex items-center justify-center">
                                            <PaperclipIcon className="w-4 h-4 text-cyan-400" />
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 font-mono mt-1">{formatJournalDate(entry.creationDate)}</p>
                            </>
                        )}
                    </div>
                    
                    {/* Controls */}
                    <div className="flex items-center gap-2 relative">
                        {isEditing ? (
                            <>
                                <button onClick={handleSaveEdit} className="p-2 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors border border-green-500/30" title="Save Changes"><CheckCircleIcon className="w-5 h-5" /></button>
                                <button onClick={() => setIsEditing(false)} className="p-2 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors border border-red-500/30 font-bold" title="Cancel"><XIcon className="w-5 h-5" /></button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setIsEditing(true)} className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Edit"><PencilIcon className="w-5 h-5" /></button>
                                <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors"><EllipsisVerticalIcon className="w-5 h-5" /></button>
                                
                                {showMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-48 glass-capsule bg-[#1e2124] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <button onClick={() => { navigator.clipboard.writeText(entry.content); setShowMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-white/5 text-gray-200 flex items-center gap-3 text-sm">
                                            <CopyIcon className="w-4 h-4 text-cyan-400" /> Copy Text
                                        </button>
                                        <div className="h-px bg-white/5 mx-2"></div>
                                        <button onClick={handleDelete} disabled={isDeleting} className="w-full text-left px-4 py-3 hover:bg-red-500/20 text-red-400 flex items-center gap-3 text-sm transition-colors">
                                            <TrashIcon className="w-4 h-4" /> {isDeleting ? "Deleting..." : "Delete Entry"}
                                        </button>
                                    </div>
                                )}
                                <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors ml-1"><XIcon className="w-6 h-6" /></button>
                            </>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-grow overflow-y-auto custom-scrollbar bg-transparent">
                    {isEditing ? (
                        <div className="p-6 h-full">
                            <textarea 
                                value={editContent} 
                                onChange={e => setEditContent(e.target.value)} 
                                className="w-full h-full min-h-[400px] bg-transparent border-none resize-none text-gray-200 font-serif text-lg focus:ring-0 leading-relaxed placeholder-gray-600"
                                placeholder="Write your thoughts..."
                            />
                        </div>
                    ) : (
                        <JournalEntry 
                            entry={entry} 
                            user={user} 
                            isConversation={entry.type === 'conversation'} 
                            onAddComment={onAddComment} 
                            onUpdateEntry={onUpdateEntry} 
                            isModalView={true} 
                            onDelete={onDelete}
                        />
                    )}
                    
                    {/* Archive Integration Panel (HUD Style) */}
                    {!isEditing && (
                        <div className="p-6 border-t border-white/10 bg-black/20">
                            <h3 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-2 font-orbitron tracking-wider">
                                <BrainIcon className="w-4 h-4" /> ARCHIVE INTEGRATION
                            </h3>
                            
                            {suggestedEvent ? (
                                <div className="p-4 bg-green-900/10 border border-green-500/30 rounded-xl relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                    <p className="text-sm text-green-300 mb-3 flex items-center gap-2">
                                        <CheckCircleIcon className="w-4 h-4" />
                                        Match Found: <strong className="text-white">{suggestedEvent.title}</strong>
                                    </p>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => handleAttach(true)} 
                                            className="px-4 py-2 bg-green-600/80 hover:bg-green-600 text-white text-sm font-bold rounded-lg shadow-lg shadow-green-900/50 transition-all border border-green-400/50"
                                        >
                                            Link (Private)
                                        </button>
                                        <button onClick={() => setSuggestedEvent(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:underline">Change Event</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-3 items-end">
                                    <div className="flex-grow w-full">
                                        <label className="block text-xs text-gray-500 mb-1 font-mono">LINK TO EVENT</label>
                                        <select 
                                            value={selectedEventId} 
                                            onChange={e => setSelectedEventId(e.target.value)} 
                                            className="w-full p-2.5 text-sm bg-black/40 border border-white/10 rounded-lg text-gray-300 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-colors"
                                        >
                                            <option value="">-- Select Event --</option>
                                            {filteredEvents.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleAttach(true)} 
                                            disabled={!selectedEventId} 
                                            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg border border-white/5 transition-all"
                                        >
                                            Private
                                        </button>
                                        <button 
                                            onClick={() => handleAttach(false)} 
                                            disabled={!selectedEventId} 
                                            className="px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow-lg shadow-violet-900/30 transition-all border border-violet-400/30"
                                        >
                                            Public
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JournalDetailView;