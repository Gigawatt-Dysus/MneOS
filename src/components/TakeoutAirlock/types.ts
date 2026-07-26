// ============================================================
// TakeoutAirlock — Type Definitions
// Data source: local staging_api.js on localhost:3001
// NOT MongoDB. NOT the sovereignDbAdapter.
// ============================================================

export interface StagingFile {
    filename: string;
    filepath: string;
    extension: string;
    size: number; // bytes
    hash?: string;
    is_shortcut?: number;
    duplicate_of?: number | null;
    created_at?: string;
    caption?: string;
    process_state?: string;
    is_private?: number;
}

export interface StagingPagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface StagingFilesResponse {
    data: StagingFile[];
    pagination: StagingPagination;
}

export interface StagingStats {
    totalFiles: number;
    totalSize: number; // bytes
    totalJobs?: number;
    syncedJobs?: number;
    quarantineCount?: number;
    keepProxyCount?: number;
    extensions: { extension: string; count: number }[];
}

export interface AirlockFilters {
    search: string;
    extensionFilter: string; // '' = all, 'jpg' = only jpgs, etc.
    showDuplicatesOnly: boolean;
    quarantineOnly: boolean;
    hidePendingSync: boolean;
}
