import React, { useState, useEffect } from 'react';
import { TypesenseAdminService } from '../../services/TypesenseAdminService';
import { EnrichmentService } from '../../services/enrichmentService';
import { Trash2, Save, Search, RefreshCw, X, Zap, Edit3, Anchor, ShieldCheck, ShieldAlert, Loader2, AlertTriangle, Wand2, Database, Shield } from 'lucide-react';
import { isRootUser } from '../../utils/rbac';
import { Portal } from '../Portal'; // [PACT] Breaking Chaos

interface TypesenseManagerProps {
    userId: string;
}

export const TypesenseManager: React.FC<TypesenseManagerProps> = ({ userId }) => {
    const [docs, setDocs] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingDoc, setEditingDoc] = useState<any | null>(null);
    const [isDryRun, setIsDryRun] = useState(true); // [SAFETY] Default to ON

    // Batch State
    const [batchMode, setBatchMode] = useState<'MODEL' | 'TEXT'>('MODEL'); // [ZEN UI] Toggle
    const [batchSearch, setBatchSearch] = useState('');
    const [batchReplacement, setBatchReplacement] = useState(''); // Unified state for ModelID or Text

    const [totalFound, setTotalFound] = useState(0);
    const isRootSession = isRootUser();

    const loadRecent = async () => {
        setLoading(true);
        try {
            const { hits, found } = await TypesenseAdminService.listRecent(userId, 50);
            setDocs(hits.map((h: any) => h.document));
            setTotalFound(found);
        } catch (e) {
            console.error("Failed to load Typesense docs", e);
        } finally {
            setLoading(false);
        }
    };

    // [ZEN FIX] Unified Search Execution for Live Queries
    const executeSearch = async () => {
        if (!searchTerm.trim()) {
            loadRecent();
            return;
        }
        setLoading(true);
        console.log(`[AUDITOR] Executing Live Search for: "${searchTerm}"`);
        try {
            const { hits, found } = await TypesenseAdminService.searchIndex(userId, searchTerm);
            setDocs(hits.map((h: any) => h.document));
            setTotalFound(found);
            if (hits.length === 0) console.warn(`[AUDITOR] No hits found for "${searchTerm}"`);
        } catch (e: any) {
            console.error("[AUDITOR] Search Error:", e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') executeSearch();
    };

    useEffect(() => {
        if (userId && userId !== 'unknown') {
            loadRecent();
        }
    }, [userId]);

    // [ZEN HELPER] Inside Out Sentiment Palette
    const getCoreClasses = (sentiment: string = "") => {
        const s = sentiment.toLowerCase();

        // Single Emotion Maps
        if (s.includes('joy')) return { border: 'border-yellow-400', shadow: 'shadow-yellow-400/20', text: 'text-yellow-400', bg: 'bg-yellow-400/5' };
        if (s.includes('sadness')) return { border: 'border-blue-500', shadow: 'shadow-blue-500/20', text: 'text-blue-500', bg: 'bg-blue-500/5' };
        if (s.includes('anger')) return { border: 'border-red-500', shadow: 'shadow-red-500/20', text: 'text-red-500', bg: 'bg-red-500/5' };
        if (s.includes('fear')) return { border: 'border-purple-500', shadow: 'shadow-purple-500/20', text: 'text-purple-500', bg: 'bg-purple-500/5' };
        if (s.includes('disgust')) return { border: 'border-green-500', shadow: 'shadow-green-500/20', text: 'text-green-500', bg: 'bg-green-500/5' };
        if (s.includes('anxiety')) return { border: 'border-orange-500', shadow: 'shadow-orange-500/20', text: 'text-orange-500', bg: 'bg-orange-500/5' };
        if (s.includes('envy')) return { border: 'border-cyan-400', shadow: 'shadow-cyan-400/20', text: 'text-cyan-400', bg: 'bg-cyan-400/5' };
        if (s.includes('ennui')) return { border: 'border-indigo-400', shadow: 'shadow-indigo-400/20', text: 'text-indigo-400', bg: 'bg-indigo-400/5' };
        if (s.includes('embarrassment')) return { border: 'border-pink-500', shadow: 'shadow-pink-500/20', text: 'text-pink-500', bg: 'bg-pink-500/5' };
        if (s.includes('nostalgia')) return { border: 'border-stone-400', shadow: 'shadow-stone-400/20', text: 'text-stone-400', bg: 'bg-stone-400/5' };

        // Default Core (Gold)
        return { border: 'border-amber-500/50', shadow: 'shadow-amber-500/10', text: 'text-amber-500', bg: 'bg-amber-500/5' };
    };

    const handleDelete = async (id: string) => {
        const modeText = isDryRun ? "SIMULATE deletion of" : "PERMANENTLY DELETE";
        if (!window.confirm(`${modeText} document ${id}?`)) return;

        try {
            await TypesenseAdminService.deleteDocument(userId, id);
            if (!isDryRun) {
                setDocs(docs.filter(d => d.id !== id));
                setEditingDoc(null);
            }
        } catch (e) {
            console.error("Delete failed:", e);
            alert("Delete failed. Check console for details.");
        }
    };

    const handleUpdate = async () => {
        if (!editingDoc) return;
        try {
            // [ZEN FIX] SSOT Sync with RECORD-SPECIFIC Ownership (Enables Cross-User Support)
            const targetUserId = editingDoc.user_id || userId;
            await TypesenseAdminService.updateDocument(targetUserId, editingDoc.id, editingDoc, isDryRun);

            if (!isDryRun) {
                setDocs(docs.map(d => d.id === editingDoc.id ? editingDoc : d));
                alert("Record Synchronized Across SSOT.");
                setEditingDoc(null);
            } else {
                alert("Dry Run Complete. Check Console for intended changes.");
            }
        } catch (e: any) {
            console.error("Update failed:", e);
            alert(`Update failed: ${e.message || "Is this a different user's data?"}`);
        }
    };

    const handleBatchReplace = async () => {
        if (!batchSearch) return; // Allow empty replacement for stripping text
        const modeText = isDryRun ? "SIMULATE" : "EXECUTING LIVE";

        const actionDesc = batchMode === 'MODEL'
            ? `set Model ID to '${batchReplacement}'`
            : `REPLACE text '${batchSearch}' with '${batchReplacement}'`;

        if (!window.confirm(`${modeText} batch: ${actionDesc}. Continue?`)) return;

        setLoading(true);
        try {
            let count = 0;
            if (batchMode === 'MODEL') {
                count = await TypesenseAdminService.batchUpdateModel(userId, batchSearch, batchReplacement, isDryRun);
            } else {
                count = await TypesenseAdminService.batchSanitizeContent(userId, batchSearch, batchReplacement, isDryRun);
            }

            alert(`${isDryRun ? '[DRY RUN]' : '[LIVE]'} Updated ${count} records.`);
            setBatchSearch('');
            if (!isDryRun) loadRecent();
        } catch (e: any) {
            console.error("Batch update failed:", e);
            alert(`Batch update failed: ${e.message}`);
        }
        finally { setLoading(false); }
    };

    const handleEnrich = async () => {
        if (!editingDoc || !editingDoc.content) return;
        setLoading(true);
        try {
            const metadata = await EnrichmentService.enrichSingleDocument(editingDoc.content);
            if (metadata) {
                setEditingDoc({
                    ...editingDoc,
                    keywords: metadata.keywords || [],
                    summary: metadata.summary || '',
                    sentiment: metadata.sentiment || '',
                    title: metadata.title || '',
                    is_fiction: metadata.is_fiction
                });
                alert("✨ Enriched! Review the tags and summary before saving.");
            } else {
                alert("Enrichment failed: AI returned no data.");
            }
        } catch (e) {
            console.error("Enrichment error:", e);
            alert("Enrichment failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full min-h-[500px] w-full bg-[#0a0c10] text-slate-200 font-mono text-sm rounded-lg border border-white/10 overflow-hidden shadow-2xl">

            {/* SAFETY CONTROL CENTER - HIGH VISIBILITY */}
            <div className={`p-4 flex justify-between items-center border-b transition-all duration-300 ${isDryRun ? 'bg-emerald-950/30 border-emerald-500/40' : 'bg-red-950/40 border-red-500/50'}`}>
                <div className="flex items-center gap-4">
                    {isDryRun ? <ShieldCheck className="text-emerald-400" size={24} /> : <ShieldAlert className="text-red-500 animate-pulse" size={24} />}
                    <div className="flex flex-col">
                        <span className={`text-xs font-black uppercase tracking-widest ${isDryRun ? 'text-emerald-400' : 'text-red-500'}`}>
                            {isDryRun ? "System Shield: Active" : "System Shield: Disengaged"}
                        </span>
                        <p className="text-[10px] text-slate-500 uppercase tracking-tighter">
                            {isDryRun ? "Writes are simulated & backed up" : "CAUTION: Destructive live updates enabled"}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsDryRun(!isDryRun)}
                    className={`px-6 py-2 rounded-md font-black text-xs uppercase transition-all shadow-lg active:scale-95 ${isDryRun ? 'bg-emerald-500 text-black hover:bg-emerald-400' : 'bg-red-600 text-white hover:bg-red-500'}`}
                >
                    {isDryRun ? "Arm Live Writes" : "Engage Safety"}
                </button>
            </div>

            {/* SEARCH & BATCH TRAY */}
            <div className="p-4 border-b border-white/10 space-y-4 bg-black/40">
                <div className="flex justify-between items-center px-1">
                    <div className="flex items-center gap-3">
                        <h2 className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em]">Neural Index Auditor v2.2</h2>
                        {isRootSession && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/20 border border-indigo-500/40 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.2)]">
                                <Shield size={10} className="text-indigo-400" />
                                <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">Global Root Access</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
                            <Database size={10} className="text-cyan-400" />
                            <span className="text-[9px] font-bold text-cyan-300 uppercase tracking-widest">{totalFound.toLocaleString()} Records</span>
                        </div>
                    </div>
                    <button onClick={loadRecent} className="p-1 hover:text-cyan-400 transition-colors">
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="flex flex-col gap-3">
                    <div className="relative">
                        <button
                            onClick={executeSearch}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 transition-colors"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                        </button>
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type 'unknown' & press ENTER for Live Search..."
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-11 pr-4 outline-none focus:border-cyan-500 text-sm placeholder:text-slate-600"
                        />
                    </div>

                    <div className="bg-cyan-900/10 border border-cyan-500/20 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <button
                            onClick={() => setBatchMode(m => m === 'MODEL' ? 'TEXT' : 'MODEL')}
                            className="text-[10px] font-black uppercase tracking-widest px-2 py-2 sm:py-1 bg-white/5 hover:bg-white/10 rounded text-cyan-500 min-w-[60px] text-center"
                        >
                            {batchMode}
                        </button>

                        <div className="flex gap-2 flex-1">
                            <input value={batchSearch} onChange={e => setBatchSearch(e.target.value)} placeholder={batchMode === 'MODEL' ? "Filter..." : "Find..."} className="flex-1 bg-black/60 border border-white/10 rounded px-3 py-2 text-xs outline-none focus:border-cyan-500 font-mono min-w-0" />
                            <span className="text-slate-600 self-center">→</span>
                            <input value={batchReplacement} onChange={e => setBatchReplacement(e.target.value)} placeholder={batchMode === 'MODEL' ? "Target..." : "Replace..."} className="flex-1 bg-black/60 border border-white/10 rounded px-3 py-2 text-xs outline-none focus:border-cyan-500 font-mono min-w-0" />
                        </div>

                        <button onClick={handleBatchReplace} className={`px-4 py-2.5 sm:py-2 rounded font-black text-xs uppercase tracking-widest transition-all ${isDryRun ? 'bg-cyan-700 text-cyan-100 hover:bg-cyan-600' : 'bg-red-700 text-white animate-pulse'}`}>
                            {isDryRun ? 'Sim' : 'Run'}
                        </button>
                    </div>
                </div>
            </div>

            {/* SCROLLABLE DOCUMENT LIST */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-black/20">
                {docs.length === 0 && !loading && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <AlertTriangle size={48} className="text-amber-500 mb-4 opacity-50" />
                        <p className="text-slate-400 uppercase tracking-widest text-xs font-bold">No Records Found</p>
                    </div>
                )}
                {docs.map(doc => {
                    const style = doc.is_core ? getCoreClasses(doc.sentiment) : { border: 'border-white/5', shadow: '', text: 'text-cyan-400', bg: 'bg-white/[0.02]' };
                    return (
                        <div
                            key={doc.id}
                            onClick={() => setEditingDoc(doc)}
                            className={`group p-4 rounded-xl border ${style.border} ${style.bg} hover:border-white/20 transition-all cursor-pointer ${style.shadow} hover:shadow-xl hover:-translate-y-1`}
                        >
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-1 rounded bg-black/40 ${doc.is_core ? style.text : 'text-slate-600'} break-all`}>
                                        {doc.id}
                                    </span>
                                    {doc.is_core && <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest ${style.text} whitespace-nowrap`}>
                                        <Anchor size={12} /> CORE
                                    </div>}
                                    <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${doc.user_id?.toLowerCase().includes('eric') ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-violet-500/10 border-violet-500/20 text-violet-400'}`}>
                                        Owner: {doc.user_id ? doc.user_id.substring(0, 8) + '...' : 'UNKNOWN'}
                                    </span>
                                </div>
                                <Edit3 size={14} className="opacity-0 group-hover:opacity-100 text-cyan-400 transition-opacity" />
                            </div>
                            <p className="text-[12px] leading-relaxed text-slate-300 line-clamp-2 mb-3 italic opacity-80">"{doc.content}"</p>

                            {/* TAGS ROW */}
                            <div className="flex flex-wrap gap-1 mb-3">
                                {(() => {
                                    const tags = doc.keywords || doc.search_metadata?.keywords || [];
                                    if (tags.length === 0) {
                                        return (
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] font-black text-amber-500 uppercase tracking-widest">
                                                <AlertTriangle size={10} /> Needs Enrichment
                                            </div>
                                        );
                                    }
                                    return tags.map((t: string, i: number) => (
                                        <span key={i} className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] text-slate-400 font-bold uppercase tracking-wide">
                                            {t}
                                        </span>
                                    ));
                                })()}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/5 pt-3">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-tighter shrink-0">
                                    <span className="opacity-40 font-normal whitespace-nowrap">Island:</span>
                                    <span className="text-slate-400">{doc.island_id || 'None'}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase font-bold tracking-tighter break-all">
                                    <span className="opacity-40 font-normal whitespace-nowrap">Model:</span>
                                    <span className="text-slate-400">{doc.model_id?.split('/').pop() || 'Unknown'}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* SIDE DRAWER ACCESSIBILITY EDITOR OVERLAY */}
            {
                editingDoc && (
                    <Portal>
                        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-xl flex justify-end animate-in fade-in duration-200" onClick={() => setEditingDoc(null)}>
                            <div
                                className="w-full max-w-2xl h-full flex flex-col bg-[#0d1117] border-l border-white/10 shadow-[-10px_0_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-300"
                                onClick={(e) => e.stopPropagation()}
                            >

                                {/* EDITOR HEADER: Locked Height */}
                                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/80 flex-shrink-0 z-50">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="p-2.5 bg-cyan-950/40 rounded-xl border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)] flex-shrink-0">
                                            <Edit3 className="text-cyan-400" size={24} strokeWidth={2.5} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-base font-black text-white uppercase tracking-[0.2em] truncate">Neural Node Edit</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-mono text-cyan-500/70 font-bold truncate tracking-widest">{editingDoc.id}</span>
                                                {editingDoc.is_core && <ShieldCheck size={12} className="text-amber-500" />}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setEditingDoc(null)}
                                        className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all active:scale-90 flex-shrink-0 ml-2"
                                    >
                                        <X size={26} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* EDITOR BODY: Scrollable, strict margins */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-black/20">

                                    {/* Top Controls: Island & Model */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                                                <Database size={12} /> Island
                                            </label>
                                            <input
                                                value={editingDoc.island_id || ''}
                                                onChange={(e) => setEditingDoc({ ...editingDoc, island_id: e.target.value.replace(/,/g, '').toUpperCase() })}
                                                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-cyan-400 focus:border-cyan-500 outline-none transition-all font-black uppercase tracking-widest shadow-inner"
                                                placeholder="UNASSOCIATED"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                                                <Edit3 size={12} /> Model Identity
                                            </label>
                                            <input
                                                value={editingDoc.model_id || ''}
                                                onChange={(e) => setEditingDoc({ ...editingDoc, model_id: e.target.value })}
                                                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white/80 focus:border-cyan-500 outline-none transition-all font-mono shadow-inner"
                                            />
                                        </div>
                                    </div>

                                    {/* Promote & Enrich Row */}
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <button
                                            onClick={() => setEditingDoc({ ...editingDoc, is_core: !editingDoc.is_core })}
                                            className={`w-full sm:w-auto sm:flex-1 flex items-center justify-center gap-3 rounded-xl px-8 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] ${editingDoc.is_core ? 'bg-amber-500 text-black' : 'bg-white/5 text-slate-500 border border-white/10 hover:border-amber-500/50'}`}
                                        >
                                            <Anchor size={18} /> {editingDoc.is_core ? 'CORE ANCHOR' : 'PROMOTE TO CORE'}
                                        </button>
                                        <button
                                            onClick={handleEnrich}
                                            disabled={loading}
                                            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50 active:scale-[0.98]"
                                        >
                                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                                            Neural Enrich
                                        </button>
                                    </div>

                                    {/* Main Content */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                                            <Edit3 size={12} /> Content Segment
                                        </label>
                                        <textarea
                                            value={editingDoc.content}
                                            onChange={(e) => setEditingDoc({ ...editingDoc, content: e.target.value })}
                                            className="w-full h-64 sm:h-80 bg-black/60 border border-white/10 rounded-2xl p-6 text-sm leading-relaxed text-slate-200 focus:border-cyan-500 outline-none transition-all resize-none shadow-2xl font-mono scrollbar-thin scrollbar-thumb-white/10"
                                        />
                                    </div>

                                    {/* Keywords Editor */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                                            <Zap size={12} /> Keywords
                                        </label>
                                        <div className="bg-black/60 border border-white/10 rounded-2xl p-5 shadow-inner">
                                            <div className="flex flex-wrap gap-2 mb-4 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                                {(editingDoc.keywords || []).map((k: string, i: number) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-cyan-900/30 border border-cyan-500/20 rounded-lg text-cyan-400 text-[10px] font-black uppercase tracking-widest group hover:border-red-500/50 hover:bg-red-900/40 transition-all cursor-pointer"
                                                        onClick={() => {
                                                            const newKeys = [...(editingDoc.keywords || [])];
                                                            newKeys.splice(i, 1);
                                                            setEditingDoc({ ...editingDoc, keywords: newKeys });
                                                        }}
                                                    >
                                                        {k} <X size={12} className="opacity-50 group-hover:text-red-500" />
                                                    </div>
                                                ))}
                                            </div>
                                            <input
                                                placeholder="ADD NEURAL TAG..."
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-3 text-xs font-black text-white uppercase tracking-widest outline-none focus:border-cyan-500 transition-all placeholder:text-slate-700 font-mono"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = (e.currentTarget.value || '').trim().toUpperCase();
                                                        if (val) {
                                                            const current = editingDoc.keywords || [];
                                                            if (!current.includes(val)) {
                                                                setEditingDoc({ ...editingDoc, keywords: [...current, val] });
                                                                e.currentTarget.value = '';
                                                            }
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* AI Summary */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 ml-1">
                                            <Zap size={12} /> AI Summary
                                        </label>
                                        <textarea
                                            value={editingDoc.summary || ''}
                                            onChange={(e) => setEditingDoc({ ...editingDoc, summary: e.target.value })}
                                            className="w-full h-32 bg-black/60 border border-white/10 rounded-xl p-5 text-sm leading-relaxed text-slate-400 focus:border-cyan-500 outline-none transition-all resize-none italic shadow-inner font-mono scrollbar-thin scrollbar-thumb-white/10"
                                        />
                                    </div>
                                </div>

                                {/* EDITOR ACTIONS: Locked Height */}
                                <div className="p-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-black/80 flex-shrink-0 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                                    <button
                                        onClick={() => handleDelete(editingDoc.id)}
                                        className="flex items-center justify-center gap-3 px-8 py-4 text-red-500 hover:bg-red-500/10 border border-red-500/20 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98]"
                                    >
                                        <Trash2 size={18} /> Delete Node
                                    </button>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setEditingDoc(null)}
                                            className="flex-1 px-6 py-4 text-slate-500 font-black text-xs uppercase tracking-widest hover:text-white transition-all"
                                        >
                                            Abort
                                        </button>
                                        <button
                                            onClick={handleUpdate}
                                            className={`flex-[2] sm:flex-none flex items-center justify-center gap-4 px-12 py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] ${isDryRun ? 'bg-emerald-600 text-white hover:bg-emerald-400' : 'bg-cyan-600 text-white hover:bg-cyan-500 animate-pulse'}`}
                                        >
                                            <Save size={22} /> {isDryRun ? 'Simulate' : 'Commit Changes'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Portal>
                )
            }
        </div >
    );
};