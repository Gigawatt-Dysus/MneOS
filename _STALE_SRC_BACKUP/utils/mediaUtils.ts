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
