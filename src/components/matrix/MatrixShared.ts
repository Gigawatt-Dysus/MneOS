import type { Media } from '../../types';

export const getMediaType = (item: Media): 'image' | 'video' | 'pdf' | 'audio' | 'unknown' => {
    if (item.fileType) {
        const ft = item.fileType.toLowerCase();
        if (ft.startsWith('image/')) return 'image';
        if (ft.startsWith('video/')) return 'video';
        if (ft.includes('pdf')) return 'pdf';
        if (ft.startsWith('audio/')) return 'audio';
    }
    
    // Fallback to URL/filename extensions if fileType is missing or generic
    const str = (item.url || item.originalName || '').toLowerCase();
    if (str.match(/\.(jpg|jpeg|png|gif|webp|svg|heic)$/i)) return 'image';
    if (str.match(/\.(mp4|mov|avi|webm|mkv)$/i)) return 'video';
    if (str.match(/\.(pdf)$/i)) return 'pdf';
    if (str.match(/\.(mp3|wav|ogg|m4a)$/i)) return 'audio';
    
    // Default to image if we have a thumbnail
    if (item.thumbnailUrl || item.thumbnailUrls) return 'image';

    return 'unknown';
};

// [ZEN FIX] Aggressive System Asset Filter
export const filterSystemAssets = (assets: Media[], ignoreFilters: boolean = false): Media[] => {
    if (ignoreFilters) return assets;
    
    return assets.filter(a => {
        // 1. Database Flag or ID prefix (The Cleanest Way)
        if ((a as any).isAvatar === true || a.id.startsWith('media-avatar-')) return false;

        // 2. Normalize Data
        const title = (a.title || '').toLowerCase().trim();
        const filename = (a.originalName || '').toLowerCase().trim();
        const caption = (a.caption || '').toLowerCase().trim();
        const url = (a.url || '').trim();

        // 3. BLOB DETECTION (The "Smoking Gun")
        // Check main URL
        if (url.startsWith('data:') || url.startsWith('blob:')) return false;
        
        // Check Thumbnails (Sometimes the main URL is fine but thumbnails are blobs)
        if (a.thumbnailUrls) {
            const thumbs = Object.values(a.thumbnailUrls);
            // [ZEN FIX] Added 'typeof t === string' check to satisfy TypeScript
            // This prevents it from crashing if it finds a boolean flag in the map.
            if (thumbs.some(t => typeof t === 'string' && (t.startsWith('data:') || t.startsWith('blob:')))) return false;
        }

        // 4. "Untitled Asset" UI Fallback Detector
        if (!title) {
            if (filename.startsWith('blob') || filename === 'unknown') return false;
            // If it has NO filename and NO title, hide it.
            if (!filename) return false;
        }

        // 5. Explicit Naming Patterns
        if (title.includes('untitled asset')) return false; 
        if (title === 'untitled') return false;
        if (title.startsWith('avatar_')) return false;
        if (filename.startsWith('avatar_')) return false;
        if (caption.includes('avatar_')) return false;

        // 6. Crop/Edit Artifacts
        if (filename.includes('cropped-image')) return false;
        if (filename.includes('profile_pic')) return false;

        return true;
    });
};