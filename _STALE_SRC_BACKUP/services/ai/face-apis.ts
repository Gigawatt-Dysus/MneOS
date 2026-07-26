import * as faceapi from 'face-api.js';
import type { Tag, Media, PersonTag } from '@/types';

// Configuration
const MODEL_URL = '/models'; 
const MATCH_THRESHOLD = 0.5; // Lower = Stricter

let isModelLoaded = false;

// [ZEN FIX] Type Guard to satisfy TypeScript compiler
const isPersonTag = (tag: Tag): tag is PersonTag => {
    return tag.type === 'person';
};

export const FaceRecognitionService = {
    
    /**
     * Initialize TensorFlow models. Call this once on app boot or first scan.
     */
    loadModels: async () => {
        if (isModelLoaded) return;
        console.log("[FaceRec] Loading Neural Nets...");
        
        try {
            await Promise.all([
                faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Detector
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), // Landmarks
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL) // Descriptors
            ]);
            
            isModelLoaded = true;
            console.log("[FaceRec] Neural Nets Online.");
        } catch (e) {
            console.error("[FaceRec] Failed to load models. Ensure files are in /public/models/", e);
            throw e;
        }
    },

    /**
     * Generate a "Face Descriptor" (Unique ID) for a Person Tag.
     * This should be called when you set a Profile Picture for a Person.
     */
    encodeReferenceFace: async (imageUrl: string): Promise<Float32Array | null> => {
        if (!isModelLoaded) await FaceRecognitionService.loadModels();
        
        try {
            // Fetch image to HTML element for processing
            const img = await faceapi.fetchImage(imageUrl);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            
            if (!detection) {
                console.warn("[FaceRec] No face found in reference image.");
                return null;
            }
            
            return detection.descriptor;
        } catch (e) {
            console.error("[FaceRec] Error encoding reference face", e);
            return null;
        }
    },

    /**
     * Scan a media item and return matching Person Tag IDs.
     */
    scanMediaForFaces: async (media: Media, personTags: Tag[]): Promise<string[]> => {
        if (!isModelLoaded) await FaceRecognitionService.loadModels();
        
        const targetUrl = media.url || media.thumbnailUrl;
        if (!targetUrl) return [];

        try {
            // 1. Build Labeled Descriptors from Person Tags
            const labeledDescriptors = personTags
                .filter(isPersonTag) // [ZEN FIX] Use type guard
                .filter(t => t.metadata.faceDescriptor) // Now safe to access
                .map(t => new faceapi.LabeledFaceDescriptors(
                    t.id, 
                    [new Float32Array(Object.values(t.metadata.faceDescriptor!))] // '!' asserts non-null
                ));

            if (labeledDescriptors.length === 0) return [];

            const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);

            // 2. Detect all faces in the new image
            const img = await faceapi.fetchImage(targetUrl);
            const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();

            // 3. Match against database
            const matches = new Set<string>();
            
            detections.forEach(fd => {
                const bestMatch = faceMatcher.findBestMatch(fd.descriptor);
                if (bestMatch.label !== 'unknown') {
                    matches.add(bestMatch.label); // The Label IS the Tag ID
                }
            });

            return Array.from(matches);
        } catch (e) {
            console.warn(`[FaceRec] Could not scan ${media.id}`, e);
            return [];
        }
    }
};