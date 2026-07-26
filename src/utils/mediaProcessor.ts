import { parseGIF, decompressFrames } from 'gifuct-js';

/**
 * EXTRACT GIF FRAMES (The "Flipbook" Engine)
 * Parses a raw GIF buffer, reconstructs the frames (handling partial updates/transparency),
 * and returns a set of Base64 images for the AI to "watch".
 */
export const extractGifFrames = async (url: string, frameCount: number = 10): Promise<string[]> => {
    try {
        // 1. Fetch the raw bytes
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();

        // 2. Parse GIF structure
        const gif = parseGIF(buffer);
        const frames = decompressFrames(gif, true); // true = build patch

        if (!frames || frames.length === 0) throw new Error("No frames found in GIF");

        // 3. Setup Canvas (We must draw them to handle transparency/disposal methods)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context failed");

        // Use the GIF's logical screen size
        canvas.width = gif.lsd.width;
        canvas.height = gif.lsd.height;

        // 4. Frame Selection Logic (Spread evenly)
        const step = Math.max(1, Math.floor(frames.length / frameCount));
        const selectedSnapshots: string[] = [];

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            
            // [ZEN FIX] Explicitly recreate the TypedArray to satisfy TypeScript strictness
            // Error 2769: Argument of type 'Uint8ClampedArray<ArrayBufferLike>' is not assignable...
            const safePatchData = new Uint8ClampedArray(frame.patch);

            const frameImageData = new ImageData(
                safePatchData, 
                frame.dims.width, 
                frame.dims.height
            );
            
            // Create a temp canvas for the patch to handle offset
            const patchCanvas = document.createElement('canvas');
            patchCanvas.width = frame.dims.width;
            patchCanvas.height = frame.dims.height;
            const patchCtx = patchCanvas.getContext('2d');
            patchCtx?.putImageData(frameImageData, 0, 0);

            // Draw patch onto main canvas at correct offset
            ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

            // Capture logic: Is this a frame we want to show the AI?
            if (i % step === 0 && selectedSnapshots.length < frameCount) {
                // Downscale for AI token efficiency (Max 512px width)
                const scale = Math.min(1, 512 / canvas.width);
                
                if (scale < 1) {
                    const scaledCanvas = document.createElement('canvas');
                    scaledCanvas.width = canvas.width * scale;
                    scaledCanvas.height = canvas.height * scale;
                    scaledCanvas.getContext('2d')?.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
                    selectedSnapshots.push(scaledCanvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
                } else {
                    selectedSnapshots.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
                }
            }
        }

        return selectedSnapshots;

    } catch (e: any) {
        console.error("GIF Extraction Failed:", e);
        throw new Error(`Failed to parse GIF: ${e.message}`);
    }
};

/**
 * EXTRACT VIDEO FRAMES (The Narrative Scanner)
 * Extracts a sequence of base64 frames from a video URL.
 * Defaults to 30 frames to ensure sports/action sequences are captured.
 */
export const extractVideoFrames = async (videoUrl: string, frameCount: number = 30): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous'; // Critical for Firebase Storage CORS
        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;

        const frames: string[] = [];
        
        video.onloadedmetadata = async () => {
            const duration = video.duration;
            const interval = duration / (frameCount + 1); // Distribute frames
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error("Canvas context failed"));
                return;
            }

            // Set canvas to a reasonable AI-vision size (e.g., 512px width) to save tokens
            const scale = 512 / video.videoWidth;
            canvas.width = 512;
            canvas.height = video.videoHeight * scale;

            try {
                for (let i = 1; i <= frameCount; i++) {
                    video.currentTime = interval * i;
                    await new Promise(r => video.onseeked = r);
                    
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    // Use JPEG 0.7 for token efficiency
                    const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
                    frames.push(base64);
                }
                resolve(frames);
            } catch (e) {
                reject(e);
            } finally {
                video.remove(); // Cleanup
            }
        };

        video.onerror = (e) => reject(new Error(`Video load failed: ${(e as any).message || 'Unknown error'}`));
    });
};

/**
 * EXTRACT DOCUMENT TEXT
 * Fetches and extracts text from supported document URLs.
 * Currently supports: Plain Text, Markdown, JSON, Source Code.
 */
export const extractDocumentText = async (url: string, mimeType: string): Promise<string> => {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

        // 1. Plain Text / Code
        if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('xml')) {
            const text = await response.text();
            return text.substring(0, 20000); // Token safety cap
        }

        // 2. PDF (Placeholder - requires pdfjs-dist)
        if (mimeType.includes('pdf')) {
            return "[System: PDF content extraction currently requires 'pdfjs-dist'. For now, only the filename and metadata are visible to the AI.]";
        }

        // 3. Binary Docs (Placeholder)
        return `[System: Binary document (${mimeType}) content cannot be read directly yet. Only metadata is available.]`;

    } catch (e: any) {
        console.error("Text extraction failed", e);
        return `[Error reading document: ${e.message}]`;
    }
};