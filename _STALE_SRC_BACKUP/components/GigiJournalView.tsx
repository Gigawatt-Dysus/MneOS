import React, { useState, useMemo } from 'react';
import { jsPDF } from "jspdf";
import type { GigiJournalEntry, User, LifeEvent } from '@/types';
import { SortIcon, InboxIcon, ArchiveBoxIcon, ViewColumnsIcon, Squares2X2Icon, DocumentTextIcon, BrainIcon, DownloadIcon } from './icons';
import SelectionActionsBar from './SelectionActionsBar';
import JournalListView from './journal/JournalListView';
import JournalDetailView from './journal/JournalDetailView';
import { DEFAULT_EMOJIS } from '@/types';
import { backfillEventDescriptions } from '../services/dataRepair';

export const EMOJIS_FOR_PICKER = DEFAULT_EMOJIS;

interface GigiJournalViewProps {
    journal: GigiJournalEntry[];
    user: User;
    events: LifeEvent[];
    onAddComment: (entryId: string, commentText: string) => void;
    onUpdateEntry: (entry: GigiJournalEntry) => void;
    onUpdateEvent: (event: LifeEvent) => void;
    onDeleteEntry?: (entryId: string) => void;
    addToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

type JournalTab = 'journals' | 'deep_dive' | 'discussions';
type Folder = 'inbox' | 'read';

const GigiJournalView: React.FC<GigiJournalViewProps> = ({ journal, user, events, onAddComment, onUpdateEntry, onUpdateEvent, onDeleteEntry, addToast }) => {
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [viewMode, setViewMode] = useState<'list' | 'tiles' | 'detail-list'>('detail-list');
    const [activeTab, setActiveTab] = useState<JournalTab>('journals');
    const [activeFolder, setActiveFolder] = useState<Folder>('inbox');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [viewingEntryId, setViewingEntryId] = useState<string | null>(null);
    const [isRepairing, setIsRepairing] = useState(false);

    const aiName = user.aiCompanions[0]?.name || 'Gigi';
    const viewingEntry = useMemo(() => journal.find(e => e.id === viewingEntryId) || null, [journal, viewingEntryId]);

    const filteredJournal = useMemo(() => {
        let subset = journal.filter(e => activeFolder === 'inbox' ? !e.read : e.read);
        if (activeTab === 'discussions') return subset.filter(e => e.type === 'conversation');
        if (activeTab === 'deep_dive') return subset.filter(e => e.type === 'deep_dive');
        return subset.filter(e => !e.type || e.type === 'reflection');
    }, [journal, activeTab, activeFolder]);

    const sortedJournal = useMemo(() =>
        [...filteredJournal].sort((a, b) => {
            const tA = new Date(a.creationDate || 0).getTime();
            const tB = new Date(b.creationDate || 0).getTime();
            return sortOrder === 'desc' ? tB - tA : tA - tB;
        }),
        [filteredJournal, sortOrder]);

    const handleToggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const handleDeleteBatch = () => {
        if (!onDeleteEntry) return;
        if (confirm(`Are you sure you want to delete ${selectedIds.size} entries? This cannot be undone.`)) {
            selectedIds.forEach(id => onDeleteEntry(id));
            setSelectedIds(new Set());
            setSelectionMode(false);
        }
    };

    const handleEmergencyBackup = () => {
        const dataStr = JSON.stringify(events, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `GIGI-EVENTS-BACKUP-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (addToast) addToast(`Backup saved: ${a.download}`, 'success');
    };

    const handleRunRepair = async () => {
        if (confirm("⚠️ SAFETY CHECK: Have you backed up your data? This script will modify your database.\n\nClick OK to proceed with the Description Backfill.")) {
            setIsRepairing(true);
            await backfillEventDescriptions(user, events);
            setIsRepairing(false);
            if (addToast) addToast("Repair Complete. Check console for details.", 'success');
        }
    };

    const handleExportTxt = () => {
        const selected = sortedJournal.filter(j => selectedIds.has(j.id));
        if (selected.length === 0) return;

        let content = `JOURNAL EXPORT - ${new Date().toLocaleDateString()}\n\n`;
        selected.forEach(entry => {
            content += `==========================================\n`;
            content += `TITLE: ${entry.title}\n`;
            content += `DATE:  ${new Date(entry.creationDate).toLocaleString()}\n`;
            content += `------------------------------------------\n`;
            content += `${entry.content}\n\n`;
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gigi_journal_export_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // --- PDF GENERATOR ---
    const handleExportPdf = () => {
        const selected = sortedJournal.filter(j => selectedIds.has(j.id));
        if (selected.length === 0) return;

        if (addToast) addToast("Compiling formatted PDF...", "info");

        // CONFIGURATION
        const doc = new jsPDF({ unit: "mm", format: "a4" });
        const margin = 25.4; // 1 inch
        const pageWidth = doc.internal.pageSize.width; // 210mm
        const pageHeight = doc.internal.pageSize.height; // 297mm
        const contentWidth = pageWidth - (margin * 2);

        let cursorY = margin;

        // -- UTILS --
        const checkPageBreak = (neededHeight: number) => {
            if (cursorY + neededHeight > pageHeight - margin) {
                doc.addPage();
                cursorY = margin;
                return true;
            }
            return false;
        };

        // --- RENDER RICH TEXT (Bold/Italic Parser) ---
        const printRichText = (text: string, fontSize: number = 12) => {
            doc.setFont("times", "normal");
            doc.setFontSize(fontSize);
            const lineHeight = fontSize * 1.15 * 0.3527; // pt to mm

            const paragraphs = text.split('\n');

            paragraphs.forEach((paragraph) => {
                if (checkPageBreak(lineHeight)) cursorY = margin;

                // Regex to split by **bold** or *italic*
                // Captures delimiters to keep them in the array
                const tokens = paragraph.split(/(\*\*.*?\*\*|\*.*?\*)/g);

                let lineBuffer: { text: string, style: string, width: number }[] = [];
                let currentLineWidth = 0;

                const flushLine = () => {
                    let currentX = margin;
                    lineBuffer.forEach(chunk => {
                        doc.setFont("times", chunk.style);
                        doc.text(chunk.text, currentX, cursorY);
                        currentX += chunk.width;
                    });
                    cursorY += lineHeight;
                    if (checkPageBreak(lineHeight)) cursorY = margin;
                    lineBuffer = [];
                    currentLineWidth = 0;
                };

                tokens.forEach(token => {
                    let style = "normal";
                    let content = token;

                    if (token.startsWith('**') && token.endsWith('**')) {
                        style = "bold";
                        content = token.slice(2, -2);
                    } else if (token.startsWith('*') && token.endsWith('*')) {
                        style = "italic";
                        content = token.slice(1, -1);
                    }

                    if (!content) return;

                    // Set font to measure accurately
                    doc.setFont("times", style);

                    // Split into words to handle wrapping
                    const words = content.split(/(\s+)/); // Keep spaces

                    words.forEach(word => {
                        const wordWidth = doc.getTextWidth(word);

                        if (currentLineWidth + wordWidth > contentWidth) {
                            flushLine();
                            // If the word itself is wider than line (rare), we let it overflow or could clip
                            // But usually, we just start a new line.
                            // Trim leading space on new line
                            if (word.trim() === '') return;
                        }

                        lineBuffer.push({ text: word, style, width: wordWidth });
                        currentLineWidth += wordWidth;
                    });
                });

                // Flush remaining buffer for this paragraph
                if (lineBuffer.length > 0) flushLine();

                // Paragraph spacing
                cursorY += (lineHeight * 0.6);
            });
        };

        // --- PDF CONTENT CONSTRUCTION ---

        // Main Title
        doc.setFont("times", "bold");
        doc.setFontSize(24);
        const title = `${aiName}'s Journal Log`;
        const titleWidth = doc.getTextWidth(title);
        doc.text(title, (pageWidth - titleWidth) / 2, cursorY);
        cursorY += 15;

        // Separator
        doc.setLineWidth(0.5);
        doc.line(margin, cursorY, pageWidth - margin, cursorY);
        cursorY += 10;

        // Entries Loop
        selected.forEach((entry, index) => {
            // Check space for Header
            checkPageBreak(30);

            // Entry Title
            doc.setFont("times", "bold");
            doc.setFontSize(16);
            doc.text(entry.title, margin, cursorY);
            cursorY += 7;

            // Meta
            doc.setFont("times", "italic");
            doc.setFontSize(10);
            doc.setTextColor(80);
            const dateStr = new Date(entry.creationDate).toLocaleString();
            doc.text(`${dateStr} | ${entry.type || 'Reflection'}`, margin, cursorY);
            doc.setTextColor(0);
            cursorY += 8;

            // Content (Rich Text)
            printRichText(entry.content, 12);

            cursorY += 10; // Spacing after entry

            // Visual Separator (if not last)
            if (index < selected.length - 1) {
                if (!checkPageBreak(20)) {
                    doc.setDrawColor(200);
                    doc.setLineWidth(0.2);
                    doc.line(pageWidth / 2 - 20, cursorY, pageWidth / 2 + 20, cursorY); // Centered short line
                    doc.setDrawColor(0);
                    cursorY += 10;
                }
            }
        });

        // Open
        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank');

        if (addToast) addToast("PDF ready in new tab.", "success");
    };

    return (
        <div className="max-w-5xl mx-auto relative pb-24 px-4">
            {viewingEntry && (
                <JournalDetailView
                    entry={viewingEntry}
                    user={user}
                    events={events}
                    onClose={() => setViewingEntryId(null)}
                    onAddComment={onAddComment}
                    onUpdateEntry={onUpdateEntry}
                    onUpdateEvent={onUpdateEvent}
                    onDelete={onDeleteEntry}
                />
            )}

            <div className="relative text-center mb-8 pt-4">
                <h1 className="text-5xl md:text-6xl font-bold text-white font-tangerine text-glow drop-shadow-md">{aiName}'s Personal Log</h1>

                <div className="absolute right-0 top-4 flex gap-2">
                    <button
                        onClick={handleEmergencyBackup}
                        className="text-[10px] uppercase tracking-widest text-green-400 hover:text-green-300 transition-colors flex items-center gap-1 bg-green-900/30 border border-green-500/30 px-2 py-1 rounded"
                        title="Download raw JSON backup of events"
                    >
                        <DownloadIcon className="w-3 h-3" /> Backup
                    </button>

                    <button
                        onClick={handleRunRepair}
                        disabled={isRepairing}
                        className="text-[10px] uppercase tracking-widest text-yellow-500 hover:text-yellow-400 transition-colors flex items-center gap-1 bg-yellow-900/20 border border-yellow-500/30 px-2 py-1 rounded disabled:opacity-50"
                        title="Generate public descriptions for old events"
                    >
                        <BrainIcon className={`w-3 h-3 ${isRepairing ? 'animate-spin' : ''}`} />
                        {isRepairing ? 'Running...' : 'Repair'}
                    </button>
                </div>
            </div>

            <div className="flex flex-col items-center gap-6 mb-8">
                <div className="flex p-1 glass-capsule rounded-full">
                    <button onClick={() => setActiveFolder('inbox')} className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${activeFolder === 'inbox' ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/50' : 'text-gray-400 hover:text-white'}`}><InboxIcon className="w-4 h-4" /> Inbox</button>
                    <button onClick={() => setActiveFolder('read')} className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${activeFolder === 'read' ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}><ArchiveBoxIcon className="w-4 h-4" /> Read</button>
                </div>
                <div className="flex space-x-2 p-1 border-b border-white/10">
                    {[
                        { id: 'journals', label: 'Letters' },
                        { id: 'deep_dive', label: 'Research' },
                        { id: 'discussions', label: 'Discussions' }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as JournalTab)} className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${activeTab === tab.id ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{tab.label}</button>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-4 mb-6 glass-capsule p-2 rounded-2xl px-4">
                <button onClick={() => setSortOrder(p => p === 'desc' ? 'asc' : 'desc')} className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors"><SortIcon className="w-4 h-4" /> {sortOrder === 'desc' ? 'Newest' : 'Oldest'}</button>
                <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
                    <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}><ViewColumnsIcon className="w-5 h-5" /></button>
                    <button onClick={() => setViewMode('tiles')} className={`p-2 rounded-md transition-all ${viewMode === 'tiles' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}><Squares2X2Icon className="w-5 h-5" /></button>
                    <button onClick={() => setViewMode('detail-list')} className={`p-2 rounded-md transition-all ${viewMode === 'detail-list' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}><DocumentTextIcon className="w-5 h-5" /></button>
                </div>
                <div className="text-xs text-gray-500 font-mono px-2">{selectedIds.size > 0 ? `${selectedIds.size} Selected` : 'Select items...'}</div>
            </div>

            {selectedIds.size > 0 && (
                <SelectionActionsBar
                    selectedCount={selectedIds.size}
                    onClearSelection={() => setSelectedIds(new Set())}
                    onDelete={handleDeleteBatch}
                    onMarkRead={() => { selectedIds.forEach(id => onUpdateEntry({ ...journal.find(j => j.id === id)!, read: true })); setSelectedIds(new Set()); }}
                    onPrint={handleExportPdf}
                    onExportTxt={handleExportTxt}
                />
            )}

            {sortedJournal.length > 0 ? (
                <JournalListView
                    entries={sortedJournal}
                    viewMode={viewMode}
                    onSelectEntry={(e) => setViewingEntryId(e.id)}
                    primaryCompanionName={aiName}
                    selectionMode={selectionMode || selectedIds.size > 0}
                    selectedIds={selectedIds}
                    onToggleSelection={handleToggleSelection}
                />
            ) : (
                <div className="text-center py-20 px-6 glass-capsule rounded-3xl mx-auto max-w-lg mt-10">
                    <h3 className="text-2xl font-bold text-gray-300 font-orbitron">No Transmissions Found</h3>
                    <p className="text-gray-500 mt-2">The archives are silent for this frequency.</p>
                </div>
            )}
        </div>
    );
};

export default GigiJournalView;