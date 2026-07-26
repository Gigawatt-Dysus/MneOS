import React, { useState, useEffect } from 'react';
import { BookOpen, Database, Sparkles, Terminal, Activity, ShieldAlert, Key } from 'lucide-react';
import { EnrichmentService } from '../../../services/enrichmentService';
import { reindexChatSegments, reindexGlobal, hydrateUserFullProfile } from '../../../services/searchService';
import { TypesenseManager } from '../../dev/TypesenseManager';
import { isRootUser } from '../../../utils/rbac';
import { TypesenseAdminService } from '../../../services/TypesenseAdminService';
import type { User } from '../../../types';

interface LibrarianSubTabProps {
    user: Pick<User, 'id'>;
    addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const LibrarianSubTab: React.FC<LibrarianSubTabProps> = ({ user, addToast }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        // [DEBUG] Verify Service Links
        console.log("✅ Librarian Ready. User:", user?.id);
        if (!EnrichmentService) console.error("❌ EnrichmentService Missing!");
        if (!reindexChatSegments) console.error("❌ SearchService Missing!");
    }, [user]);

    const appendLog = (msg: string) => {
        console.log(`[Librarian] ${msg}`);
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100));
    };

    const handleRunLibrarian = async () => {
        console.log("--> Starting Librarian <--");
        if (isProcessing) return;

        const targetUserId = user?.id || 'unknown';
        if (targetUserId === 'unknown') {
            appendLog("❌ Error: No User ID. Are you logged in?");
            return;
        }

        setIsProcessing(true);
        setLogs([]); // Clear logs
        appendLog(`=== 📖 STARTING LIBRARIAN PROTOCOL ===`);
        appendLog(`Target User: ${targetUserId.substring(0, 8)}...`);

        try {
            if (!EnrichmentService) throw new Error("EnrichmentService not loaded.");

            // 1. Run the Service
            const result = await EnrichmentService.enrichMemoryBank(targetUserId, (statusMsg) => {
                appendLog(`> ${statusMsg}`);
            });

            // 2. Handle Result
            if (result.success) {
                appendLog(`✅ COMPLETE: Enriched ${result.count} memories.`);
                addToast(`Success! Processed ${result.count} items.`, 'success');
            } else {
                appendLog(`❌ ERROR: ${result.error}`);
                addToast("Librarian failed.", 'error');
            }
        } catch (err: any) {
            console.error(err);
            appendLog(`❌ CRITICAL FAILURE: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRunHydrator = async () => {
        console.log("--> Starting Master Hydrator <--");
        if (isProcessing) return;

        const targetUserId = user?.id || 'unknown';
        if (targetUserId === 'unknown') {
            appendLog("❌ Error: No User ID.");
            return;
        }

        setIsProcessing(true);
        appendLog(`=== 💧 STARTING MASTER HYDRATION PROTOCOL ===`);
        appendLog(`Target User: ${targetUserId}`);
        appendLog(`Scope: Chat + Daydreams + TimeVortex + People`);

        try {
            const result = await hydrateUserFullProfile(targetUserId);

            if (result.success) {
                appendLog(`✅ HYDRATION COMPLETE.`);
                appendLog(`Stats: ${result.stats}`);
                addToast(`Full Restore Success: ${result.stats}`, 'success');
            } else {
                appendLog(`❌ HYDRATION FAILED: ${result.stats}`);
                addToast("Hydration failed.", 'error');
            }
        } catch (err: any) {
            console.error(err);
            appendLog(`❌ CRITICAL FAILURE: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleGlobalSync = async () => {
        console.log("--> Starting Global Sync <--");
        if (isProcessing) return;
        if (!window.confirm("NUCLEAR PROTOCOL: This will synchronize EVERY user's records to the Typesense Cloud. Proceed?")) return;

        setIsProcessing(true);
        appendLog("=== 🌍 STARTING GLOBAL PULSE SYNC ===");
        try {
            const targetUserId = user?.id || 'unknown';
            const result = await reindexGlobal(targetUserId);
            if (result.success) {
                appendLog(`✅ GLOBAL SYNC COMPLETE: ${result.count} records bridged.`);
                addToast(`Global Sync Success: ${result.count} records.`, 'success');
            } else {
                appendLog(`❌ GLOBAL SYNC FAILED: ${result.error}`);
                addToast("Global Sync failed.", 'error');
            }
        } catch (err: any) {
            appendLog(`❌ FAILURE: ${err.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRescueData = async () => {
        console.log("--> Starting Rescue Protocol <--");
        if (isProcessing) return;

        const confirm = window.confirm("WARNING: This will overwrite local Firestore data with Typesense Cloud data. Local backups will be created. Continue?");
        if (!confirm) return;

        const targetUserId = user?.id || 'unknown';
        setIsProcessing(true);
        appendLog("=== 🚑 STARTING RESCUE PROTOCOL ===");
        appendLog("Downloading Cloud Data...");

        try {
            // Run Rescue Service
            const count = await TypesenseAdminService.rescueCloudData(targetUserId, (msg) => {
                appendLog(`> ${msg}`);
            });

            appendLog(`✅ RESCUE COMPLETE: Synced ${count} records.`);
            addToast(`Rescue Success: ${count} records synced.`, 'success');
        } catch (err: any) {
            console.error(err);
            appendLog(`❌ RESCUE FAILED: ${err.message}`);
            addToast("Rescue failed.", 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-4 relative z-10 p-0 sm:p-1">

            {/* [ZEN FIX] POSITIONED AT TOP FOR VISIBILITY FOR LEGALLY BLIND USER */}
            <div className="bg-black/60 border-2 border-cyan-500/50 rounded-xl p-3 sm:p-4 shadow-2xl mb-4 sm:mb-8">
                <div className="flex items-center gap-3 mb-4 sm:mb-6 px-1 sm:px-2 border-b border-cyan-500/20 pb-4">
                    <Activity className="text-cyan-400" size={24} strokeWidth={3} />
                    <h3 className="text-lg font-black text-white uppercase tracking-[0.2em]">
                        1. Typesense Neural Auditor
                    </h3>
                </div>
                {/* [ZEN FIX] Correcting Prop Mismatch */}
                <TypesenseManager userId={user.id} />
            </div>

            <hr className="border-white/10 my-8" />

            {/* Header for original tools */}
            <div className="flex items-center justify-between p-4 bg-violet-900/20 border border-violet-500/30 rounded-lg">
                <div>
                    <h3 className="text-lg font-bold text-violet-100 flex items-center gap-2">
                        <Sparkles className="text-violet-400" size={20} /> 2. Memory Architect
                    </h3>
                    <p className="text-xs text-violet-300/80 mt-1">
                        Metadata Enrichment & Search Indexing
                    </p>
                </div>
                {isProcessing && <span className="text-xs font-mono text-emerald-400 animate-pulse">ACTIVE...</span>}
            </div>

            {/* Controls */}
            <div className="grid grid-cols-2 gap-4">

                {/* LIBRARIAN BUTTON */}
                <button
                    type="button"
                    onClick={handleRunLibrarian}
                    disabled={isProcessing}
                    className="p-4 bg-black/40 hover:bg-violet-900/40 border border-white/10 hover:border-violet-500 rounded-lg text-left transition-colors relative active:scale-95 duration-75"
                    style={{ cursor: isProcessing ? 'wait' : 'pointer' }}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-violet-500/10 rounded-md">
                            <BookOpen size={20} className="text-violet-400" />
                        </div>
                        <span className="font-bold text-sm text-slate-200">Run Librarian</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                        Scans Firestore. Sends raw text to AI (Fireworks/Reserve). Generates Titles, Keywords & Sentiment.
                    </p>
                </button>

                {/* HYDRATOR BUTTON */}
                <button
                    type="button"
                    onClick={handleRunHydrator}
                    disabled={isProcessing}
                    className="p-4 bg-black/40 hover:bg-emerald-900/40 border border-white/10 hover:border-emerald-500 rounded-lg text-left transition-colors relative active:scale-95 duration-75"
                    style={{ cursor: isProcessing ? 'wait' : 'pointer' }}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-md">
                            <Database size={20} className="text-emerald-400" />
                        </div>
                        <span className="font-bold text-sm text-slate-200">Run Hydrator</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                        Reads enriched data from Firestore. Pushes to Typesense Cloud (Collection: v2_robust).
                    </p>
                </button>

                {isRootUser() && (
                    <button
                        type="button"
                        onClick={handleGlobalSync}
                        disabled={isProcessing}
                        className="col-span-2 p-4 bg-indigo-900/40 hover:bg-indigo-800/50 border border-indigo-500/50 rounded-xl text-left transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-indigo-500/20 rounded-lg">
                                <Sparkles size={20} className="text-indigo-400" />
                            </div>
                            <span className="font-black text-sm text-indigo-100 uppercase tracking-widest underline decoration-indigo-500/50 underline-offset-4">GLOBAL PULSE SYNC (ROOT)</span>
                        </div>
                        <p className="text-[10px] text-indigo-300/70 leading-relaxed font-bold italic">
                            [ISABELLA GAP REPAIR] - Scans all user nodes in the cluster and forces a full cloud synchronization.
                        </p>
                    </button>
                )}

                {/* RESCUE BUTTON (Emergency Reverse Sync) */}
                <button
                    type="button"
                    onClick={handleRescueData}
                    disabled={isProcessing}
                    className="col-span-2 p-4 bg-red-950/30 hover:bg-red-900/40 border border-red-500/20 hover:border-red-500 rounded-lg text-left transition-colors relative active:scale-95 duration-75 mt-4"
                    style={{ cursor: isProcessing ? 'wait' : 'pointer' }}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-500/10 rounded-md">
                            <ShieldAlert size={20} className="text-red-400" />
                        </div>
                        <span className="font-bold text-sm text-red-200">EMERGENCY RESCUE: Sync Cloud to Local</span>
                    </div>
                    <p className="text-[10px] text-red-400/70 leading-relaxed">
                        Pulls ALL data from Typesense Cloud and overwrites Firestore. Use this to save manual edits made in the cloud. Backs up local data first.
                    </p>
                </button>
            </div>

            {/* Console Output */}
            <div className="bg-black/80 rounded-lg border border-white/10 overflow-hidden font-mono text-xs shadow-inner">
                <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex items-center gap-2">
                    <Terminal size={12} className="text-slate-500" />
                    <span className="text-slate-400 font-bold">System Log</span>
                </div>
                <div className="h-48 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
                    {logs.length === 0 ? (
                        <div className="flex flex-col gap-2 opacity-50">
                            <span className="text-slate-500 italic">Ready for commands...</span>
                            <span className="text-[10px] text-slate-600">User ID: {user?.id}</span>
                        </div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className={`border-l-2 pl-2 mb-1 ${log.includes('❌') ? 'border-red-500 text-red-400' :
                                log.includes('✅') ? 'border-emerald-500 text-emerald-400' :
                                    log.includes('===') ? 'border-violet-500 text-violet-300 font-bold mt-3 mb-2' :
                                        log.includes('>') ? 'border-slate-700 text-slate-400' :
                                            'border-slate-700 text-slate-300'
                                }`}>
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div >
    );
};