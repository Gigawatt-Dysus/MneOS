// ============================================================
// TakeoutAirlock — Root Component
//
// Standalone dashboard for reviewing the 1.2TB Google Takeout
// staging manifest held in the local SQLite staging.db file.
//
// DATA SOURCE: localhost:3001 (staging_api.js) — SQLite only.
// NOT MongoDB. NOT the sovereignDbAdapter. NOT any cloud service.
//
// Mount this as a standalone view (e.g. "takeout-airlock") in
// the main app router/navigator — do not nest inside TheMatrix.
// ============================================================
import React from 'react';
import { useTakeoutStaging } from './useTakeoutStaging';
import { AirlockToolbar } from './AirlockToolbar';
import { AirlockGrid } from './AirlockGrid';
import { ForgeInspector, ForgePair } from './ForgeInspector';
import { AI_TriageModal } from './AI_TriageModal';

export const TakeoutAirlock: React.FC = () => {
    const [selectedHashes, setSelectedHashes] = React.useState<Set<string>>(new Set());
    const [isForgeOpen, setIsForgeOpen] = React.useState(false);
    const [forgePair, setForgePair] = React.useState<ForgePair | null>(null);
    const [isProcessingForge, setIsProcessingForge] = React.useState(false);
    const [isReviewAuto, setIsReviewAuto] = React.useState(false);
    const [skippedHashes, setSkippedHashes] = React.useState<string[]>([]);
    const [triageFile, setTriageFile] = React.useState<any>(null);
    
    const {
        files,
        pagination,
        stats,
        isLoading,
        isStatsLoading,
        apiOffline,
        filters,
        setFilters,
        currentPage,
        setCurrentPage,
        previewUrl,
        pruneExtension,
        refresh,
    } = useTakeoutStaging();

    const handleFilterChange = (patch: any) => {
        setFilters((prev: any) => ({ ...prev, ...patch }));
        setCurrentPage(1);
    };

    const handleRefresh = () => {
        refresh();
        setSelectedHashes(new Set());
    };

    const handleToggleSelect = (hash: string) => {
        setSelectedHashes(prev => {
            const next = new Set(prev);
            if (next.has(hash)) next.delete(hash);
            else next.add(hash);
            return next;
        });
    };

    const handleDeleteSelected = async () => {
        if (selectedHashes.size === 0) return;
        if (!window.confirm(`Permanently delete ${selectedHashes.size} selected files from staging?`)) return;

        try {
            const res = await fetch('http://localhost:3001/api/files/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hashes: Array.from(selectedHashes) })
            });
            if (res.ok) {
                setSelectedHashes(new Set());
                handleRefresh();
            } else {
                console.error('Failed to delete files');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteFile = async (file: any) => {
        if (!window.confirm(`Permanently delete ${file.filepath || file.hash} from staging?`)) return;

        try {
            const res = await fetch('http://localhost:3001/api/files/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hashes: [file.hash] })
            });
            if (res.ok) {
                // If it was selected, unselect it
                setSelectedHashes(prev => {
                    const next = new Set(prev);
                    next.delete(file.hash);
                    return next;
                });
                handleRefresh();
            } else {
                console.error('Failed to delete file');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const loadNextForgePair = async (reviewAutoState = isReviewAuto, newSkip?: string) => {
        try {
            const currentSkips = newSkip ? [...skippedHashes, newSkip] : skippedHashes;
            if (newSkip) setSkippedHashes(currentSkips);

            const res = await fetch(`http://localhost:3001/api/forge/next?t=${Date.now()}&reviewAuto=${reviewAutoState}&skips=${currentSkips.join(',')}`, {
                cache: 'no-store'
            });
            const data = await res.json();
            if (data.pair) {
                setForgePair(data.pair);
            } else {
                setForgePair(null);
                setIsForgeOpen(false);
                console.log("No more proxies to review!");
            }
        } catch (e) {
            console.error("Failed to load next forge pair", e);
        }
    };

    const handleOpenForgeTest = () => {
        setIsReviewAuto(false);
        setSkippedHashes([]);
        setIsForgeOpen(true);
        loadNextForgePair(false);
    };

    const handleFileClick = async (file: any) => {
        handleToggleSelect(file.hash);
    };

    const handleInspect = async (file: any) => {
        setIsProcessingForge(true);
        try {
            const res = await fetch(`http://localhost:3001/api/forge/pair/${file.hash}`);
            const data = await res.json();
            if (data.pair) {
                setIsReviewAuto(true);
                setForgePair(data.pair);
                setIsForgeOpen(true);
            }
        } catch (e) {
            console.error("Failed to load specific pair", e);
        } finally {
            setIsProcessingForge(false);
        }
    };

    const handleForgeDecision = async (decision: 'PRUNE_PROXY' | 'KEEP_PROXY' | 'SKIP' | 'DELETE_PAIR') => {
        if (!forgePair) return;
        
        setIsProcessingForge(true);
        let skipHashToPass: string | undefined;

        try {
            if (decision === 'DELETE_PAIR') {
                if (window.confirm("Hard delete BOTH the master and the proxy from staging? This cannot be undone.")) {
                    await fetch('http://localhost:3001/api/files/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ hashes: [forgePair.proxyHash, forgePair.masterHash] })
                    });
                }
            } else if (decision === 'SKIP') {
                skipHashToPass = forgePair.proxyHash;
            } else {
                await fetch('http://localhost:3001/api/forge/decision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        proxyHash: forgePair.proxyHash,
                        masterHash: forgePair.masterHash,
                        ssimScore: forgePair.ssimScore,
                        satDiff: forgePair.satDiff,
                        decision: decision
                    })
                });
            }
            
            // Load next pair automatically
            await loadNextForgePair(isReviewAuto, skipHashToPass);
            
            // Critical: Refresh the background grid and stats so the Remaining count drops!
            refresh();
            
        } catch (e) {
            console.error("Failed to save decision", e);
        } finally {
            setIsProcessingForge(false);
        }
    };

    const handleOpenTriage = (file: any) => {
        setTriageFile({
            _id: file.hash,
            url: previewUrl(file.filepath),
            caption: file.caption,
            rotation: file.rotation || 0,
            reviewStatus: 'pending'
        });
    };

    const handleAdoptTriage = async (docId: string, finalCaption: string, rotation?: number) => {
        try {
            const res = await fetch('http://localhost:3001/api/files/caption', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hash: docId, caption: finalCaption, rotation })
            });
            if (res.ok) {
                refresh();
            }
        } catch (err) {
            console.error('Failed to save triage caption', err);
        }
        setTriageFile(null);
    };

    return (
        <div className="h-full relative overflow-hidden bg-[#050A15] flex flex-col text-slate-200">
            {/* Subtle ambient background glow */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-violet-500/5 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10 h-full flex flex-col p-6 gap-4">
                <AirlockToolbar
                    stats={stats}
                    isStatsLoading={isStatsLoading}
                    apiOffline={apiOffline}
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onRefresh={handleRefresh}
                    onPruneExtension={(ext) => {
                        pruneExtension(ext);
                        setSelectedHashes(new Set());
                    }}
                    totalDisplayed={pagination?.total ?? 0}
                    totalInDb={pagination?.total ?? stats?.totalFiles ?? 0}
                    selectedCount={selectedHashes.size}
                    onDeleteSelected={handleDeleteSelected}
                    onOpenForge={handleOpenForgeTest}
                />

                <AirlockGrid
                    files={files}
                    pagination={pagination}
                    isLoading={isLoading}
                    apiOffline={apiOffline}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    previewUrl={previewUrl}
                    selectedHashes={selectedHashes}
                    onToggleSelect={handleToggleSelect}
                    onClearSelection={() => setSelectedHashes(new Set())}
                    onInspect={filters.quarantineOnly ? handleInspect : undefined}
                    onOpenTriage={handleOpenTriage}
                    onDeleteFile={handleDeleteFile}
                />
            </div>
            
            <ForgeInspector 
                isOpen={isForgeOpen} 
                onClose={() => setIsForgeOpen(false)} 
                pair={forgePair} 
                onDecision={handleForgeDecision}
                isProcessing={isProcessingForge}
                isReviewAuto={isReviewAuto}
                stats={stats}
            />

            <AI_TriageModal 
                isOpen={!!triageFile}
                onClose={() => setTriageFile(null)}
                document={triageFile}
                onAdopt={handleAdoptTriage}
            />
        </div>
    );
};
