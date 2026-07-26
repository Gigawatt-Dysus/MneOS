// ============================================================
// AirlockGrid — Paginated file grid for TakeoutAirlock
// ============================================================
import React from 'react';
import { Loader2, HardDrive, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AirlockFileCard } from './AirlockFileCard';
import type { StagingFile, StagingPagination } from './types';

interface AirlockGridProps {
    files: StagingFile[];
    pagination: StagingPagination | null;
    isLoading: boolean;
    apiOffline: boolean;
    currentPage: number;
    onPageChange: (page: number) => void;
    previewUrl: (filepath: string) => string;
    selectedHashes: Set<string>;
    onToggleSelect: (hash: string) => void;
    onClearSelection?: () => void;
    onFileClick?: (file: StagingFile) => void;
    onInspect?: (file: StagingFile) => void;
    onOpenTriage?: (file: StagingFile) => void;
    onDeleteFile?: (file: StagingFile) => void;
}

export const AirlockGrid: React.FC<AirlockGridProps> = ({
    files,
    pagination,
    isLoading,
    apiOffline,
    currentPage,
    onPageChange,
    previewUrl,
    selectedHashes,
    onToggleSelect,
    onClearSelection,
    onFileClick,
    onInspect,
    onOpenTriage,
    onDeleteFile
}) => {

    if (apiOffline) return null; // Toolbar already shows the offline warning

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-amber-400/50">
                <Loader2 className="w-12 h-12 animate-spin" />
                <p className="text-sm font-mono uppercase tracking-widest">READING STAGING DATABASE...</p>
            </div>
        );
    }

    if (files.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-600 border-2 border-dashed border-slate-800 rounded-xl">
                <HardDrive size={48} className="opacity-30" />
                <p className="text-sm font-mono uppercase tracking-widest">
                    No files match current filters.
                </p>
                <p className="text-xs font-mono text-slate-700">
                    Try clearing the search or selecting a different extension.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* File Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentPage}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-4"
                    >
                        {files.map((file) => (
                            <AirlockFileCard
                                key={file.filepath}
                                file={file}
                                previewUrl={previewUrl}
                                isSelected={file.hash ? selectedHashes.has(file.hash) : false}
                                onToggleSelect={() => file.hash && onToggleSelect(file.hash)}
                                onClick={onFileClick ? () => onFileClick(file) : undefined}
                                onInspect={onInspect ? () => onInspect(file) : undefined}
                                onOpen={() => window.open(previewUrl(file.filepath), '_blank')}
                                onOpenTriage={onOpenTriage ? () => onOpenTriage(file) : undefined}
                                onDelete={onDeleteFile ? () => onDeleteFile(file) : undefined}
                            />
                        ))}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Pagination Controls */}
            {pagination && pagination.totalPages > 1 && (
                <div className="shrink-0 flex items-center justify-between pt-4 border-t border-white/10 mt-4">
                    <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                        Page {pagination.page} of {pagination.totalPages} &nbsp;·&nbsp; {pagination.total.toLocaleString()} total files
                    </span>

                    <div className="flex items-center gap-2">
                        <PaginationButton
                            onClick={() => onPageChange(1)}
                            disabled={currentPage === 1}
                            label="«"
                            title="First page"
                        />
                        <PaginationButton
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            label={<ChevronLeft size={16} />}
                            title="Previous page"
                        />

                        {/* Nearby page numbers */}
                        {getPageRange(currentPage, pagination.totalPages).map((p) =>
                            p === '...' ? (
                                <span key={p + Math.random()} className="text-slate-600 font-mono px-1">…</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => onPageChange(p as number)}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold font-mono transition-all ${
                                        p === currentPage
                                            ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                                            : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'
                                    }`}
                                >
                                    {p}
                                </button>
                            )
                        )}

                        <PaginationButton
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === pagination.totalPages}
                            label={<ChevronRight size={16} />}
                            title="Next page"
                        />
                        <PaginationButton
                            onClick={() => onPageChange(pagination.totalPages)}
                            disabled={currentPage === pagination.totalPages}
                            label="»"
                            title="Last page"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

// — Small pagination button ————————————————————————————————
const PaginationButton: React.FC<{
    onClick: () => void;
    disabled: boolean;
    label: React.ReactNode;
    title: string;
}> = ({ onClick, disabled, label, title }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs font-bold font-mono transition-all hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
    >
        {label}
    </button>
);

// Generate a clipped range like [1, '...', 4, 5, 6, '...', 20]
function getPageRange(current: number, total: number): (number | '...')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}
