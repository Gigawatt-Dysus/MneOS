import React, { useState } from 'react';
import { Key, Terminal, Activity, AlertTriangle, ShieldCheck, Database, Brain, Compass, MapPin, Wrench } from 'lucide-react';
import type { User } from '../../../types';

import { POISON_PATTERNS, sanitizerService, PoisonedMessage } from '../../../services/ai/sanitizer';
import { Eraser, Skull, Play, StopCircle, RefreshCw, Scissors, Brush } from 'lucide-react';
import { formatLifeOSDate } from '../../../utils/dateSanitizer';

import { AvatarJanitor } from '../../admin/AvatarJanitor';
import { TagSurgeonModal } from '../../admin/TagSurgeonModal';
import { ChronoMedic } from '../../admin/ChronoMedic';

interface MaintenanceSubTabProps {
    user: Pick<User, 'id'>;
    addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
    tags?: any[];
}

export const MaintenanceSubTab: React.FC<MaintenanceSubTabProps> = ({ user, addToast, tags = [] }) => {
    const [showTagSurgeon, setShowTagSurgeon] = useState(false);
    const [showAvatarJanitor, setShowAvatarJanitor] = useState(false);
    const [showChronoMedic, setShowChronoMedic] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const appendLog = (msg: string) => {
        console.log(`[Maintenance] ${msg}`);
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    };

    // [ZEN V25] Limbic Sanitizer State
    const [sanitizerPatterns, setSanitizerPatterns] = useState(Object.values(POISON_PATTERNS).join('\n'));
    const [poisonList, setPoisonList] = useState<PoisonedMessage[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isHealing, setIsHealing] = useState(false);
    const stopBatchRef = React.useRef(false); // Use ref for instant interrupt
    const [dryRun, setDryRun] = useState(true);

    const handleScan = async () => {
        if (!user.id) return;
        setIsScanning(true);
        setPoisonList([]);
        appendLog("🔍 SCANNING: Looking for limbic poison...");

        try {
            const patterns = sanitizerPatterns.split('\n').filter(p => p.trim().length > 0);
            const results = await sanitizerService.scanHistory(user.id, patterns);
            setPoisonList(results);
            if (results.length > 0) {
                appendLog(`⚠️ EXPOSED ${results.length} candidates.`);
                addToast(`Scan complete: ${results.length} candidates found.`, 'info');
            } else {
                appendLog("✅ SCAN COMPLETE: No poison found.");
                addToast("Clean scan.", 'success');
            }
        } catch (e: any) {
            appendLog(`❌ Scan Error: ${e.message}`);
        } finally {
            setIsScanning(false);
        }
    };

    // [ZEN V26] Surgical Review State
    const [healingReviewMap, setHealingReviewMap] = useState<Record<string, { original: string, healed: string }>>({});

    const handleHealOne = async (msg: PoisonedMessage) => {
        if (!user || !user.id || user.id === 'unknown') return;

        addToast("Contacting AI Surgeon...", 'info');
        appendLog(`🩹 [Step 1] Requesting AI (Patterns: ${sanitizerPatterns.split('\n').length})...`);

        try {
            const patterns = sanitizerPatterns.split('\n').filter(p => p.trim().length > 0);
            const healedContent = await sanitizerService.healMessage(msg as any, patterns);

            if (!healedContent) throw new Error("AI returned empty string");

            appendLog(`✅ [Step 2] AI Proposed Fix. Length: ${healedContent.length}. WAITING FOR REVIEW.`);

            // Enter Review Mode
            setHealingReviewMap(prev => ({
                ...prev,
                [msg.id]: { original: msg.originalContent, healed: healedContent }
            }));

        } catch (e: any) {
            console.error(e);
            appendLog(`❌ Heal Failed: ${e.message}`);
            addToast(`Error: ${e.message.substring(0, 100)}`, 'error');
        }
    };

    const handleConfirmHeal = async (msg: PoisonedMessage, finalContent: string) => {
        try {
            appendLog(`💾 [Step 3] Stitched by User. Committing...`);
            await sanitizerService.commitHealing(user.id!, msg as any, finalContent);
            appendLog(`✅ [Step 4] Commit Success.`);

            // Cleanup
            setPoisonList(prev => prev.filter(p => p.id !== msg.id));
            setHealingReviewMap(prev => {
                const next = { ...prev };
                delete next[msg.id];
                return next;
            });
            addToast("Healed 1 message.", 'success');
        } catch (e: any) {
            appendLog(`❌ Commit Failed: ${e.message}`);
            addToast(`Error: ${e.message}`, 'error');
        }
    };

    const handleCancelHeal = (msgId: string) => {
        setHealingReviewMap(prev => {
            const next = { ...prev };
            delete next[msgId];
            return next;
        });
        appendLog("🚫 Changes discarded.");
    };

    const handleHealAll = async () => {
        if (!user.id || poisonList.length === 0) return;
        if (!confirm(`Confirm batch heal for ${poisonList.length} messages? This uses Grok 4.1 tokens.`)) return;

        setIsHealing(true);
        stopBatchRef.current = false;
        appendLog("🚑 BATCH HEAL INITIATED...");

        const queue = [...poisonList];
        let healedCount = 0;

        for (const msg of queue) {
            if (stopBatchRef.current) {
                appendLog("🛑 BATCH STOPPED BY USER.");
                break;
            }

            await handleHealOne(msg);
            healedCount++;

            // Small throttle to prevent extensive rate limiting
            await new Promise(r => setTimeout(r, 500));
        }

        setIsHealing(false);
        if (healedCount === queue.length) {
            appendLog("✨ ALL POISON PURGED.");
            addToast("Batch complete.", 'success');
        }
    };



    const handleKeyRepair = async () => {
        if (!user.id || user.id === 'unknown') {
            appendLog("❌ Error: Identity not confirmed. Please log in again.");
            return;
        }

        setIsProcessing(true);
        appendLog("=== 🔑 INITIATING NEURAL KEY REPAIR ===");
        appendLog("Synchronizing House Keys from secure vault...");

        try {
            // 1. PHASE ONE: KEY RECONCILIATION
            const { OnboardingService } = await import('../../../services/onboardingService');
            const { resetTypesenseClient } = await import('../../../services/searchService');

            appendLog("🔑 Phase 1: Rebuilding House Keys...");
            await OnboardingService.provisionUser(user.id, '', false, true); // Force synchronization
            resetTypesenseClient(); // Ensure fresh connection
            appendLog("✅ House Keys synchronized.");

            // 2. PHASE TWO: TYPESENSE RE-INDEXING & NEURAL MIGRATION
            const { reindexChatSegments } = await import('../../../services/searchService');
            appendLog("🛰️ Phase 2: Pushing signals & Migrating legacy vaults...");
            const reindexResult = await reindexChatSegments(user.id);

            if (reindexResult.success) {
                appendLog(`✅ Sync complete. ${reindexResult.count} records synchronized.`);
            } else {
                throw new Error(reindexResult.error || "Re-indexing failed.");
            }

            // 3. PHASE THREE: AI ENRICHMENT (HEALING ZOMBIES)
            const { EnrichmentService } = await import('../../../services/enrichmentService');
            appendLog("🧠 Phase 3: Healing new and un-indexed AI segments...");
            const enrichmentResult = await EnrichmentService.enrichMemoryBank(user.id, (msg) => appendLog(`└ ${msg}`));

            if (enrichmentResult.success) {
                appendLog(`✅ SUCCESS: ${enrichmentResult.count} records healed and processed.`);
                addToast(`Neural Repair Complete: ${reindexResult.count} signals restored.`, 'success');
            } else {
                appendLog(`⚠️ AI Enrichment skipped/failed: ${enrichmentResult.error}`);
            }

        } catch (e: any) {
            console.error(e);
            appendLog(`❌ REPAIR FAILED: ${e.message}`);
            addToast("Key Repair failed.", 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    // [ZEN FIX] Restored Highlighter, safely.
    const renderHighlightedContent = (content: string, patterns: string[]) => {
        if (!content || !patterns || patterns.length === 0) return content;

        try {
            // 1. Clean patterns for display regex (remove flags like /gi)
            const cleanPatterns = patterns.map(p => {
                let nav = p.replace(/^\//, '').replace(/\/[a-z]*$/, '');
                // [ZEN FIX] Convert inner capturing groups ( ) to non-capturing (?: )
                // to prevent String.split from outputting double tokens (the "Hall of Mirrors" bug).
                nav = nav.replace(/\((?!\?)/g, '(?:');
                return nav;
            }).filter(p => p.length > 0);

            if (cleanPatterns.length === 0) return content;

            // 2. Create a single master regex for splitting
            const regex = new RegExp(`(${cleanPatterns.join('|')})`, 'gi');



            // 3. Split and map
            // Filter undefined/empty parts that split sometimes produces with complex groups
            const parts = content.split(regex).filter(p => p !== undefined);

            return (
                <span>
                    {parts.map((part, i) => {
                        const isMatch = cleanPatterns.some(p => new RegExp(`^${p}$`, 'i').test(part));
                        return isMatch ? (
                            <span key={i} className="bg-rose-500/30 text-rose-200 px-1 rounded font-bold border-b-2 border-rose-500 mx-0.5">
                                {part}
                            </span>
                        ) : (
                            <span key={i}>{part}</span>
                        );
                    })}
                </span>
            );
        } catch (e) {
            console.error("Highlighter broke:", e);
            return content; // Fallback to plain text
        }
    };

    return (
        <div className="space-y-6">
            {/* Header / Intro */}
            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 flex gap-4 items-start">
                <div className="p-2 bg-cyan-500/10 rounded-lg shrink-0">
                    <ShieldCheck className="text-cyan-400" size={24} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Neural Diagnostics</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Use these tools if your chat history is not appearing in search results or if the AI seems to have lost its memory of past events.
                    </p>
                </div>
            </div>

            {/* Legacy Admin Tools (Moved from Matrix) */}
            <div className="bg-black/40 border border-white/5 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-colors mb-6">
                <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-md">
                            <Wrench size={20} className="text-amber-400" />
                        </div>
                        <span className="font-bold text-sm text-slate-200">Legacy Forensic Tools</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        Older surgical tools used for specific bug hunts.
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowChronoMedic(true)}
                            className="flex-1 py-3 bg-indigo-900/80 hover:bg-indigo-600 text-white rounded-lg border border-indigo-400/30 transition-all font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            <Activity size={14} /> Chrono-Medic
                        </button>
                        <button
                            onClick={() => setShowTagSurgeon(true)}
                            className="flex-1 py-3 bg-rose-900/80 hover:bg-rose-600 text-white rounded-lg border border-rose-400/30 transition-all font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            <Scissors size={14} /> Tag Surgeon
                        </button>
                        <button
                            onClick={() => setShowAvatarJanitor(true)}
                            className="flex-1 py-3 bg-amber-900/80 hover:bg-amber-600 text-white rounded-lg border border-amber-400/30 transition-all font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            <Brush size={14} /> Clean Up Avatars
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals for Legacy Tools */}
            {showChronoMedic && <div className="fixed inset-0 z-[100000] bg-black/95 backdrop-blur-xl p-8 flex flex-col animate-in fade-in zoom-in-95 duration-200"><ChronoMedic userId={user.id!} onClose={() => setShowChronoMedic(false)} /></div>}
            {showAvatarJanitor && <AvatarJanitor userId={user.id!} onClose={() => setShowAvatarJanitor(false)} />}
            {showTagSurgeon && (
                <TagSurgeonModal
                    userId={user.id!}
                    tags={tags}
                    onClose={() => setShowTagSurgeon(false)}
                    addToast={addToast}
                />
            )}

            {/* Core Tool */}
            <div className="bg-black/40 border border-white/5 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-colors">
                <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/10 rounded-md">
                            <Key size={20} className="text-cyan-400" />
                        </div>
                        <span className="font-bold text-sm text-slate-200">Verify & Repair House Keys</span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        This will re-synchronize your account with the official system credentials.
                        It resolves issues where your messages are successfully saved to the database but fail to be "indexed" for search.
                    </p>

                    <button
                        onClick={handleKeyRepair}
                        disabled={isProcessing}
                        className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] ${isProcessing
                            ? 'bg-slate-800 text-slate-500 cursor-wait'
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
                            }`}
                    >
                        {isProcessing ? 'Synchronizing...' : 'Run Neural Repair'}
                    </button>

                    {/* [ZEN NEW] Connectivity Test */}
                    <button
                        onClick={async () => {
                            setIsProcessing(true);
                            try {
                                const { callXAI } = await import('../../../services/ai/providers');
                                const { getXAIModelId } = await import('../../../services/ai/config');
                                const targetModel = getXAIModelId();

                                appendLog(`📡 Testing xAI Connection (${targetModel})...`);
                                const res = await callXAI(targetModel, [{ role: 'user', parts: [{ text: "ping" }] }], "System Check");
                                appendLog(`✅ xAI Online: "${res.text}"`);
                                addToast("xAI Connection Secure.", 'success');
                            } catch (e: any) {
                                appendLog(`❌ xAI Connection Failed: ${e.message}`);
                                addToast(`xAI Error: ${e.message}`, 'error');
                            } finally {
                                setIsProcessing(false);
                            }
                        }}
                        disabled={isProcessing}
                        className="w-full mt-2 py-2 rounded-lg font-bold text-[10px] uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                    >
                        Test xAI Connection
                    </button>

                    {!isProcessing && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 justify-center">
                            <AlertTriangle size={12} className="text-amber-500/50" />
                            <span>Safe to run. Does not affect your chat history content.</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Simplified Console */}
            <div className="bg-black/60 rounded-xl border border-white/10 overflow-hidden font-mono text-[10px] shadow-inner mb-6">
                <div className="bg-white/5 px-4 py-2 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Terminal size={12} className="text-slate-500" />
                        <span className="text-slate-400 font-bold uppercase tracking-tighter">Diagnostic Log</span>
                    </div>
                </div>
                <div className="h-24 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                    {logs.length === 0 ? (
                        <div className="opacity-30 italic text-slate-600">No diagnostic data yet...</div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className={`border-l-2 pl-2 ${log.includes('❌') ? 'border-red-500/50 text-red-400' :
                                log.includes('✅') ? 'border-emerald-500/50 text-emerald-400' :
                                    log.includes('===') ? 'border-cyan-500/50 text-cyan-300 font-bold' :
                                        'border-slate-800 text-slate-500'
                                }`}>
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* [ZEN V25] LIMBIC SANITIZER (Historical Purge) */}
            <div className="bg-rose-950/10 border border-rose-500/20 rounded-xl overflow-hidden hover:border-rose-500/40 transition-colors mb-6">
                <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-500/10 rounded-md">
                            <Skull size={20} className="text-rose-400" />
                        </div>
                        <div className="flex-1">
                            <span className="font-bold text-sm text-slate-200">Limbic Sanitizer</span>
                            <p className="text-[10px] text-rose-300/60 uppercase tracking-widest font-bold">Remove "Thousand Suns" & AI-Isms</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] text-slate-500 font-bold uppercase">Poison Patterns (Regex)</label>
                            <button
                                onClick={() => setSanitizerPatterns(Object.values(POISON_PATTERNS).join('\n'))}
                                className="text-[10px] text-rose-400/60 hover:text-rose-400 hover:underline transition-colors"
                            >
                                Reset to Defaults
                            </button>
                        </div>
                        <textarea
                            value={sanitizerPatterns}
                            onChange={(e) => setSanitizerPatterns(e.target.value)}
                            className="w-full h-24 bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] font-mono text-emerald-400 focus:outline-none focus:border-rose-500/50 resize-y custom-scrollbar"
                            placeholder="/pattern/gi"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleScan}
                            disabled={isScanning || isHealing}
                            className={`flex-1 py-3 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isScanning ? 'bg-slate-800 text-slate-500' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                                }`}
                        >
                            {isScanning ? <RefreshCw className="animate-spin" size={14} /> : <Play size={14} />}
                            {isScanning ? 'Scanning...' : 'Dry Run (Scan)'}
                        </button>

                        <button
                            onClick={async () => {
                                if (!user.id) return;
                                setIsScanning(true);
                                setPoisonList([]);
                                appendLog("🚑 HUNTING FOR VICTIMS (Recoverable)...");
                                try {
                                    const results = await sanitizerService.findHealedWithSnapshot(user.id);
                                    setPoisonList(results);
                                    if (results.length > 0) {
                                        appendLog(`⚠️ FOUND ${results.length} RECOVERABLE MESSAGES.`);
                                        addToast(`Found ${results.length} victims.`, 'info');
                                    } else {
                                        appendLog("It appears no messages have backups available.");
                                        addToast("No backups found.", 'info');
                                    }
                                } catch (e: any) {
                                    appendLog(`❌ Recovery Scan Error: ${e.message}`);
                                } finally {
                                    setIsScanning(false);
                                }
                            }}
                            className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 rounded-lg hover:bg-amber-500/20"
                            title="Find healed messages (even undefined ones) to undo them"
                        >
                            <ShieldCheck size={18} />
                        </button>

                        {isHealing ? (
                            <button
                                onClick={() => { stopBatchRef.current = true; }}
                                className="flex-1 py-3 bg-red-600 text-white rounded-lg font-black text-xs uppercase tracking-widest hover:bg-red-500 flex items-center justify-center gap-2"
                            >
                                <StopCircle size={14} /> STOP BATCH
                            </button>
                        ) : (
                            poisonList.length > 0 && (
                                <button
                                    onClick={handleHealAll}
                                    className="flex-1 py-3 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-rose-500/30 flex items-center justify-center gap-2"
                                >
                                    <Eraser size={14} /> Heal All ({poisonList.length})
                                </button>
                            )
                        )}
                    </div>

                    {/* Results List */}
                    {poisonList.length > 0 && (
                        <div className="mt-4 border-t border-white/5 pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-[10px] text-slate-400 font-bold uppercase">Detailed Findings ({poisonList.length})</h4>
                                {/* [ZEN RESCUE] Mass Restore Button */}
                                <button
                                    onClick={async () => {
                                        if (confirm(`MASS RESTORE: Are you sure you want to revert ALL ${poisonList.length} messages to their original snapshots?`)) {
                                            setIsProcessing(true);
                                            try {
                                                const count = await sanitizerService.restoreAllSnapshots(user.id);
                                                addToast(`Successfully restored ${count} messages.`, 'success');
                                                appendLog(`✅ MASS RESTORE COMPLETE: ${count} records reverted.`);

                                                // [ZEN FIX] Refresh the list so we don't heal stale/restored items
                                                handleScan();
                                            } catch (e: any) {
                                                addToast(`Restore Failed: ${e.message}`, 'error');
                                            } finally {
                                                setIsProcessing(false);
                                            }
                                        }
                                    }}
                                    className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-emerald-500/30 transition-colors"
                                >
                                    Restore All Snapshots
                                </button>
                            </div>
                            <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                                {poisonList.map((msg) => (
                                    <div key={msg.id} className="bg-black/30 border border-rose-900/30 p-3 rounded-lg space-y-2 group">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                {formatLifeOSDate(msg.timestamp, 'day')}
                                            </span>
                                            {healingReviewMap[msg.id] ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleConfirmHeal(msg, healingReviewMap[msg.id].healed);
                                                        }}
                                                        className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded uppercase hover:bg-emerald-500/40 transition-colors border border-emerald-500/30"
                                                    >
                                                        Save Fix
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCancelHeal(msg.id);
                                                        }}
                                                        className="px-3 py-1 bg-slate-700 text-slate-400 text-[10px] font-bold rounded uppercase hover:bg-slate-600 transition-colors"
                                                    >
                                                        Discard
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleHealOne(msg);
                                                        }}
                                                        disabled={isHealing}
                                                        className="opacity-100 z-50 relative px-3 py-1 bg-rose-500/20 text-rose-300 text-[10px] font-bold rounded uppercase hover:bg-rose-500/40 hover:text-white transition-colors border border-rose-500/30 active:scale-95 cursor-pointer"
                                                    >
                                                        Heal This
                                                    </button>

                                                    {/* [ZEN FIX] Rollback Button */}
                                                    {msg.originalContentSnapshot && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (confirm("Revert to pre-healing snapshot?")) {
                                                                    sanitizerService.rollbackHealing(user.id, msg.id, msg.originalContentSnapshot!)
                                                                        .then(() => {
                                                                            addToast("Rolled back 1 message.", 'success');
                                                                            handleScan(); // Refresh list
                                                                        })
                                                                        .catch(err => addToast(err.message, 'error'));
                                                                }
                                                            }}
                                                            className="opacity-100 z-50 relative px-3 py-1 bg-slate-700 text-slate-300 text-[10px] font-bold rounded uppercase hover:bg-slate-600 transition-colors border border-slate-600 active:scale-95 cursor-pointer"
                                                        >
                                                            Undo
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {/* Diff-like view: Highlight findings */}
                                        {healingReviewMap[msg.id] ? (
                                            <div className="mt-2 space-y-2">
                                                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                                    <span>Original Poison</span>
                                                    <span className="text-emerald-500">Proposed Fix (Editable)</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-red-950/20 p-2 rounded border border-red-500/10 text-[11px] text-slate-400 font-serif opacity-70">
                                                        {renderHighlightedContent(healingReviewMap[msg.id].original, sanitizerPatterns.split('\n'))}
                                                    </div>
                                                    <textarea
                                                        value={healingReviewMap[msg.id].healed}
                                                        onChange={(e) => setHealingReviewMap(prev => ({
                                                            ...prev,
                                                            [msg.id]: { ...prev[msg.id], healed: e.target.value }
                                                        }))}
                                                        className="bg-emerald-950/20 w-full h-full min-h-[100px] p-2 rounded border border-emerald-500/30 text-[11px] text-emerald-100 font-serif focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 resize-y"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-[13px] text-slate-300 leading-relaxed font-sans font-medium">
                                                {renderHighlightedContent(msg.originalContent, sanitizerPatterns.split('\n'))}
                                            </p>
                                        )}

                                        {/* [ZEN DEBUG] Content Snapshot Inspector */}
                                        <div className="mt-2 pt-2 border-t border-white/5 bg-black/40 p-2 rounded text-[10px] font-mono text-slate-500 overflow-x-auto">
                                            <span className="text-emerald-500 font-bold block mb-1">RAW SNAPSHOT DATA:</span>
                                            {msg.originalContentSnapshot ? `"${msg.originalContentSnapshot}"` : <span className="text-red-500">NULL/User Undefined</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* [ZEN NEW] THE ARCHIVIST (Metadata Healer) */}
            <div className="bg-black/40 border border-white/5 rounded-xl overflow-hidden hover:border-emerald-500/30 transition-colors mb-6">
                <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-md">
                            <Brain size={20} className="text-emerald-400" />
                        </div>
                        <span className="font-bold text-sm text-slate-200">The Archivist (Metadata Healer)</span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        Scans for "hollow" chat segments that are missing keywords or summaries.
                        Uses AI to read them, generate metadata, and sync them to the Search Index.
                    </p>

                    <button
                        onClick={async () => {
                            if (!user.id || user.id === 'unknown') return;
                            setIsProcessing(true);
                            appendLog("📜 Summoning The Archivist...");
                            try {
                                const { runArchivist } = await import('../../../services/archivist');
                                const stats = await runArchivist(user.id);

                                if (stats.healed > 0) {
                                    appendLog(`✅ Archivist Complete. Healed ${stats.healed} documents.`);
                                    addToast(`Healed ${stats.healed} memories.`, "success");
                                } else {
                                    appendLog("✅ Archive is healthy. No hollow records found.");
                                    addToast("Archive healthy.", "info");
                                }

                                if (stats.errors.length > 0) {
                                    appendLog(`⚠️ ${stats.errors.length} errors occurred during healing.`);
                                }

                            } catch (e: any) {
                                appendLog(`❌ Archivist Failed: ${e.message}`);
                                addToast("Healer failed.", "error");
                            } finally {
                                setIsProcessing(false);
                            }
                        }}
                        disabled={isProcessing}
                        className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] ${isProcessing
                            ? 'bg-slate-800 text-slate-500 cursor-wait'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                            }`}
                    >
                        {isProcessing ? 'Healing Archive...' : 'Run Metadata Healer'}
                    </button>
                </div>
            </div>

            {/* Spatial & Temporal Auto-Stitcher */}
            <div className="bg-black/40 border border-white/5 rounded-xl overflow-hidden hover:border-cyan-500/30 transition-colors mb-6">
                <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/10 rounded-md">
                            <Compass size={20} className="text-cyan-400" />
                        </div>
                        <span className="font-bold text-sm text-slate-200">Spatial & Temporal Auto-Stitcher</span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        Performs dynamic spatial location propagation and reciprocal Place tagging across your archive.
                        Scans for unlinked temporal series matches (within 30-minute intervals) and writes suggestions to the logs.
                    </p>

                    <div className="flex items-center justify-between bg-black/20 p-3 rounded-lg border border-white/5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                checked={dryRun} 
                                onChange={(e) => setDryRun(e.target.checked)}
                                className="rounded border-white/10 bg-slate-900 text-cyan-500 focus:ring-cyan-500/20"
                            />
                            <span className="text-xs font-bold text-slate-300">Run in Simulation Mode (Dry-Run)</span>
                        </label>
                        <span className="text-[10px] text-slate-500 font-mono">
                            {dryRun ? "⚠️ WRITE BLOCKED" : "🔥 LIVE EXECUTION"}
                        </span>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={async () => {
                                if (!user.id || user.id === 'unknown') return;
                                setIsProcessing(true);
                                appendLog(dryRun ? "🧵 Running Auto-Stitcher Simulation..." : "🧵 Executing Auto-Stitcher (Live)...");
                                try {
                                    const { appDataService } = await import('../../../services/serviceManager');
                                    const events = await appDataService.getAllEvents(user.id);
                                    const tags = await appDataService.getAllTags(user.id);
                                    const mediaList = await appDataService.getAllMedia(user.id);

                                    appendLog(`📊 Scanned ${events.length} events, ${tags.length} tags, ${mediaList.length} media items.`);

                                    let locationSyncs = 0;
                                    let tagSyncs = 0;
                                    let suggestionsFound = 0;
                                    const originalStates: any[] = [];

                                    for (const event of events) {
                                        const loc = event.location;
                                        const mediaIds = event.mediaIds || [];

                                        // 1. Find matching Place Tag for location
                                        let matchingPlaceTag: any = null;
                                        if (loc && (loc.streetAddress || loc.addressLocality)) {
                                            matchingPlaceTag = tags.find(t => {
                                                if (t.type !== 'place') return false;
                                                const meta = t.metadata as any;
                                                if (loc.coordinates && meta?.coordinates) {
                                                    const dist = Math.abs(loc.coordinates.lat - meta.coordinates.lat) + 
                                                                 Math.abs(loc.coordinates.lng - meta.coordinates.lng);
                                                    if (dist < 0.0005) return true;
                                                }
                                                if (meta?.address?.streetAddress === loc.streetAddress) return true;
                                                return t.name.toLowerCase() === loc.addressLocality?.toLowerCase();
                                            });
                                        }

                                        // 2. Propagate to attached media
                                        for (const mid of mediaIds) {
                                            const mItem = mediaList.find(m => m.id === mid);
                                            if (mItem) {
                                                let changed = false;
                                                const updated = { ...mItem };

                                                const hasLoc = updated.location && (updated.location.address || updated.location.lat);
                                                if (loc && (loc.streetAddress || loc.addressLocality) && !hasLoc) {
                                                    updated.location = {
                                                        address: loc.streetAddress || loc.addressLocality || '',
                                                        lat: loc.coordinates?.lat,
                                                        lng: loc.coordinates?.lng
                                                    };
                                                    changed = true;
                                                    locationSyncs++;
                                                }
                                                const hasTag = matchingPlaceTag && updated.tagIds && updated.tagIds.includes(matchingPlaceTag.id);
                                                if (matchingPlaceTag && !hasTag) {
                                                    updated.tagIds = [...(updated.tagIds || []), matchingPlaceTag.id];
                                                    changed = true;
                                                    tagSyncs++;
                                                }

                                                if (changed) {
                                                    if (dryRun) {
                                                        appendLog(`[SIM] Would update media '${mItem.fileName || mItem.caption || mItem.id}' (Loc: ${loc.streetAddress || loc.addressLocality || 'Yes'}, Tag: ${matchingPlaceTag?.name || 'None'})`);
                                                    } else {
                                                        originalStates.push(JSON.parse(JSON.stringify(mItem)));
                                                        await appDataService.saveMedia(user.id, updated);
                                                    }
                                                }
                                            }
                                        }

                                        // 3. Scan for Temporal Series candidates within 30 minutes of attached media
                                        if (mediaIds.length > 0) {
                                            const attachedTimes = mediaIds
                                                .map((mid: any) => mediaList.find((m: any) => m.id === mid))
                                                .filter((m: any): m is any => !!m && !!m.logicalDate)
                                                .map((m: any) => new Date(m.logicalDate!).getTime())
                                                .filter((t: any) => !isNaN(t));

                                            if (attachedTimes.length > 0) {
                                                const temporalCandidates = mediaList.filter((m: any) => {
                                                    if (mediaIds.includes(m.id)) return false;
                                                    if (m.isAvatar || !m.logicalDate) return false;
                                                    const mTime = new Date(m.logicalDate).getTime();
                                                    if (isNaN(mTime)) return false;
                                                    return attachedTimes.some((t: any) => Math.abs(t - mTime) <= 30 * 60 * 1000);
                                                });

                                                if (temporalCandidates.length > 0) {
                                                    suggestionsFound += temporalCandidates.length;
                                                    appendLog(`💡 Series Suggestion: '${event.title}' has ${temporalCandidates.length} unattached media files nearby in time (e.g. ${temporalCandidates[0].fileName || temporalCandidates[0].caption || 'unnamed'}).`);
                                                }
                                            }
                                        }
                                    }

                                    if (!dryRun && originalStates.length > 0) {
                                        const { db } = await import('../../../firebaseConfig');
                                        const { collection, addDoc } = await import('firebase/firestore');
                                        appendLog(`💾 Saving rollback point with ${originalStates.length} records...`);
                                        await addDoc(collection(db, 'users', user.id, 'maintenance_audit_logs'), {
                                            timestamp: new Date().toISOString(),
                                            action: 'spatial-temporal-stitcher',
                                            recordsAffected: originalStates.length,
                                            originalStates: originalStates
                                        });
                                        appendLog("💾 Rollback point written to database.");
                                    }

                                    appendLog(dryRun ? "✅ Auto-Stitcher Simulation Complete (Write Blocked)." : "✅ Auto-Stitcher Complete (Live Run).");
                                    appendLog(dryRun ? `📍 Simulation: Would sync location to ${locationSyncs} media files.` : `📍 Synced location to ${locationSyncs} media files.`);
                                    appendLog(dryRun ? `🏷️ Simulation: Would sync Place Tag to ${tagSyncs} media files.` : `🏷️ Synced Place Tag to ${tagSyncs} media files.`);
                                    appendLog(`💡 Identified ${suggestionsFound} temporal series suggestions.`);
                                    addToast(dryRun ? "Simulation finished." : "Spatial & Temporal Auto-Stitcher finished.", "success");

                                } catch (e: any) {
                                    appendLog(`❌ Stitcher Failed: ${e.message}`);
                                    addToast("Auto-Stitcher failed.", "error");
                                } finally {
                                    setIsProcessing(false);
                                }
                            }}
                            disabled={isProcessing}
                            className={`flex-1 py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] ${isProcessing
                                ? 'bg-slate-800 text-slate-500 cursor-wait'
                                : dryRun
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 shadow-lg shadow-amber-500/5'
                                }`}
                        >
                            {isProcessing ? 'Processing...' : dryRun ? 'Run Simulation' : 'Execute Auto-Stitcher'}
                        </button>

                        <button
                            onClick={async () => {
                                if (!user.id || user.id === 'unknown') return;
                                if (!confirm("Are you sure you want to REVERT the last auto-stitching run? This will restore affected media files to their pre-stitched state.")) return;

                                setIsProcessing(true);
                                appendLog("♻️ Initiating Rollback sequence...");
                                try {
                                    const { db } = await import('../../../firebaseConfig');
                                    const { collection, getDocs, query, orderBy, limit, doc, deleteDoc } = await import('firebase/firestore');
                                    const { appDataService } = await import('../../../services/serviceManager');

                                    const q = query(
                                        collection(db, 'users', user.id, 'maintenance_audit_logs'),
                                        orderBy('timestamp', 'desc'),
                                        limit(1)
                                    );
                                    const snap = await getDocs(q);
                                    if (snap.empty) {
                                        appendLog("⚠️ No rollback logs found. Nothing to revert.");
                                        addToast("No rollback logs found.", "info");
                                        setIsProcessing(false);
                                        return;
                                    }

                                    const auditDoc = snap.docs[0];
                                    const auditData = auditDoc.data();
                                    const originalStates = auditData.originalStates || [];

                                    if (originalStates.length === 0) {
                                        appendLog("⚠️ Rollback log is empty.");
                                        addToast("Rollback log is empty.", "info");
                                    } else {
                                        appendLog(`♻️ Restoring ${originalStates.length} media records...`);
                                        for (const state of originalStates) {
                                            await appDataService.saveMedia(user.id, state);
                                        }
                                        appendLog(`✅ Restored ${originalStates.length} media records successfully.`);
                                    }

                                    // Delete audit doc
                                    await deleteDoc(doc(db, 'users', user.id, 'maintenance_audit_logs', auditDoc.id));
                                    appendLog("🗑️ Rollback point cleared.");
                                    addToast("Reverted successfully.", "success");
                                } catch (e: any) {
                                    appendLog(`❌ Rollback Failed: ${e.message}`);
                                    addToast("Revert failed.", "error");
                                } finally {
                                    setIsProcessing(false);
                                }
                            }}
                            disabled={isProcessing}
                            className={`py-3 px-4 rounded-lg font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] ${isProcessing
                                ? 'bg-slate-800 text-slate-500 cursor-wait'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30'
                                }`}
                            title="Undo the last stitcher run using the rollback log."
                        >
                            Revert last run
                        </button>
                    </div>
                </div>
            </div>

            {/* [ZEN NEW] SECURE CHAT BACKUP */}
            <div className="bg-black/40 border border-white/5 rounded-xl overflow-hidden hover:border-violet-500/30 transition-colors mb-6">
                <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-500/10 rounded-md">
                            <Database size={20} className="text-violet-400" />
                        </div>
                        <span className="font-bold text-sm text-slate-200">Secure Neural Backup</span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                        Download a complete JSON archive of all chat segments currently stored in the cloud.
                        Safe, read-only operation. Use this before purging or major updates.
                    </p>

                    <button
                        onClick={async () => {
                            if (!user.id || user.id === 'unknown') return;
                            setIsProcessing(true);
                            appendLog("📦 Initiating Secure Chat Export...");
                            try {
                                const { appDataService } = await import('../../../services/serviceManager');
                                // [ZEN FIX] Use Full History fetcher (unlimited)
                                const history = await appDataService.getFullChatHistory(user.id);

                                if (history.length === 0) {
                                    appendLog("⚠️ No chat history found to export.");
                                    addToast("Database is empty.", "info");
                                } else {
                                    const dataStr = JSON.stringify(history, null, 2);
                                    const blob = new Blob([dataStr], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `gigi-chat-backup-${new Date().toISOString().split('T')[0]}.json`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    appendLog(`✅ Exported ${history.length} segments successfully.`);
                                    addToast("Backup downloaded.", "success");
                                }
                            } catch (e: any) {
                                appendLog(`❌ Export Failed: ${e.message}`);
                                addToast("Export failed.", "error");
                            } finally {
                                setIsProcessing(false);
                            }
                        }}
                        disabled={isProcessing}
                        className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98] ${isProcessing
                            ? 'bg-slate-800 text-slate-500 cursor-wait'
                            : 'bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30'
                            }`}
                    >
                        {isProcessing ? 'Archiving...' : 'Download Chat Backup'}
                    </button>
                </div>
            </div>

            {/* [ZEN NEW] AI CONTEXT PURGE (Standard Access) */}
            <div className="p-6 border border-red-500/30 bg-red-950/10 rounded-2xl space-y-4 relative overflow-hidden group">
                <div className="relative z-10">
                    <h3 className="text-sm font-black text-red-400 uppercase tracking-widest flex items-center gap-2 mb-1">
                        <Activity size={18} className="animate-pulse" /> Neural Matrix Context Purge
                    </h3>
                    <p className="text-[11px] text-red-200/60 leading-relaxed uppercase tracking-wider font-bold">
                        Permanently purge your AI conversational context.
                        <span className="block mt-1 text-red-500/80">Triggers an automatic archive backup before purge.</span>
                    </p>
                    <p className="text-[10px] text-slate-500 mt-2 font-mono italic leading-tight">
                        Note: This ONLY affects chat history with AI companions. Your personal life events, P2P transmissions, and media assets are completely safe and UNTOUCHED.
                    </p>
                </div>

                <button
                    onClick={async () => {
                        if (!user.id || user.id === 'unknown') return;
                        if (!confirm("ACTIVATE QUANTUM SNAP? This will backup then PURGE all AI conversation segments. (Personal data is untouched)")) return;

                        setIsProcessing(true);
                        appendLog("🔥 INITIALIZING NEURAL SNAP...");

                        try {
                            const { appDataService } = await import('../../../services/serviceManager');

                            // 1. BACKUP (Safety first)
                            const history = await appDataService.getChatHistory(user.id);
                            if (history.length > 0) {
                                appendLog("📦 Creating archive backup...");
                                const dataStr = JSON.stringify(history, null, 2);
                                const blob = new Blob([dataStr], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `ai-history-snap-${new Date().toISOString().split('T')[0]}.json`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                appendLog("✅ Archive downloaded.");
                            }

                            // 2. TRIGGER ANIMATION & NUCLEAR PURGE
                            window.dispatchEvent(new CustomEvent('incinerate-chat'));
                            appendLog("🔥 INITIATING NUCLEAR PURGE...");

                            // A. CLEAR CLOUD (Firestore + Typesense)
                            // deleteChatHistory now calls purgeUserMemory internally
                            await appDataService.deleteChatHistory(user.id);
                            appendLog("✅ Cloud Matrix Purged (Firestore + Typesense).");

                            // B. CLEAR LOCAL (IndexedDB)
                            const { dbDelete } = await import('../../../services/dbService');
                            await dbDelete('chatHistory', user.id);
                            appendLog("✅ Local Vault Cleared.");

                            // 3. WAIT FOR ANIMATION
                            await new Promise(r => setTimeout(r, 2000));

                            appendLog("✨ NUCLEAR PURGE SUCCESSFUL. The past is forgotten.");
                            addToast("AI Context Eradicated.", "success");

                            // Reload to ensure all states are clean
                            setTimeout(() => window.location.reload(), 1500);
                        } catch (e: any) {
                            appendLog(`❌ SNAP FAILURE: ${e.message}`);
                            addToast("Snap Failed.", "error");
                        } finally {
                            setIsProcessing(false);
                        }
                    }}
                    disabled={isProcessing}
                    className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-lg active:scale-[0.98] ${isProcessing
                        ? 'bg-slate-800 text-slate-500 cursor-wait'
                        : 'bg-red-600 text-white shadow-red-900/20 hover:bg-red-500 hover:shadow-red-900/40'
                        }`}
                >
                    {isProcessing ? "PURGING AI CONTEXT..." : "ACTIVATE QUANTUM SNAP"}
                </button>
            </div>
        </div >
    );
};
