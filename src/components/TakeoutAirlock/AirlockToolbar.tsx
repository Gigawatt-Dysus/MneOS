// ============================================================
// AirlockToolbar — Control bar for TakeoutAirlock
// ============================================================
import React, { useRef } from 'react';
import {
    HardDrive, RefreshCw, Search, Filter, Trash2, AlertTriangle, Database, Zap, Check
} from 'lucide-react';
import type { StagingStats, AirlockFilters } from './types';

interface AirlockToolbarProps {
    stats: StagingStats | null;
    isStatsLoading: boolean;
    apiOffline: boolean;
    filters: AirlockFilters;
    onFilterChange: (patch: Partial<AirlockFilters>) => void;
    onRefresh: () => void;
    onPruneExtension: (ext: string) => void;
    totalDisplayed: number;
    totalInDb: number;
    selectedCount?: number;
    onDeleteSelected?: () => void;
    onOpenForge?: () => void;
    onReviewQuarantined?: () => void;
}

const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const AirlockToolbar: React.FC<AirlockToolbarProps> = ({
    stats, isStatsLoading, apiOffline, filters, onFilterChange, onRefresh, onPruneExtension,
    totalDisplayed, totalInDb, selectedCount = 0, onDeleteSelected, onOpenForge, onReviewQuarantined
}) => {
    const pruneSelectRef = useRef<HTMLSelectElement>(null);

    return (
        <div className="flex flex-col gap-4 pb-4 border-b border-white/10 shrink-0">
            {/* === Title Row === */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <HardDrive className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold font-mono text-amber-400 tracking-wider uppercase">
                            TAKEOUT AIRLOCK
                        </h2>
                        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                            Local Staging Pipeline // staging.db @ localhost:3001
                        </p>
                    </div>
                </div>

                {/* API Status Badge & Forge Button */}
                <div className="flex items-center gap-3">
                    {onOpenForge && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => onFilterChange({ quarantineOnly: !filters.quarantineOnly })}
                                className={`flex items-center gap-2 px-4 py-1.5 border text-xs font-bold font-mono uppercase tracking-widest rounded-lg transition-all ${
                                    filters.quarantineOnly 
                                        ? 'bg-rose-500/40 border-rose-500 text-rose-100 shadow-[0_0_15px_rgba(244,63,94,0.4)]' 
                                        : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-400'
                                }`}
                                title="Toggle grid view of automatically soft-quarantined images"
                            >
                                <Zap className={`w-3 h-3 ${filters.quarantineOnly ? 'text-rose-100 animate-pulse' : 'text-rose-400'}`} />
                                QUARANTINED GRID
                            </button>
                            <button
                                onClick={() => onFilterChange({ hidePendingSync: !filters.hidePendingSync })}
                                className={`flex items-center gap-2 px-4 py-1.5 border text-xs font-bold font-mono uppercase tracking-widest rounded-lg transition-all ${
                                    filters.hidePendingSync 
                                        ? 'bg-amber-500/40 border-amber-500 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.4)]' 
                                        : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400'
                                }`}
                                title="Hide files that are waiting for Vector Sync"
                            >
                                <Zap className={`w-3 h-3 ${filters.hidePendingSync ? 'text-amber-100 animate-pulse' : 'text-amber-400'}`} />
                                HIDE PENDING
                            </button>
                            <button
                                onClick={onOpenForge}
                                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/50 text-indigo-300 text-xs font-bold font-mono uppercase tracking-widest rounded-lg transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                                title="Launch the AI Training Forge Inspector"
                            >
                                <Zap className="w-3 h-3 text-amber-400" />
                                LAUNCH FORGE
                            </button>
                        </div>
                    )}

                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold font-mono uppercase tracking-widest ${
                        apiOffline
                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    }`}>
                        <div className={`w-2 h-2 rounded-full ${apiOffline ? 'bg-red-500 animate-pulse' : 'bg-emerald-400'}`} />
                        {apiOffline ? 'API OFFLINE' : 'API LIVE'}
                    </div>
                </div>
            </div>

            {/* === Stats Row === */}
            {!apiOffline && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <StatChip
                        label="Total Files"
                        value={isStatsLoading ? '...' : stats?.totalFiles.toLocaleString() ?? '—'}
                        accent="amber"
                        icon={<Database size={14} />}
                    />
                    <StatChip
                        label="Archive Size"
                        value={isStatsLoading ? '...' : formatBytes(stats?.totalSize ?? 0)}
                        accent="cyan"
                        icon={<HardDrive size={14} />}
                    />
                    <StatChip
                        label="Pipeline Synced"
                        value={isStatsLoading ? '...' : `${stats?.syncedJobs?.toLocaleString() ?? 0} / ${stats?.totalJobs?.toLocaleString() ?? 0}`}
                        accent="emerald"
                        icon={<RefreshCw size={14} />}
                    />
                    <StatChip
                        label="Showing"
                        value={`${totalDisplayed.toLocaleString()} / ${totalInDb.toLocaleString()}`}
                        accent="violet"
                        icon={<Filter size={14} />}
                    />
                    <StatChip
                        label="File Types"
                        value={isStatsLoading ? '...' : `${stats?.extensions.length ?? 0} kinds`}
                        accent="rose"
                        icon={<Filter size={14} />}
                    />
                </div>
            )}

            {/* === Quarantine Ledger Stats Row === */}
            {(!apiOffline && filters.quarantineOnly) && (
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mt-3">
                    <StatChip
                        label="Quarantine Remaining"
                        value={isStatsLoading ? '...' : `${stats?.quarantineCount?.toLocaleString() ?? 0} pairs`}
                        accent="rose"
                        icon={<Trash2 size={14} />}
                    />
                    <StatChip
                        label="Slated for Transplant"
                        value={isStatsLoading ? '...' : `${stats?.keepProxyCount?.toLocaleString() ?? 0} pairs`}
                        accent="indigo"
                        icon={<Check size={14} />}
                    />
                </div>
            )}
            {/* === Offline Warning === */}
            {apiOffline && (
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm font-mono">
                    <AlertTriangle size={18} className="text-red-400 shrink-0" />
                    <span>
                        Cannot reach <strong>localhost:3001</strong>. Ensure{' '}
                        <code className="bg-black/30 px-1 rounded">node scripts/migration/staging_api.js</code>{' '}
                        is running and <strong>staging.db</strong> is present at project root.
                    </span>
                </div>
            )}

            {/* === Filter/Search Row === */}
            <div className="flex flex-wrap gap-3 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={filters.search}
                        onChange={(e) => onFilterChange({ search: e.target.value })}
                        placeholder="Search filename or path..."
                        className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 font-mono"
                    />
                </div>

                {/* Extension Filter */}
                {stats && stats.extensions.length > 0 && (
                    <select
                        value={filters.extensionFilter}
                        onChange={(e) => onFilterChange({ extensionFilter: e.target.value })}
                        className="bg-[#0b0f19] border border-[#66FCF1]/30 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#45A29E] font-mono cursor-pointer"
                        title="Filter by file extension"
                        style={{ colorScheme: 'dark' }}
                    >
                        <option value="">All Types</option>
                        {stats.extensions.map((ext) => (
                            <option key={ext.extension} value={ext.extension}>
                                .{ext.extension?.replace(/^\./, '') || 'none'} ({ext.count.toLocaleString()})
                            </option>
                        ))}
                    </select>
                )}

                {/* Prune by Extension */}
                {stats && stats.extensions.length > 0 && (
                    <div className="flex flex-col gap-2 p-2 rounded-lg border border-orange-500/20 bg-orange-500/5">
                        <select
                            ref={pruneSelectRef}
                            defaultValue=""
                            className="bg-[#0b0f19] border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-orange-300 focus:outline-none focus:border-orange-500 font-mono cursor-pointer"
                            title="Select an extension to bulk-delete from staging.db"
                            style={{ colorScheme: 'dark' }}
                        >
                            <option value="" disabled>Prune by type...</option>
                            {stats.extensions.map((ext) => (
                                <option key={ext.extension} value={ext.extension}>
                                    .{ext.extension?.replace(/^\./, '') || 'none'} ({ext.count.toLocaleString()})
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                const ext = pruneSelectRef.current?.value;
                                if (!ext) return;
                                if (window.confirm(`Permanently delete all .${ext.replace(/^\./, '')} records from staging.db?`)) {
                                    onPruneExtension(ext);
                                }
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold font-mono uppercase tracking-wider rounded-lg hover:bg-orange-500/20 transition-colors w-full"
                            title="PRUNE BATCH: Flags all records matching the selected file extension drop-down for absolute bulk hard-deletion from the staging database."
                        >
                            <Trash2 size={14} /> PRUNE BATCH
                        </button>
                    </div>
                )}

                {/* Delete Selected */}
                {selectedCount > 0 && (
                    <button
                        onClick={onDeleteSelected}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-600/20 border border-red-500/50 text-red-400 text-xs font-bold font-mono uppercase tracking-wider rounded-lg hover:bg-red-500/40 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                        title={`DELETE INDIVIDUALS: Instantly hard-deletes the ${selectedCount} specific files you manually checked off from the staging database. This cannot be undone.`}
                    >
                        <Trash2 size={14} /> DELETE SELECTED ({selectedCount})
                    </button>
                )}

                {/* Refresh */}
                <button
                    onClick={onRefresh}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 text-slate-400 text-xs font-bold font-mono uppercase tracking-wider rounded-lg hover:bg-white/10 transition-colors"
                    title="Refresh from local staging API"
                >
                    <RefreshCw size={14} /> SYNC
                </button>
            </div>
        </div>
    );
};

// — Small reusable stat chip ————————————————————————————————
const accentMap: Record<string, string> = {
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    cyan:  'bg-cyan-500/10  border-cyan-500/20  text-cyan-400',
    violet:'bg-violet-500/10 border-violet-500/20 text-violet-400',
    rose:  'bg-rose-500/10  border-rose-500/20  text-rose-400',
};

const StatChip: React.FC<{
    label: string; value: string; accent: string; icon: React.ReactNode;
}> = ({ label, value, accent, icon }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${accentMap[accent] ?? accentMap.amber}`}>
        {icon}
        <div>
            <div className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</div>
            <div className="text-sm font-bold font-mono">{value}</div>
        </div>
    </div>
);
