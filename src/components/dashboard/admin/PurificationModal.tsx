import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  ShieldAlert, 
  ArrowUpDown, 
  Trash, 
  Eye, 
  Undo, 
  Save, 
  Info, 
  RefreshCw, 
  AlertTriangle, 
  ArrowRightLeft, 
  Share2, 
  Layers 
} from 'lucide-react';
import { GlassButton } from '../../GlassButton';

interface PurificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

interface RawRecord {
    _id: string;
    id?: string;
    timestamp?: { _seconds?: number; seconds?: number } | any;
    role?: string;
    content?: string;
    author?: { id?: string } | any;
    fiction?: boolean;
    search_metadata?: { is_fiction?: boolean };
    companionId?: string | null;
    is_fiction?: boolean;
    // Event specific fields
    title?: string;
    details?: string;
    description?: string;
    location?: { addressLocality?: string; streetAddress?: string; coordinates?: { lat: number; lng: number } } | any;
    tagIds?: string[];
    // Tag specific fields
    name?: string;
    privateNotes?: string;
    isFiction?: boolean;
    type?: string;
    destinationPointer?: string;
    associationsCount?: number;
    mediaGallery?: any[];
    mediaIds?: string[];
}

interface StagedChanges {
    companionId: string;
    is_fiction: boolean;
    isPruned: boolean;
    isDirty: boolean;
    // Dynamic fields for edit mapping
    title?: string;
    details?: string;
    description?: string;
    name?: string;
    privateNotes?: string;
    location?: string;
}

interface LedgerItem {
    _id: string;
    originalId: string;
    checksum: string;
    deletedAt: string;
    operator: string;
    backupText: string;
}

// Levenshtein-based distance for structural de-duplication
const getLevenshteinDistance = (s1: string, s2: string): number => {
    if (s1.length < s2.length) return getLevenshteinDistance(s2, s1);
    if (s2.length === 0) return s1.length;
    let prevRow = Array.from({ length: s2.length + 1 }, (_, i) => i);
    for (let i = 0; i < s1.length; i++) {
        let curRow = [i + 1];
        for (let j = 0; j < s2.length; j++) {
            const insertCost = prevRow[j + 1] + 1;
            const deleteCost = curRow[j] + 1;
            const replaceCost = prevRow[j] + (s1[i] === s2[j] ? 0 : 1);
            curRow.push(Math.min(insertCost, deleteCost, replaceCost));
        }
        prevRow = curRow;
    }
    return prevRow[prevRow.length - 1];
};

const getSimilarity = (s1: string, s2: string): number => {
    const clean1 = (s1 || '').trim().toLowerCase();
    const clean2 = (s2 || '').trim().toLowerCase();
    if (clean1 === clean2) return 1.0;
    const dist = getLevenshteinDistance(clean1, clean2);
    const maxLen = Math.max(clean1.length, clean2.length);
    if (maxLen === 0) return 1.0;
    return 1.0 - dist / maxLen;
};

export const PurificationModal: React.FC<PurificationModalProps> = ({ isOpen, onClose, userId }) => {
    const [collectionScope, setCollectionScope] = useState<'chat_segments' | 'events' | 'tags'>('chat_segments');
    const [records, setRecords] = useState<RawRecord[]>([]);
    const [stagedState, setStagedState] = useState<Record<string, StagedChanges>>({});
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'audit' | 'ledger'>('audit');
    const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
    const [stagedOnly, setStagedOnly] = useState<boolean>(false);

    // Sorting states
    const [sortField, setSortField] = useState<string>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Duplicate detection states
    const [duplicateClusterIds, setDuplicateClusterIds] = useState<Record<string, boolean>>({});

    // Transplantation / Pointer sharing drawer states
    const [selectedTagForTransplant, setSelectedTagForTransplant] = useState<RawRecord | null>(null);
    const [selectedMediaToTransplant, setSelectedMediaToTransplant] = useState<any | null>(null);
    const [transplantAction, setTransplantAction] = useState<'transplant' | 'clone'>('transplant');
    const [targetTagIdForTransplant, setTargetTagIdForTransplant] = useState<string>('');
    const [transplanting, setTransplanting] = useState<boolean>(false);

    const hasDirtyChanges = useMemo(() => {
        return Object.values(stagedState).some(item => item.isDirty);
    }, [stagedState]);

    useEffect(() => {
        if (isOpen) {
            fetchPayload();
            fetchLedger();
        }
    }, [isOpen, collectionScope]);

    // [ZEN] Persist modifications in localStorage on dirty changes
    useEffect(() => {
        if (!isOpen) return;
        const dirtyEntries = Object.entries(stagedState).filter(([_, val]) => val.isDirty);
        if (dirtyEntries.length > 0) {
            const dirtyMap = Object.fromEntries(dirtyEntries);
            localStorage.setItem(`lifeos_staged_purifications_${collectionScope}`, JSON.stringify(dirtyMap));
        } else {
            localStorage.removeItem(`lifeos_staged_purifications_${collectionScope}`);
        }
    }, [stagedState, collectionScope, isOpen]);

    // [ZEN] Warn before leaving tab with unsaved staged edits
    useEffect(() => {
        if (!isOpen || !hasDirtyChanges) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = 'You have unsaved staged modifications. Are you sure you want to reload?';
            return e.returnValue;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isOpen, hasDirtyChanges]);

    const resetView = () => {
        localStorage.removeItem(`lifeos_staged_purifications_${collectionScope}`);
        fetchPayload();
    };

    const fetchPayload = async () => {
        setLoading(true);
        setError(null);
        setDuplicateClusterIds({});
        try {
            const res = await fetch('/api/admin/fetchPurificationPayload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, collectionName: collectionScope })
            });
            const result = await res.json();
            if (result.success) {
                setRecords(result.data || []);
                // Initialize staged states
                const initialStaged: Record<string, StagedChanges> = {};
                let cachedDrafts: Record<string, StagedChanges> = {};
                try {
                    const cached = localStorage.getItem(`lifeos_staged_purifications_${collectionScope}`);
                    if (cached) {
                        cachedDrafts = JSON.parse(cached);
                    }
                } catch (e) {
                    console.error('Failed to restore cached staged purifications drafts', e);
                }

                result.data.forEach((doc: RawRecord) => {
                    let companion = 'System/None';
                    if (doc.author?.id === 'gigi-default' || doc.companionId === 'brita') {
                        companion = 'brita';
                    }

                    const hasFictionFlag = doc.fiction === true || doc.search_metadata?.is_fiction === true || doc.is_fiction === true || doc.isFiction === true;

                    const cached = cachedDrafts[doc._id];
                    initialStaged[doc._id] = {
                        companionId: cached?.companionId !== undefined ? cached.companionId : companion,
                        is_fiction: cached?.is_fiction !== undefined ? cached.is_fiction : hasFictionFlag,
                        isPruned: cached?.isPruned !== undefined ? cached.isPruned : false,
                        isDirty: cached?.isDirty !== undefined ? cached.isDirty : false,
                        title: cached?.title !== undefined ? cached.title : doc.title,
                        details: cached?.details !== undefined ? cached.details : (doc.details || doc.description),
                        description: cached?.description !== undefined ? cached.description : doc.description,
                        name: cached?.name !== undefined ? cached.name : doc.name,
                        privateNotes: cached?.privateNotes !== undefined ? cached.privateNotes : doc.privateNotes,
                        location: cached?.location !== undefined ? cached.location : (doc.location?.addressLocality || doc.location?.streetAddress || '')
                    };
                });
                setStagedState(initialStaged);
            } else {
                setError(result.error || 'Failed to fetch payload.');
            }
        } catch (err: any) {
            setError(err.message || 'Error fetching records.');
        } finally {
            setLoading(false);
        }
    };

    const fetchLedger = async () => {
        try {
            const res = await fetch('/api/admin/rehydrateMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list' })
            });
            const result = await res.json();
            if (result.success) {
                setLedgerItems(result.data || []);
            }
        } catch (err) {
            console.error('Failed to load ledger', err);
        }
    };

    const getEpochSeconds = (doc: RawRecord): number => {
        const rawSec = doc.timestamp?._seconds || doc.timestamp?.seconds;
        if (rawSec) return rawSec;
        if (doc.timestamp) return new Date(doc.timestamp).getTime() / 1000;
        return 0;
    };

    const handleSort = (field: string) => {
        const nextDir = sortField === field && sortDir === 'asc' ? 'desc' : 'asc';
        setSortField(field);
        setSortDir(nextDir);

        const sorted = [...records].sort((a, b) => {
            let valA: any = '';
            let valB: any = '';

            if (field === 'date') {
                valA = getEpochSeconds(a);
                valB = getEpochSeconds(b);
                return nextDir === 'asc' ? valA - valB : valB - valA;
            } 
            else if (field === 'sender') {
                valA = a.role || '';
                valB = b.role || '';
            } 
            else if (field === 'companion') {
                valA = stagedState[a._id]?.companionId || '';
                valB = stagedState[b._id]?.companionId || '';
            } 
            else if (field === 'location') {
                valA = a.location?.addressLocality || a.location?.streetAddress || '';
                valB = b.location?.addressLocality || b.location?.streetAddress || '';
            } 
            else if (field === 'title') {
                valA = a.title || '';
                valB = b.title || '';
            } 
            else if (field === 'name') {
                valA = a.name || '';
                valB = b.name || '';
            } 
            else if (field === 'type') {
                valA = a.type || '';
                valB = b.type || '';
            }

            return nextDir === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        });

        setRecords(sorted);
    };

    const updateStagedCell = (id: string, updates: Partial<StagedChanges>) => {
        setStagedState(prev => {
            const current = prev[id];
            const next = { ...current, ...updates, isDirty: true };
            return { ...prev, [id]: next };
        });
    };

    const handleRehydrate = async (ledgerId: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/rehydrateMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'rehydrate', ledgerId })
            });
            const result = await res.json();
            if (result.success) {
                alert('Document successfully rehydrated back into active collection!');
                fetchPayload();
                fetchLedger();
            } else {
                alert('Rehydration failed: ' + result.error);
            }
        } catch (err: any) {
            alert('Rehydration error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const scanForDuplicates = () => {
        const clusters: Record<string, boolean> = {};

        if (collectionScope === 'events') {
            for (let i = 0; i < records.length; i++) {
                const recA = records[i];
                const timeA = Math.floor(getEpochSeconds(recA));
                const textA = recA.details || recA.description || '';

                for (let j = i + 1; j < records.length; j++) {
                    const recB = records[j];
                    const timeB = Math.floor(getEpochSeconds(recB));
                    const textB = recB.details || recB.description || '';

                    if (timeA === timeB && timeA > 0) {
                        const sim = getSimilarity(textA, textB);
                        if (sim >= 0.85) {
                            clusters[recA._id] = true;
                            clusters[recB._id] = true;
                        }
                    }
                }
            }
        } 
        else if (collectionScope === 'tags') {
            for (let i = 0; i < records.length; i++) {
                const recA = records[i];
                const nameA = (recA.name || '').trim().toLowerCase();

                for (let j = i + 1; j < records.length; j++) {
                    const recB = records[j];
                    const nameB = (recB.name || '').trim().toLowerCase();

                    if (nameA === nameB && nameA.length > 0 && recA._id !== recB._id) {
                        clusters[recA._id] = true;
                        clusters[recB._id] = true;
                    }
                }
            }
        }

        setDuplicateClusterIds(clusters);
        const count = Object.keys(clusters).length;
        alert(`Duplicate mapping complete. Identified ${count} cluster members.`);
    };

    const selectAllRedundantDuplicates = () => {
        const newStaged = { ...stagedState };

        if (collectionScope === 'events') {
            const groups: Record<number, RawRecord[]> = {};
            records.forEach(rec => {
                if (duplicateClusterIds[rec._id]) {
                    const t = Math.floor(getEpochSeconds(rec));
                    if (!groups[t]) groups[t] = [];
                    groups[t].push(rec);
                }
            });

            Object.values(groups).forEach(group => {
                group.sort((a, b) => {
                    const timeA = getEpochSeconds(a);
                    const timeB = getEpochSeconds(b);
                    if (timeA !== timeB) return timeA - timeB;
                    return a._id.localeCompare(b._id);
                });
                // Keep oldest, stage others for pruning
                for (let i = 1; i < group.length; i++) {
                    const id = group[i]._id;
                    newStaged[id] = {
                        ...newStaged[id],
                        isPruned: true,
                        isDirty: true
                    };
                }
            });
        } 
        else if (collectionScope === 'tags') {
            const groups: Record<string, RawRecord[]> = {};
            records.forEach(rec => {
                if (duplicateClusterIds[rec._id]) {
                    const n = (rec.name || '').trim().toLowerCase();
                    if (!groups[n]) groups[n] = [];
                    groups[n].push(rec);
                }
            });

            Object.values(groups).forEach(group => {
                group.sort((a, b) => a._id.localeCompare(b._id));
                for (let i = 1; i < group.length; i++) {
                    const id = group[i]._id;
                    newStaged[id] = {
                        ...newStaged[id],
                        isPruned: true,
                        isDirty: true
                    };
                }
            });
        }

        setStagedState(newStaged);
        alert('Staged newer redundant entries for permanent pruning.');
    };

    const handleCommit = async () => {
        const stagedList = Object.entries(stagedState)
            .filter(([_, value]) => value.isDirty)
            .map(([key, value]) => ({
                _id: key,
                action: value.isPruned ? 'prune' : 'save',
                companionId: value.companionId,
                is_fiction: value.is_fiction,
                title: value.title,
                details: value.details,
                description: value.description,
                name: value.name,
                privateNotes: value.privateNotes
            }));

        if (stagedList.length === 0) {
            alert('No staged changes detected. Update values to compile transaction.');
            return;
        }

        const confirmMsg = `Are you sure you want to commit ${stagedList.length} staged change(s)?\n\n` +
            `This will clone '${collectionScope}' into a secure backup collection before performing atomic updates.`;

        if (!confirm(confirmMsg)) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/admin/commitPurifiedSchema', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, stagedRecords: stagedList, targetCollection: collectionScope })
            });
            const result = await res.json();
            if (result.success) {
                localStorage.removeItem(`lifeos_staged_purifications_${collectionScope}`);
                alert(`Purification complete!\nSaves executed: ${result.savesCount}\nPrunes executed: ${result.prunesCount}`);
                fetchPayload();
                fetchLedger();
            } else {
                setError(result.error || 'Failed to commit updates.');
            }
        } catch (err: any) {
            setError(err.message || 'Error committing updates.');
        } finally {
            setLoading(false);
        }
    };

    const executeTransplant = async () => {
        if (!selectedTagForTransplant || !selectedMediaToTransplant || !targetTagIdForTransplant) {
            alert('Please select both an asset and a target tag container.');
            return;
        }

        setTransplanting(true);
        try {
            const res = await fetch('/api/admin/transplantAsset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: transplantAction,
                    mediaId: selectedMediaToTransplant.id,
                    sourceTagId: selectedTagForTransplant._id,
                    targetTagId: targetTagIdForTransplant
                })
            });
            const result = await res.json();
            if (result.success) {
                alert(`Asset reference successfully ${transplantAction === 'transplant' ? 'transplanted' : 'cloned'}!`);
                setSelectedTagForTransplant(null);
                setSelectedMediaToTransplant(null);
                setTargetTagIdForTransplant('');
                fetchPayload();
            } else {
                alert('Spacetime alignment failed: ' + result.error);
            }
        } catch (err: any) {
            alert('Transplant error: ' + err.message);
        } finally {
            setTransplanting(false);
        }
    };

    const formatDate = (doc: RawRecord) => {
        const rawSec = doc.timestamp?._seconds || doc.timestamp?.seconds;
        if (rawSec) {
            return new Date(rawSec * 1000).toLocaleString();
        }
        if (doc.timestamp) {
            return new Date(doc.timestamp).toLocaleString();
        }
        return 'N/A';
    };

    const displayedRecords = useMemo(() => {
        return records.filter(doc => {
            if (stagedOnly) {
                return stagedState[doc._id]?.isDirty === true;
            }
            return true;
        });
    }, [records, stagedState, stagedOnly]);

    // Available target tags for transplant dropdown
    const availableTransplantTags = useMemo(() => {
        if (collectionScope !== 'tags') return [];
        return records.filter(t => t._id !== selectedTagForTransplant?._id);
    }, [records, selectedTagForTransplant, collectionScope]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 font-sans pl-[90px] w-full box-border">
            {/* Header section */}
            <div className="flex justify-between items-center px-6 py-4 bg-slate-900 border-b border-cyan-500/20">
                <div className="flex items-center gap-3">
                    <span className="p-2 bg-cyan-950 rounded-xl border border-cyan-500/30 text-cyan-400">
                        🧬
                    </span>
                    <div>
                        <h2 className="text-md font-bold tracking-wider uppercase text-cyan-400 flex items-center gap-2">
                            Database Multi-Tool Dashboard
                            <span className="text-[9px] px-2 py-0.5 bg-red-950 text-red-400 rounded-full border border-red-500/30 animate-pulse font-mono">
                                STAGE 4 ADMIN LOCK
                            </span>
                        </h2>
                        <p className="text-[10px] text-slate-400 font-mono">
                            Human-In-The-Loop aggregate multi-collection schematics & asset transplantation pipeline
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Collection Scope Selector */}
                    <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-white/5 text-xs font-mono">
                        <span className="text-slate-500 uppercase tracking-wider text-[10px]">Scope:</span>
                        <select
                            value={collectionScope}
                            onChange={(e) => setCollectionScope(e.target.value as any)}
                            className="bg-transparent text-cyan-400 font-bold outline-none border-none focus:ring-0 cursor-pointer"
                            title="Switch active database collection scope"
                        >
                            <option value="chat_segments" className="bg-slate-950">chat_segments</option>
                            <option value="events" className="bg-slate-950">events (timeline)</option>
                            <option value="tags" className="bg-slate-950">tags (wiki ledger)</option>
                        </select>
                    </div>

                    {/* View mode toggle tabs */}
                    <div className="flex bg-slate-950 p-1 rounded-lg border border-white/5 text-xs font-mono">
                        <button
                            onClick={() => setActiveTab('audit')}
                            className={`px-3 py-1.5 rounded-md font-bold transition-all ${activeTab === 'audit' ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Access interactive structural matrix audit sheet"
                        >
                            🔍 Interactive Schema Audit
                        </button>
                        <button
                            onClick={() => setActiveTab('ledger')}
                            className={`px-3 py-1.5 rounded-md font-bold transition-all ${activeTab === 'ledger' ? 'bg-red-950 text-red-400 border border-red-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Verify historically archived tombstone logs"
                        >
                            📜 append-only blame ledger ({ledgerItems.length})
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white bg-slate-800/40 rounded-full border border-white/5 hover:bg-slate-800 transition-all"
                        title="Close Multi-Tool Dashboard"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {loading && (
                <div className="bg-cyan-950/40 border-b border-cyan-500/20 px-6 py-2.5 flex items-center justify-center gap-2 text-xs font-mono text-cyan-400">
                    <RefreshCw className="animate-spin" size={14} /> Processing serverless transaction...
                </div>
            )}

            {error && (
                <div className="bg-red-950/40 border-b border-red-500/20 px-6 py-3 flex items-center gap-2 text-xs font-mono text-red-400">
                    <ShieldAlert size={14} /> <strong>PRE-FLIGHT REJECTION:</strong> {error}
                </div>
            )}

            {activeTab === 'audit' ? (
                <div className="flex-1 flex flex-row overflow-hidden relative">
                    {/* Left Pane - Main Matrix */}
                    <div className="flex-grow flex flex-col overflow-hidden">
                        {/* Subbar controls */}
                        <div className="px-6 py-3 bg-slate-900/60 border-b border-white/5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                {/* Staged toggle switch */}
                                <label className="flex items-center gap-2 cursor-pointer bg-slate-950 px-3 py-1.5 rounded-full border border-white/5 text-xs font-mono select-none">
                                    <input
                                        type="checkbox"
                                        checked={stagedOnly}
                                        onChange={(e) => setStagedOnly(e.target.checked)}
                                        className="hidden"
                                    />
                                    <span className={`w-3.5 h-3.5 rounded-full border transition-all ${stagedOnly ? 'bg-cyan-500 border-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'border-slate-600 bg-transparent'}`} />
                                    <span className={stagedOnly ? 'text-cyan-400 font-bold' : 'text-slate-400'}>
                                        🔍 Show Staged Changes Only
                                    </span>
                                </label>

                                <span className="text-xs text-slate-500 font-mono">
                                    Viewing {displayedRecords.length} / {records.length} records matching identity
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* De-duplication Scan actions */}
                                {(collectionScope === 'events' || collectionScope === 'tags') && (
                                    <>
                                        <GlassButton 
                                            onClick={scanForDuplicates} 
                                            variant="secondary" 
                                            className="h-9 px-4 text-xs font-bold font-mono border-yellow-500/30 text-yellow-400 hover:bg-yellow-950/20 group relative"
                                        >
                                            <AlertTriangle size={12} className="mr-1.5 animate-bounce" /> Scan for Structural Duplicates
                                            <div className="absolute hidden group-hover:block top-full mt-2 right-0 w-72 bg-slate-900 border border-yellow-500/40 p-3 rounded-xl shadow-2xl z-50 text-[10px] text-slate-300 font-sans normal-case text-left cursor-default pointer-events-none">
                                                <strong className="text-yellow-400 block mb-1">STRUCTURAL SCAN PROTOCOL</strong>
                                                Executes a deep-scan against all timeline chronologies and gallery entities to identify overlapping tag names, duplicate spacetime nodes, and structural referential collisions. Use this to prevent administrative user error.
                                            </div>
                                        </GlassButton>

                                        {Object.keys(duplicateClusterIds).length > 0 && (
                                            <GlassButton 
                                                onClick={selectAllRedundantDuplicates} 
                                                variant="secondary" 
                                                className="h-9 px-4 text-xs font-bold font-mono border-red-500/30 text-red-400 hover:bg-red-950/20 group relative"
                                            >
                                                <Trash size={12} className="mr-1.5" /> Select All Redundant Duplicates
                                                <div className="absolute hidden group-hover:block top-full mt-2 right-0 w-64 bg-slate-900 border border-red-500/40 p-3 rounded-xl shadow-2xl z-50 text-[10px] text-slate-300 font-sans normal-case text-left cursor-default pointer-events-none">
                                                    <strong className="text-red-400 block mb-1">BATCH PRUNE STAGING</strong>
                                                    Selects all newer redundant cluster entries for automated batch deletion staging. Ensure you commit changes to finalize.
                                                </div>
                                            </GlassButton>
                                        )}
                                    </>
                                )}

                                {/* Transplantation Macro Controls */}
                                {(collectionScope === 'tags' || collectionScope === 'events') && (
                                    <>
                                        <GlassButton 
                                            onClick={() => { setTransplantAction('transplant'); executeTransplant(); }} 
                                            variant="secondary" 
                                            className="h-9 px-4 text-xs font-bold font-mono border-blue-500/30 text-blue-400 hover:bg-blue-950/20 group relative"
                                            disabled={!selectedTagForTransplant || !selectedMediaToTransplant || !targetTagIdForTransplant}
                                        >
                                            <ArrowRightLeft size={12} className="mr-1.5" /> Transplant Asset
                                            <div className="absolute hidden group-hover:block top-full mt-2 right-0 w-64 bg-slate-900 border border-blue-500/40 p-3 rounded-xl shadow-2xl z-50 text-[10px] text-slate-300 font-sans normal-case text-left cursor-default pointer-events-none">
                                                <strong className="text-blue-400 block mb-1">DESTRUCTIVE MIGRATION</strong>
                                                Severs the selected asset's relational ties to its current parent structure and forcibly re-maps its pointers to the target destination. The original container will lose this asset entirely.
                                            </div>
                                        </GlassButton>

                                        <GlassButton 
                                            onClick={() => { setTransplantAction('clone'); executeTransplant(); }} 
                                            variant="secondary" 
                                            className="h-9 px-4 text-xs font-bold font-mono border-purple-500/30 text-purple-400 hover:bg-purple-950/20 group relative"
                                            disabled={!selectedTagForTransplant || !selectedMediaToTransplant || !targetTagIdForTransplant}
                                        >
                                            <Layers size={12} className="mr-1.5" /> Clone Pointer
                                            <div className="absolute hidden group-hover:block top-full mt-2 right-0 w-64 bg-slate-900 border border-purple-500/40 p-3 rounded-xl shadow-2xl z-50 text-[10px] text-slate-300 font-sans normal-case text-left cursor-default pointer-events-none">
                                                <strong className="text-purple-400 block mb-1">NON-DESTRUCTIVE CLONE</strong>
                                                Duplicates the asset's structural pointers, mapping it to both the origin container and the new target destination simultaneously. No historical relations are severed.
                                            </div>
                                        </GlassButton>
                                    </>
                                )}

                                <GlassButton 
                                    onClick={resetView} 
                                    variant="secondary" 
                                    className="h-9 px-4 text-xs font-bold font-mono group relative"
                                >
                                    <RefreshCw size={12} className="mr-1.5" /> Reset View
                                    <div className="absolute hidden group-hover:block top-full mt-2 right-0 w-56 bg-slate-900 border border-slate-500/40 p-3 rounded-xl shadow-2xl z-50 text-[10px] text-slate-300 font-sans normal-case text-left cursor-default pointer-events-none">
                                        <strong className="text-slate-400 block mb-1">RESET WORKSPACE</strong>
                                        Purges all uncommitted staged modifications from local memory and fetches a fresh payload from Atlas.
                                    </div>
                                </GlassButton>
                                <GlassButton
                                    onClick={handleCommit}
                                    variant="success"
                                    className="h-9 px-6 text-xs font-bold font-mono bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950/40 border-none"
                                    title="Commit all staged changes, execute snapshot, and write logs to Blame Ledger"
                                >
                                    <Save size={12} className="mr-1.5" /> Commit All Changes
                                </GlassButton>
                            </div>
                        </div>

                        {/* Table Viewport Container */}
                        <div className="flex-grow overflow-auto custom-scrollbar bg-slate-950 relative">
                            {displayedRecords.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-slate-500 font-mono text-xs">
                                    <Info size={32} className="text-slate-600 mb-2" />
                                    No matching records found under this view scope.
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse font-mono text-xs select-none">
                                    <thead className="sticky top-0 bg-slate-900 z-10 text-[10px] text-cyan-500 uppercase tracking-widest border-b border-white/10 select-none">
                                        {collectionScope === 'chat_segments' && (
                                            <tr>
                                                <th onClick={() => handleSort('date')} className="px-4 py-3 cursor-pointer hover:bg-slate-800 transition-all select-none group relative">
                                                    Date <ArrowUpDown size={10} className="inline ml-1" />
                                                    <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-slate-900 border border-cyan-500/40 p-2 rounded shadow-2xl z-50 text-[9px] text-cyan-100 font-sans normal-case pointer-events-none text-center">
                                                        Evaluate records sorted by chronological timestamp
                                                    </div>
                                                </th>
                                                <th onClick={() => handleSort('sender')} className="px-4 py-3 cursor-pointer hover:bg-slate-800 transition-all select-none group relative">
                                                    Sender <ArrowUpDown size={10} className="inline ml-1" />
                                                    <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-slate-900 border border-cyan-500/40 p-2 rounded shadow-2xl z-50 text-[9px] text-cyan-100 font-sans normal-case pointer-events-none text-center">
                                                        Sort by composite role emitter identity
                                                    </div>
                                                </th>
                                                <th className="px-4 py-3 select-none group relative">
                                                    Message Snippet (Hover to View Entire Segment)
                                                </th>
                                                <th onClick={() => handleSort('companion')} className="px-4 py-3 cursor-pointer hover:bg-slate-800 transition-all select-none group relative">
                                                    Companion Assignment <ArrowUpDown size={10} className="inline ml-1" />
                                                    <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-slate-900 border border-cyan-500/40 p-2 rounded shadow-2xl z-50 text-[9px] text-cyan-100 font-sans normal-case pointer-events-none text-center">
                                                        Assign active conversational record companion context bounds
                                                    </div>
                                                </th>
                                                <th className="px-4 py-3 text-center select-none group relative">
                                                    Fiction?
                                                    <div className="absolute hidden group-hover:block bottom-full left-1/2 -translate-x-1/2 mb-1 w-48 bg-slate-900 border border-cyan-500/40 p-2 rounded shadow-2xl z-50 text-[9px] text-cyan-100 font-sans normal-case pointer-events-none text-center">
                                                        Classify narrative thread content as historical fact or creative fiction
                                                    </div>
                                                </th>
                                                <th className="px-4 py-3 text-right select-none group relative">
                                                    🗑&nbsp;Prune?
                                                    <div className="absolute hidden group-hover:block bottom-full right-0 mb-1 w-56 bg-red-950 border border-red-500/40 p-2 rounded shadow-2xl z-50 text-[9px] text-red-100 font-sans normal-case pointer-events-none text-left">
                                                        <strong className="text-red-400 block mb-1">HARD DELETION</strong>
                                                        Flags record for absolute hard-deletion and SHA-256 cryptographic logging on bulk commit
                                                    </div>
                                                </th>
                                            </tr>
                                        )}

                                        {collectionScope === 'events' && (
                                            <tr>
                                                <th onClick={() => handleSort('date')} className="px-4 py-3 cursor-pointer hover:bg-slate-800 transition-all select-none" title="Evaluate timeline records sorted by chronological timestamp">
                                                    Date <ArrowUpDown size={10} className="inline ml-1" />
                                                </th>
                                                <th onClick={() => handleSort('location')} className="px-4 py-3 cursor-pointer hover:bg-slate-800 transition-all select-none" title="Sort by spatial location address structure">
                                                    Location <ArrowUpDown size={10} className="inline ml-1" />
                                                </th>
                                                <th onClick={() => handleSort('title')} className="px-4 py-3 cursor-pointer hover:bg-slate-800 transition-all select-none" title="Sort by event summary title string">
                                                    Event Title &amp; Details Snippet <ArrowUpDown size={10} className="inline ml-1" />
                                                </th>
                                                <th className="px-4 py-3 select-none" title="Wiki Tag reference links mapped to event metadata">Associated Wiki Tags Array</th>
                                                <th className="px-4 py-3 text-right select-none" title="Flags record for absolute hard-deletion and SHA-256 cryptographic logging on bulk commit">🗑&nbsp;Prune?</th>
                                            </tr>
                                        )}

                                        {collectionScope === 'tags' && (
                                            <tr>
                                                <th onClick={() => handleSort('name')} className="px-4 py-3 cursor-pointer hover:bg-slate-800 transition-all select-none" title="Evaluate Tag records sorted by case-insensitive name alphanumeric order">
                                                    Tag Name <ArrowUpDown size={10} className="inline ml-1" />
                                                </th>
                                                <th onClick={() => handleSort('type')} className="px-4 py-3 cursor-pointer hover:bg-slate-800 transition-all select-none" title="Sort by tag structural taxonomy type">
                                                    Taxonomy Type <ArrowUpDown size={10} className="inline ml-1" />
                                                </th>
                                                <th className="px-4 py-3 select-none" title="Tag redirect pointer identifier">Destination Pointer</th>
                                                <th className="px-4 py-3 select-none text-center font-bold text-cyan-400" title="Asset count operations and clinical multiverse transplantation controls">Pointers / Action</th>
                                                <th className="px-4 py-3 text-right select-none" title="Flags record for absolute hard-deletion and SHA-256 cryptographic logging on bulk commit">🗑&nbsp;Prune?</th>
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {displayedRecords.map((doc) => {
                                            const staged = stagedState[doc._id] || {
                                                companionId: 'System/None',
                                                is_fiction: false,
                                                isPruned: false,
                                                isDirty: false
                                            };

                                            const isDupe = duplicateClusterIds[doc._id];

                                            return (
                                                <tr
                                                    key={doc._id}
                                                    className={`transition-colors border-white/5 hover:bg-white/[0.02] ${staged.isDirty ? 'bg-cyan-950/10' : ''} ${staged.isPruned ? 'line-through opacity-25 border-red-950 bg-red-950/10' : ''}`}
                                                >
                                                    {collectionScope === 'chat_segments' && (
                                                        <>
                                                            <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 flex items-center gap-1.5">
                                                                {isDupe && (
                                                                    <span className="px-1.5 py-0.5 bg-yellow-950 text-yellow-400 text-[8px] font-bold rounded border border-yellow-500/30" title="Identified near-duplicate string pattern similarity cluster">
                                                                        ⚠️ DUPE
                                                                    </span>
                                                                )}
                                                                {formatDate(doc)}
                                                            </td>
                                                            <td className="px-4 py-3.5 whitespace-nowrap font-bold text-slate-300">
                                                                {doc.role === 'user' ? '👤 User' : `🤖 ${doc.role || 'system'}`}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-slate-300 relative group cursor-help select-none">
                                                                <span>
                                                                    {doc.content ? doc.content.substring(0, 45) : 'N/A'}
                                                                    {doc.content && doc.content.length > 45 ? '...' : ''}
                                                                </span>
                                                                {doc.content && (
                                                                    <div className="absolute left-4 top-8 hidden group-hover:block w-[400px] max-h-60 overflow-y-auto bg-slate-900 border border-cyan-500/30 text-slate-100 whitespace-pre-wrap p-4 rounded-lg shadow-2xl z-50 text-[11px] font-sans no-scrollbar">
                                                                        {doc.content}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 select-none">
                                                                <select
                                                                    disabled={staged.isPruned}
                                                                    value={staged.companionId}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onKeyDown={(e) => e.stopPropagation()}
                                                                    onChange={(e) => { e.stopPropagation(); updateStagedCell(doc._id, { companionId: e.target.value }); }}
                                                                    className="bg-slate-900 text-slate-200 border border-white/10 rounded px-2.5 py-1 focus:outline-none focus:border-cyan-500 transition-all text-xs font-mono font-bold"
                                                                >
                                                                    <option value="brita">brita (companion)</option>
                                                                    <option value="System/None">System/None (journal)</option>
                                                                </select>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-center select-none">
                                                                <button
                                                                    disabled={staged.isPruned}
                                                                    onClick={(e) => { e.stopPropagation(); updateStagedCell(doc._id, { is_fiction: !staged.is_fiction }); }}
                                                                    className={`px-3 py-1 rounded-full border text-[10px] font-bold tracking-widest uppercase transition-all ${staged.is_fiction ? 'bg-red-950 border-red-500/40 text-red-400' : 'bg-slate-900 border-white/10 text-slate-500 hover:text-slate-300'}`}
                                                                >
                                                                    {staged.is_fiction ? 'Fiction' : 'Fact'}
                                                                </button>
                                                            </td>
                                                        </>
                                                    )}

                                                    {collectionScope === 'events' && (
                                                        <>
                                                            <td className="px-4 py-3.5 whitespace-nowrap text-slate-400">
                                                                <div className="flex items-center gap-1.5">
                                                                    {isDupe && (
                                                                        <span className="px-1.5 py-0.5 bg-yellow-950 text-yellow-400 text-[8px] font-bold rounded border border-yellow-500/30" title="Identified near-duplicate string pattern similarity cluster">
                                                                            ⚠️ DUPE
                                                                        </span>
                                                                    )}
                                                                    {formatDate(doc)}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3.5 whitespace-nowrap text-slate-300">
                                                                {staged.isPruned ? (
                                                                    <span>{staged.location}</span>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        value={staged.location}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onKeyDown={(e) => e.stopPropagation()}
                                                                        onChange={(e) => { e.stopPropagation(); updateStagedCell(doc._id, { location: e.target.value }); }}
                                                                        className="bg-slate-900 border border-white/5 rounded px-2 py-1 text-slate-300 focus:border-cyan-500 focus:outline-none w-full"
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-slate-300 relative group cursor-help select-none">
                                                                <div className="flex flex-col gap-0.5">
                                                                    {staged.isPruned ? (
                                                                        <span className="font-bold text-slate-400">{staged.title}</span>
                                                                    ) : (
                                                                        <input
                                                                            type="text"
                                                                            value={staged.title}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onKeyDown={(e) => e.stopPropagation()}
                                                                            onChange={(e) => { e.stopPropagation(); updateStagedCell(doc._id, { title: e.target.value }); }}
                                                                            className="bg-slate-900 border border-white/5 rounded px-2 py-0.5 text-slate-200 font-bold focus:border-cyan-500 focus:outline-none mb-1"
                                                                        />
                                                                    )}
                                                                    {staged.isPruned ? (
                                                                        <span className="text-[10px] text-slate-500">{staged.details?.substring(0, 40)}...</span>
                                                                    ) : (
                                                                        <textarea
                                                                            value={staged.details}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onKeyDown={(e) => e.stopPropagation()}
                                                                            onChange={(e) => { e.stopPropagation(); updateStagedCell(doc._id, { details: e.target.value }); }}
                                                                            className="bg-slate-900 border border-white/5 rounded px-2 py-0.5 text-[10px] text-slate-400 focus:border-cyan-500 focus:outline-none h-8 w-full"
                                                                        />
                                                                    )}
                                                                </div>
                                                                {(doc.details || doc.description) && (
                                                                    <div className="absolute left-4 top-12 hidden group-hover:block w-[400px] max-h-60 overflow-y-auto bg-slate-900 border border-cyan-500/30 text-slate-100 whitespace-pre-wrap p-4 rounded-lg shadow-2xl z-50 text-[11px] font-sans no-scrollbar">
                                                                        {doc.details || doc.description}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3.5 whitespace-nowrap text-slate-400">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {doc.tagIds && doc.tagIds.length > 0 ? (
                                                                        doc.tagIds.map(tId => (
                                                                            <span key={tId} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[9px] border border-white/5 select-all">
                                                                                {tId.substring(0, 12)}
                                                                            </span>
                                                                        ))
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-600 italic">No associated tags</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </>
                                                    )}

                                                    {collectionScope === 'tags' && (
                                                        <>
                                                            <td className="px-4 py-3.5 whitespace-nowrap text-slate-200 font-bold">
                                                                <div className="flex items-center gap-1.5">
                                                                    {isDupe && (
                                                                        <span className="px-1.5 py-0.5 bg-yellow-950 text-yellow-400 text-[8px] font-bold rounded border border-yellow-500/30" title="Identified duplicate trimmed alphanumeric Tag names under multiple IDs">
                                                                            ⚠️ DUPE
                                                                        </span>
                                                                    )}
                                                                    {staged.isPruned ? (
                                                                        <span>{staged.name}</span>
                                                                    ) : (
                                                                        <input
                                                                            type="text"
                                                                            value={staged.name}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onKeyDown={(e) => e.stopPropagation()}
                                                                            onChange={(e) => { e.stopPropagation(); updateStagedCell(doc._id, { name: e.target.value }); }}
                                                                            className="bg-slate-900 border border-white/5 rounded px-2 py-1 text-slate-200 font-bold focus:border-cyan-500 focus:outline-none"
                                                                        />
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3.5 whitespace-nowrap text-slate-400">
                                                                <span className="px-2 py-0.5 bg-cyan-950 text-cyan-400 border border-cyan-500/20 rounded-full text-[10px] uppercase font-bold tracking-wider">
                                                                    {doc.type || 'generic'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3.5 text-slate-300 font-mono text-[10px] select-all">
                                                                {doc.destinationPointer || doc._id}
                                                            </td>
                                                            <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedTagForTransplant(doc); }}
                                                                    className="px-2.5 py-1 bg-cyan-950/40 hover:bg-cyan-950 border border-cyan-500/30 text-cyan-400 hover:text-cyan-200 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all mx-auto"
                                                                    title="Open the Clinical Multiverse Transplantation and sharing suite for this Tag's asset reference pointers"
                                                                >
                                                                    <ArrowRightLeft size={10} /> 🧬 Transplant/Clone ({doc.mediaGallery?.length || doc.mediaIds?.length || 0})
                                                                </button>
                                                            </td>
                                                        </>
                                                    )}

                                                    {/* Prune Checkbox Cell */}
                                                    <td className="px-4 py-3.5 text-right select-none">
                                                        <label className="inline-flex items-center justify-end cursor-pointer gap-2 pr-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={staged.isPruned}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onKeyDown={(e) => e.stopPropagation()}
                                                                onChange={(e) => { e.stopPropagation(); updateStagedCell(doc._id, { isPruned: e.target.checked }); }}
                                                                className="hidden"
                                                            />
                                                            <span className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${staged.isPruned ? 'bg-red-600 border-red-500 shadow-[0_0_8px_#ef4444]' : 'border-slate-600 bg-transparent'}`}>
                                                                {staged.isPruned && <Trash size={10} className="text-white" />}
                                                            </span>
                                                        </label>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Right Pane - Multiverse Transplantation Sidebar Drawer */}
                    {selectedTagForTransplant && (
                        <div className="w-[450px] bg-slate-900 border-l border-cyan-500/20 flex flex-col overflow-hidden font-sans">
                            <div className="p-4 bg-slate-950 border-b border-cyan-500/20 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="p-1 bg-cyan-950 text-cyan-400 rounded-lg border border-cyan-500/20 text-xs">🧬</span>
                                    <div>
                                        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Multiverse Transplantation</h3>
                                        <p className="text-[9px] text-slate-500 font-mono">Dynamic pointer control and asset sharing console</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setSelectedTagForTransplant(null); setSelectedMediaToTransplant(null); }}
                                    className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded-full"
                                    title="Close transplantation console"
                                >
                                    <X size={12} />
                                </button>
                            </div>

                            <div className="p-6 flex-grow overflow-y-auto custom-scrollbar space-y-6">
                                {/* Tag Info */}
                                <div className="space-y-1.5 bg-slate-950/40 p-3 rounded-lg border border-white/5">
                                    <div className="text-[10px] text-slate-500 font-mono uppercase">Source Tag Container</div>
                                    <div className="text-xs font-bold text-slate-200">{selectedTagForTransplant.name}</div>
                                    <div className="text-[9px] text-slate-600 font-mono select-all">ID: {selectedTagForTransplant._id}</div>
                                </div>

                                {/* Step 1: Select Media Item */}
                                <div className="space-y-3">
                                    <div className="text-[10px] text-cyan-500 font-mono uppercase tracking-widest">1. Select Asset Reference to Align</div>
                                    {(!selectedTagForTransplant.mediaGallery || selectedTagForTransplant.mediaGallery.length === 0) ? (
                                        <div className="p-4 text-center text-slate-600 italic font-mono text-[10px] border border-dashed border-white/10 rounded-lg">
                                            No media assets detected inside this tag's gallery.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            {selectedTagForTransplant.mediaGallery.map((mediaItem: any, idx: number) => {
                                                const isSelected = selectedMediaToTransplant?.id === mediaItem.id || selectedMediaToTransplant?.url === mediaItem.url;
                                                const mId = mediaItem.id || `unidentified_idx_${idx}`;

                                                return (
                                                    <div 
                                                        key={mId}
                                                        onClick={() => setSelectedMediaToTransplant({ ...mediaItem, id: mediaItem.id || mId })}
                                                        className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col gap-1.5 relative overflow-hidden ${isSelected ? 'bg-cyan-950/30 border-cyan-500 shadow-md shadow-cyan-950/40' : 'bg-slate-950/50 border-white/5 hover:border-white/10'}`}
                                                    >
                                                        {mediaItem.type === 'image' && mediaItem.url && (
                                                            <img src={mediaItem.url} alt="" className="w-full h-20 object-cover rounded border border-white/5 bg-slate-900 pointer-events-none" />
                                                        )}
                                                        <div className="text-[10px] text-slate-200 font-bold truncate">{mediaItem.caption || 'Asset Reference'}</div>
                                                        <div className="text-[8px] text-slate-500 font-mono truncate">{mediaItem.type || 'media'}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Alignment Action Details */}
                                {selectedMediaToTransplant && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div className="text-[10px] text-cyan-500 font-mono uppercase tracking-widest">2. Configure Spacetime Alignment</div>
                                        
                                        <div className="flex bg-slate-950 p-1 rounded-lg border border-white/5 text-[10px] font-mono">
                                            <button
                                                onClick={() => setTransplantAction('transplant')}
                                                className={`flex-1 py-1.5 rounded font-bold transition-all flex items-center justify-center gap-1 group relative ${transplantAction === 'transplant' ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                <ArrowRightLeft size={10} /> Transplant
                                                <div className="absolute hidden group-hover:block bottom-full mb-2 left-0 w-56 bg-slate-900 border border-cyan-500/40 p-2 rounded shadow-2xl z-50 text-[9px] text-cyan-100 font-sans normal-case text-left cursor-default pointer-events-none">
                                                    <strong className="text-cyan-400 block mb-0.5">TRANSPLANT</strong>
                                                    Move the selected asset to another target tag container, removing it completely from this source tag's references.
                                                </div>
                                            </button>
                                            <button
                                                onClick={() => setTransplantAction('clone')}
                                                className={`flex-1 py-1.5 rounded font-bold transition-all flex items-center justify-center gap-1 group relative ${transplantAction === 'clone' ? 'bg-purple-950 text-purple-400 border border-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                <Share2 size={10} /> Clone Pointer
                                                <div className="absolute hidden group-hover:block bottom-full mb-2 right-0 w-56 bg-slate-900 border border-purple-500/40 p-2 rounded shadow-2xl z-50 text-[9px] text-purple-100 font-sans normal-case text-left cursor-default pointer-events-none">
                                                    <strong className="text-purple-400 block mb-0.5">CLONE POINTER</strong>
                                                    Share the selected asset's reference pointer to another target tag container without duplicating the Backblaze B2 binary.
                                                </div>
                                            </button>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[9px] text-slate-500 font-mono uppercase">Target Tag Destination Container</label>
                                            <select
                                                value={targetTagIdForTransplant}
                                                onChange={(e) => setTargetTagIdForTransplant(e.target.value)}
                                                className="w-full bg-slate-950 text-slate-200 border border-white/10 rounded-lg p-2 focus:outline-none focus:border-cyan-500 transition-all font-mono font-bold text-xs"
                                                title="Select target tag container for asset alignment destination"
                                            >
                                                <option value="">-- Select Destination Tag --</option>
                                                {availableTransplantTags.map((tag) => (
                                                    <option key={tag._id} value={tag._id}>
                                                        {tag.name} ({tag.type || 'generic'})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-lg text-[9px] text-slate-400 leading-relaxed font-mono">
                                            {transplantAction === 'transplant' ? (
                                                <p>
                                                    <strong>TRANSPLANT PROTOCOL:</strong> Moves the reference pointer and media gallery entry from <em>{selectedTagForTransplant.name}</em> to the destination tag container. Removes the original pointer completely while keeping the single binary asset untouched in Backblaze B2.
                                                </p>
                                            ) : (
                                                <p>
                                                    <strong>CLONE POINTER PROTOCOL:</strong> Links the existing media file reference to the destination tag container. Establishes a premium many-to-many pointer mapping. Both tag containers will display the exact same media item without binary file duplication.
                                                </p>
                                            )}
                                        </div>

                                        <GlassButton
                                            disabled={transplanting || !targetTagIdForTransplant}
                                            onClick={executeTransplant}
                                            variant="success"
                                            className="w-full h-10 text-xs font-bold font-mono tracking-widest bg-cyan-500 hover:bg-cyan-400 border-none shadow-lg shadow-cyan-950/40 text-black flex items-center justify-center gap-1.5"
                                            title="Initiate transaction alignment execution straight to Atlas and media nodes"
                                        >
                                            {transplanting ? (
                                                <>
                                                    <RefreshCw size={12} className="animate-spin" /> Aligning Spacetime...
                                                </>
                                            ) : (
                                                <>
                                                    <Layers size={12} /> Execute Spacetime Alignment
                                                </>
                                            )}
                                        </GlassButton>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                // Ledger Recovery View
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
                    <div className="px-6 py-3 bg-slate-900/60 border-b border-white/5 flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-mono">
                            📜 append-only blame ledger (showing all historically pruned/deleted database records)
                        </span>
                        <GlassButton onClick={fetchLedger} variant="secondary" className="h-8 text-xs font-mono font-bold" title="Refresh Blame Ledger tombstones list">
                            <RefreshCw size={12} className="mr-1.5 animate-pulse" /> Refresh Ledger
                        </GlassButton>
                    </div>

                    <div className="flex-grow overflow-auto custom-scrollbar p-6">
                        {ledgerItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 font-mono text-xs h-full">
                                <Info size={32} className="text-slate-600 mb-2" />
                                Ledger is completely empty. No hard deletions have been committed.
                            </div>
                        ) : (
                            <div className="space-y-4 max-w-4xl mx-auto">
                                {ledgerItems.map((item) => (
                                    <div key={item._id} className="p-4 bg-slate-900/40 border border-red-500/20 rounded-xl space-y-3 relative overflow-hidden font-mono text-xs">
                                        <div className="absolute top-0 right-0 p-3 text-[9px] text-red-500/30 font-bold uppercase tracking-widest">
                                            Pruned Message Tombstone
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-slate-400 text-[10px]">
                                            <div>
                                                <span className="text-slate-600">LEDGER ID:</span>{' '}
                                                <span className="text-slate-300 select-all">{item._id}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-600">DELETED DATE:</span>{' '}
                                                <span className="text-slate-300">{new Date(item.deletedAt).toLocaleString()}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-600">CHECKSUM SHA-256:</span>{' '}
                                                <span className="text-cyan-500 select-all font-mono">{item.checksum.substring(0, 32)}...</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-600">AUDITOR SIGNATURE:</span>{' '}
                                                <span className="text-emerald-400">{item.operator}</span>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-black/40 border border-white/5 rounded-lg text-slate-300 italic font-sans leading-relaxed text-xs">
                                            &ldquo;{item.backupText}&rdquo;
                                            {item.backupText.length >= 500 && '...'}
                                        </div>

                                        <div className="flex justify-end pt-1">
                                            <button
                                                onClick={() => handleRehydrate(item._id)}
                                                className="px-3.5 py-1.5 bg-emerald-950 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-200 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all"
                                                title="Perform absolute database restoration recovery valve for this tombstoned record"
                                            >
                                                <Undo size={10} /> ⏪ Rehydrate
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
export default PurificationModal;
