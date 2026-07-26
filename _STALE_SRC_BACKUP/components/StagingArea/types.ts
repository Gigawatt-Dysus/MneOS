// [ZEN FIX] Explicitly defining the local interfaces here to solve dependency break
export interface UserSettings {
    theme: 'light' | 'dark';
    [key: string]: any;
}

// Re-defining StagedAsset here since it was missing from global types
export interface StagedAsset {
    id: string;
    file: File;
    preview: string;
    metadata: {
        width: number;
        height: number;
        aspectRatio: number;
        googlePhotos?: any;
        [key: string]: any;
    };
    thumbnails: {
        [key: string]: string;
    };
    logicalDate: Date;
    aiStatus: 'pending' | 'processing' | 'completed' | 'error';
    status: 'pending' | 'ready' | 'uploaded' | 'error';
    tagIds: string[];
    detectedFaces: any[];
    title: string;
    description: string;
    caption: string;
}

export interface StagingAreaProps {
    stagedFiles: File[];
    onClear: () => void;
    userId: string;
    onNavigate: (view: string) => void;
    userSettings: UserSettings;
}

export interface StagingProcessorReturn {
    stagedAssets: StagedAsset[];
    isProcessing: boolean;
    isSaving: boolean;
    handleSaveAll: () => Promise<void>;
    handleRemove: (id: string) => void;
    handleUpdateAsset: (id: string, updates: Partial<StagedAsset>) => void;
    clearAll: () => void;
}