import * as faceapi from 'face-api.js';
import type { Media, Tag } from '@/types';

// Singleton to hold models state
let modelsLoaded = false;

export const FaceRecognitionService = {
    
    loadModels: async () => {
        if (modelsLoaded) return;
        try {
            console.log("[FaceRec] Loading Neural Nets...");
            const modelPath = '/models'; 
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
                faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
                faceapi.nets.faceRecognitionNet.loadFromUri(modelPath)
            ]);
            modelsLoaded = true;
            console.log("[FaceRec] Neural Nets Online.");
        } catch (e) {
            console.error("[FaceRec] Failed to load models:", e);
            throw new Error("AI Models failed to load.");
        }
    },

    encodeReferenceFace: async (imageUrl: string): Promise<Float32Array | null> => {
        if (!modelsLoaded) await FaceRecognitionService.loadModels();
        try {
            const img = await faceapi.fetchImage(imageUrl);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            return detection ? detection.descriptor : null;
        } catch (e) {
            console.error("[FaceRec] Failed to encode reference:", e);
            return null;
        }
    },

    /**
     * [ZEN OPTIMIZED] Build the Matcher ONCE, then reuse it.
     */
    createFaceMatcher: async (allPeople: Tag[]): Promise<faceapi.FaceMatcher | null> => {
        if (!modelsLoaded) await FaceRecognitionService.loadModels();

        const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];
        console.log(`[FaceRec] Building Matcher from ${allPeople.length} candidates...`);

        allPeople.forEach((t, index) => {
            if (t.type !== 'person') return;

            let meta = t.metadata;
            // Handle legacy stringified JSON
            if (typeof meta === 'string') {
                try { meta = JSON.parse(meta); } catch (e) { return; }
            }

            const rawDesc = (meta as any)?.faceDescriptor;

            // [DEBUG] Log the first candidate deeply so we can see the data structure
            if (index === 0) {
                console.log("[FaceRec DEBUG] First Candidate Data:", { name: t.name, rawType: typeof rawDesc, isArray: Array.isArray(rawDesc), rawVal: rawDesc });
            }

            if (!rawDesc) {
                // Uncomment to see missing data
                // console.warn(`[FaceRec] Skipping ${t.name}: No descriptor.`);
                return;
            }

            let descriptor: Float32Array | null = null;

            try {
                if (Array.isArray(rawDesc)) {
                    descriptor = new Float32Array(rawDesc);
                } else if (typeof rawDesc === 'object') {
                    // [ZEN FIX] Aggressive Object Conversion
                    // Force values into array, ignoring keys if they are just indices
                    const values = Object.values(rawDesc);
                    if (values.length === 128) {
                        descriptor = new Float32Array(values as number[]);
                    } else {
                        console.warn(`[FaceRec] Skipping ${t.name}: Object has ${values.length} values (need 128).`);
                    }
                } 

                if (descriptor && descriptor.length === 128) {
                    labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(t.id, [descriptor]));
                } else {
                    console.warn(`[FaceRec] Invalid descriptor for ${t.name}`);
                }
            } catch (e) {
                console.error(`[FaceRec] Parse error for ${t.name}`, e);
            }
        });

        if (labeledDescriptors.length === 0) {
            console.error("[FaceRec] 0 valid descriptors loaded. Scanner cannot function.");
            return null;
        }

        console.log(`[FaceRec] Matcher Ready. ${labeledDescriptors.length} faces enrolled.`);
        return new faceapi.FaceMatcher(labeledDescriptors, 0.55);
    },

    /**
     * Scan using a pre-built matcher (Faster loop)
     */
    scanWithMatcher: async (media: Media, faceMatcher: faceapi.FaceMatcher): Promise<string[]> => {
        let img: HTMLImageElement;
        try {
            const url = media.thumbnailUrls?.large || media.thumbnailUrls?.medium || media.url;
            img = await faceapi.fetchImage(url);
        } catch (e) {
            // console.warn(`[FaceRec] Failed to load image: ${media.id}`);
            return [];
        }

        const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
        if (detections.length === 0) return [];

        const foundTagIds = new Set<string>();
        detections.forEach(fd => {
            const bestMatch = faceMatcher.findBestMatch(fd.descriptor);
            if (bestMatch.label !== 'unknown') {
                foundTagIds.add(bestMatch.label);
            }
        });
        return Array.from(foundTagIds);
    },

    // Legacy method for backward compatibility (slower)
    scanMediaForFaces: async (media: Media, allPeople: Tag[]): Promise<string[]> => {
        const matcher = await FaceRecognitionService.createFaceMatcher(allPeople);
        if (!matcher) return [];
        return await FaceRecognitionService.scanWithMatcher(media, matcher);
    }
};