/**
 * MEDIA UTILITY ENGINE
 * Project GIGI: LifeOS
 */

/**
 * Extracts a thumbnail from a video file at a specific time (default 1s / ~30th frame).
 */
export const getVideoThumbnail = async (file: File, seekTime: number = 1): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.src = URL.createObjectURL(file);

        video.onloadedmetadata = () => {
            video.currentTime = seekTime;
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error("Failed to get canvas context"));
                return;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Failed to convert canvas to blob"));
                }
                URL.revokeObjectURL(video.src);
            }, 'image/jpeg', 0.8);
        };

        video.onerror = (e) => {
            reject(new Error("Video loading error"));
            URL.revokeObjectURL(video.src);
        };
    });
};

/**
 * CONVERSION ENGINE: Metadata -> CSS Filter
 * [ZEN] Professional Darkroom persistence layer. Support dynamic sliders and presets.
 */
export const getPolishFilter = (
    layersOrAsset?: string[] | any,
    adjustments?: Record<string, number>,
    preset?: string
): string => {
    if (!layersOrAsset) return 'none';
    
    let layers: string[] = [];
    let adj = adjustments;
    let pre = preset;
    
    if (layersOrAsset && typeof layersOrAsset === 'object' && !Array.isArray(layersOrAsset)) {
        // It's a UniversalMedia asset object!
        layers = layersOrAsset.polishLayers || [];
        adj = layersOrAsset.adjustmentStack;
        pre = layersOrAsset.preset;
    } else if (Array.isArray(layersOrAsset)) {
        layers = layersOrAsset;
    }
    
    let filterString = layers
        .filter(l => l && typeof l === 'string')
        .map(l => l.trim())
        .join(' ');
        
    if (pre && pre !== 'original' && (DARKROOM_PRESETS as any)[pre]) {
        const presetFilters = (DARKROOM_PRESETS as any)[pre];
        if (Array.isArray(presetFilters) && presetFilters.length > 0) {
            filterString += ' ' + presetFilters.join(' ');
        }
    }
    
    if (adj) {
        const { exposure = 0, brightness = 0, contrast = 0, saturation = 0, sepia = 0, blur = 0, hue = 0 } = adj;
        if (exposure !== 0) filterString += ` brightness(${100 + exposure}%)`;
        if (brightness !== 0) filterString += ` brightness(${100 + brightness}%)`;
        if (contrast !== 0) filterString += ` contrast(${100 + contrast}%)`;
        if (saturation !== 0) filterString += ` saturate(${100 + saturation}%)`;
        if (sepia !== 0) filterString += ` sepia(${sepia}%)`;
        if (blur !== 0) filterString += ` blur(${blur}px)`;
        if (hue !== 0) filterString += ` hue-rotate(${hue}deg)`;
    }
    
    return filterString.trim() || 'none';
};

/**
 * PRESET DEFINITIONS: Neural Visuals
 */
export const DARKROOM_PRESETS = {
    original: [],
    punch: ["contrast(120%)", "saturate(110%)", "brightness(105%)"],
    golden: ["sepia(30%)", "brightness(110%)", "saturate(120%)", "hue-rotate(-5deg)"],
    radiate: ["brightness(115%)", "saturate(130%)", "contrast(105%)"],
    warm_contrast: ["sepia(20%)", "contrast(125%)", "saturate(110%)"],
    calm: ["saturate(80%)", "brightness(105%)", "contrast(95%)", "hue-rotate(5deg)"],
    cool_light: ["hue-rotate(180deg)", "sepia(10%)", "brightness(110%)", "saturate(90%)"],
    vivid_cool: ["hue-rotate(180deg)", "sepia(5%)", "saturate(150%)", "contrast(110%)"],
    dramatic_cool: ["hue-rotate(190deg)", "saturate(70%)", "contrast(130%)", "brightness(90%)"],
    bw: ["grayscale(100%)", "contrast(110%)"],
    bw_cool: ["grayscale(100%)", "contrast(110%)", "sepia(10%)", "hue-rotate(180deg)"],
    bw_warm: ["grayscale(100%)", "contrast(110%)", "sepia(20%)"],
    bw_high_contrast: ["grayscale(100%)", "contrast(180%)", "brightness(90%)"],
    burn: ["contrast(150%)", "saturate(180%)", "brightness(80%)"],
    film: ["sepia(15%)", "saturate(90%)", "contrast(90%)", "brightness(105%)"],
    vintage: ["sepia(40%)", "saturate(80%)", "contrast(85%)", "brightness(110%)"]
};
