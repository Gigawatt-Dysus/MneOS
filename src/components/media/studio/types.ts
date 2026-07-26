import { Tag, User, Media } from '../../../types';
import { AddressData } from '../../AddressAutocomplete';

export interface UniversalMedia {
    id: string;
    title?: string;
    caption?: string;
    description?: string;
    logicalDate?: Date | string;
    datePrecision?: 'exact' | 'day' | 'month' | 'year' | 'unknown';
    tagIds: string[];
    url?: string;
    preview?: string;
    fileType?: string;
    size?: number;
    originalName?: string;
    location?: AddressData | {
        address?: string;
        lat?: number;
        lng?: number;
        lat_double?: number;
        lng_double?: number;
        lat_precise?: number;
        lng_precise?: number;
        latitude?: number;
        longitude?: number;
        [key: string]: any;
    };
    isProduction?: boolean;
    isInboxDismissed?: boolean;
    isPurist?: boolean;
    polishStatus?: 'none' | 'pending' | 'completed';
    polishLayers?: string[];
    adjustmentStack?: Record<string, number>;
    privateDetails?: string;
    narrative?: string;
    contentHash?: string;
    type?: string;
    mediaIds?: string[];
    source?: string;
    textContent?: string;
    preset?: string;
    editHistory?: any[];
    status?: 'provisional' | 'clean' | 'pending' | 'ready';
    isFiction?: boolean;
    skipAI?: boolean;
    rotation?: number; // [ZEN] Canonical rotation in degrees (0, 90, 180, 270)
    // Video-specific root fields if needed in the future
    trimStart?: number;
    trimEnd?: number;
    videoDuration?: number;
}

export interface MediaStudioProps {
    asset: UniversalMedia;
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<UniversalMedia>) => void;
    onRemove?: (id: string) => void;
    tags: Tag[];
    user: User;
    onTagCreated?: (tag: Tag) => void;
    tetheredAnomalyId?: string | null;
}

export type StudioTab = 'meta' | 'entities' | 'geo' | 'polish' | 'temporal' | null;
export type PolishTab = 'light' | 'color' | 'trim' | 'presets' | 'history' | 'neural';
export type ViewMode = 'original' | 'polished' | 'split';

// Helper to determine if an asset is a video
export const isVideoAsset = (asset: UniversalMedia | null | undefined): boolean => {
    if (!asset) return false;
    const url = asset.url || asset.preview || '';
    const fileType = asset.fileType || '';
    const name = asset.originalName || asset.title || '';
    
    return (
        fileType.startsWith('video/') ||
        /\.(mp4|mov|webm|mkv|avi|3gp|m4v)/i.test(url) ||
        /\.(mp4|mov|webm|mkv|avi|3gp|m4v)/i.test(name)
    );
};
