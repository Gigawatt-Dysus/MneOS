// ============================================================
// useTakeoutStaging — Paginated data hook for TakeoutAirlock
//
// CRITICAL: This hook talks ONLY to the local staging_api.js
// server running on localhost:3001. It does NOT use the
// sovereignDbAdapter, MongoDB, or any Firebase surface.
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import type { StagingFile, StagingPagination, StagingStats, AirlockFilters } from './types';

const API_BASE = "http://localhost:3001";
const PAGE_SIZE = 60;

export interface UseTakeoutStagingReturn {
    files: StagingFile[];
    pagination: StagingPagination | null;
    stats: StagingStats | null;
    isLoading: boolean;
    isStatsLoading: boolean;
    apiOffline: boolean;
    filters: AirlockFilters;
    setFilters: React.Dispatch<React.SetStateAction<AirlockFilters>>;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    previewUrl: (filepath: string) => string;
    pruneExtension: (ext: string) => Promise<{ deletedCount: number }>;
    refresh: () => void;
}

export const useTakeoutStaging = (): UseTakeoutStagingReturn => {
    const [files, setFiles] = useState<StagingFile[]>([]);
    const [pagination, setPagination] = useState<StagingPagination | null>(null);
    const [stats, setStats] = useState<StagingStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isStatsLoading, setIsStatsLoading] = useState(false);
    const [apiOffline, setApiOffline] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [filters, setFilters] = useState<AirlockFilters>({
        search: '',
        extensionFilter: '',
        showDuplicatesOnly: false,
        quarantineOnly: false,
        hidePendingSync: false,
    });

    // Debounce search so we don't hammer the API on every keystroke
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedSearch(filters.search);
            setCurrentPage(1); // Reset page on new search
        }, 350);
        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        };
    }, [filters.search]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters.extensionFilter, filters.showDuplicatesOnly, filters.quarantineOnly]);

    const fetchStats = useCallback(async (background = false) => {
        if (!background) setIsStatsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/stats`);
            if (!res.ok) throw new Error(`Stats API returned ${res.status}`);
            const data = await res.json();
            setStats(data);
            setApiOffline(false);
        } catch (e) {
            console.error('[TakeoutAirlock] Stats fetch failed — API likely offline:', e);
            setApiOffline(true);
        } finally {
            if (!background) setIsStatsLoading(false);
        }
    }, []);

    const fetchFiles = useCallback(async (background = false) => {
        if (!background) setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(currentPage),
                limit: String(PAGE_SIZE),
            });
            if (debouncedSearch) params.set('search', debouncedSearch);
            if (filters.quarantineOnly) params.set('quarantine', 'true');

            const res = await fetch(`${API_BASE}/api/files?${params.toString()}`);
            if (!res.ok) throw new Error(`Files API returned ${res.status}`);

            const { data, pagination: pag } = await res.json();

            // Client-side extension filter (avoids needing to add it to the API today)
            let filtered = data as StagingFile[];
            if (filters.extensionFilter) {
                filtered = filtered.filter(f => f.extension === filters.extensionFilter);
            }
            if (filters.hidePendingSync) {
                filtered = filtered.filter(f => f.process_state !== 'reembed_pending');
            }

            setFiles(filtered);
            setPagination(pag);
            setApiOffline(false);
        } catch (e) {
            console.error('[TakeoutAirlock] Files fetch failed — API likely offline:', e);
            setApiOffline(true);
            setFiles([]);
        } finally {
            if (!background) setIsLoading(false);
        }
    }, [currentPage, debouncedSearch, filters.extensionFilter, filters.quarantineOnly, filters.hidePendingSync]);

    // Fetch on mount and whenever deps change
    useEffect(() => { fetchFiles(); }, [fetchFiles]);
    useEffect(() => { fetchStats(); }, [fetchStats]);

    // Polling hook for live ingestion monitoring (silent refresh every 3 seconds)
    useEffect(() => {
        const interval = setInterval(() => {
            fetchFiles(true);
            fetchStats(true);
        }, 3000);
        return () => clearInterval(interval);
    }, [fetchFiles, fetchStats]);

    const refresh = useCallback(() => {
        fetchFiles();
        fetchStats();
    }, [fetchFiles, fetchStats]);

    // Build a preview URL from the local API's /api/preview endpoint
    const previewUrl = useCallback((filepath: string): string => {
        return `${API_BASE}/api/preview?filepath=${encodeURIComponent(filepath)}`;
    }, []);

    const pruneExtension = useCallback(async (ext: string): Promise<{ deletedCount: number }> => {
        const res = await fetch(`${API_BASE}/api/prune/extension`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extension: ext }),
        });
        if (!res.ok) throw new Error(`Prune API returned ${res.status}`);
        const result = await res.json();
        // Refresh both views after a prune operation
        fetchStats();
        fetchFiles();
        return result;
    }, [fetchStats, fetchFiles]);

    return {
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
    };
};
