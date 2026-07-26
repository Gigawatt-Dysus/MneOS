// [ZEN FIX] Explicitly defining the local interfaces here to solve dependency break
import { Tag, User } from '../../types';

export interface UserSettings {
    theme: 'light' | 'dark';
    [key: string]: any;
}

// Re-defining StagedAsset here since it was missing from global types
export interface StagedAsset {
    id: string;
    file?: File;
    mediaUrl?: string; // For Cloud artifacts (B2)
    url?: string; // Legacy/Compat field
    objectKey?: string; // For Cloud artifacts (B2)
    preview?: string; // Made optional to avoid TS errors
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
    datePrecision?: 'exact' | 'day' | 'month' | 'year' | 'unknown';
    aiStatus: 'pending' | 'processing' | 'completed' | 'error';
    status: 'pending' | 'ready' | 'uploaded' | 'error' | 'merged';
    tagIds: string[];
    detectedFaces: any[];
    title: string;
    description: string;
    caption: string;
    narrative?: string; // [ZEN] Narrative field for jots
    polishLayers?: string[]; // [ZEN] AI Polish history
    preset?: string; // [ZEN] Darkroom active preset
    adjustmentStack?: any; // [ZEN] Darkroom sliders stack
    editHistory?: any[]; // [ZEN] Darkroom edit history snapshots
    source?: 'email' | 'shoebox' | 'local' | 'google-photos-sideload' | 'cloud' | 'archive_import';
    fileType?: string;
    fileName?: string;
    fileSize?: number;
    contentHash?: string;
    isDuplicate?: boolean;
    duplicateOf?: string;
    location?: {
        address?: string;
        lat?: number;
        lng?: number;
    };
    isPurist?: boolean;
    type?: 'media' | 'event' | 'tag' | 'journal' | 'signal' | 'messenger_log' | 'document'; // [ZEN] Differentiates between artifact types for appropriate rendering
    mediaIds?: string[];
    attachedMedia?: any[]; // [ZEN] For bundled media in jots/events
    matchedToId?: string; // [ZEN] For Neural Merging in Gateway
    isProvisional?: boolean; // [ZEN] Flags for discovery triage
    extractedText?: string;
    ragEnabled?: boolean;
    extractedVertices?: string[];
}

export interface AccessioningGatewayProps {
    stagedFiles: File[];
    onClear: () => void;
    userId: string;
    user: User;
    onNavigate: (view: string) => void;
    userSettings: UserSettings;
    tags: Tag[];
    onStageFiles?: (files: File[]) => void;
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