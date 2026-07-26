/**
 * Azure Vision Service
 * Cloud-based face detection using Azure Cognitive Services Face API
 * 
 * [ZEN EWO 002] Replaces client-side face-api.js with Azure cloud processing
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FaceRectangle {
    top: number;
    left: number;
    width: number;
    height: number;
}

export interface FaceAttributes {
    age?: number;
    smile?: number;
    glasses?: 'NoGlasses' | 'ReadingGlasses' | 'Sunglasses' | 'SwimmingGoggles';
    emotion?: {
        anger: number;
        contempt: number;
        disgust: number;
        fear: number;
        happiness: number;
        neutral: number;
        sadness: number;
        surprise: number;
    };
    hair?: {
        bald: number;
        invisible: boolean;
        hairColor: Array<{ color: string; confidence: number }>;
    };
    headPose?: {
        pitch: number;
        roll: number;
        yaw: number;
    };
    blur?: { blurLevel: 'Low' | 'Medium' | 'High'; value: number };
    exposure?: { exposureLevel: 'UnderExposure' | 'GoodExposure' | 'OverExposure'; value: number };
    qualityForRecognition?: 'Low' | 'Medium' | 'High';
}

export interface FaceDetection {
    faceId?: string;
    faceRectangle: FaceRectangle;
    faceAttributes?: FaceAttributes;
}

export interface DetectionResult {
    success: boolean;
    faces: FaceDetection[];
    error?: string;
    imageWidth?: number;
    imageHeight?: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

import { getAzureFaceKey, getAzureFaceEndpoint } from './config';

const getAzureConfig = () => ({
    apiKey: getAzureFaceKey(),
    endpoint: getAzureFaceEndpoint(),
});

// ============================================================================
// AZURE VISION SERVICE
// ============================================================================

export const AzureVisionService = {

    /**
     * Check if Azure Face API is configured
     */
    isConfigured: (): boolean => {
        const { apiKey, endpoint } = getAzureConfig();
        return !!(apiKey && endpoint);
    },

    /**
     * Detect faces in an image URL
     * Returns bounding boxes and optional attributes (emotion, age, hair, etc.)
     * 
     * Note: Some attributes like gender/emotion may be restricted by Microsoft's
     * Responsible AI policies depending on your access level.
     */
    detectFaces: async (imageUrl: string, options?: {
        returnFaceId?: boolean;
        returnFaceAttributes?: string[];
    }): Promise<DetectionResult> => {
        const { apiKey, endpoint } = getAzureConfig();

        if (!apiKey || !endpoint) {
            console.error('[AzureVision] API key or endpoint not configured');
            return { success: false, faces: [], error: 'Azure Face API not configured' };
        }

        // Build query parameters
        const params = new URLSearchParams({
            returnFaceId: String(options?.returnFaceId ?? false),
            returnFaceLandmarks: 'false',
            recognitionModel: 'recognition_04',
            detectionModel: 'detection_03',
        });

        // Add face attributes if requested
        // Available: age, blur, exposure, glasses, hair, headPose, qualityForRecognition, smile
        // Note: 'emotion', 'gender', 'makeup', 'accessories' may require Limited Access approval
        if (options?.returnFaceAttributes?.length) {
            params.append('returnFaceAttributes', options.returnFaceAttributes.join(','));
        }

        const url = `${endpoint}/face/v1.0/detect?${params.toString()}`;

        try {
            console.log('[AzureVision] Detecting faces in image...');

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': apiKey,
                },
                body: JSON.stringify({ url: imageUrl }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[AzureVision] API Error (${response.status}):`, errorText);

                // Handle specific errors
                if (response.status === 401) {
                    return { success: false, faces: [], error: 'Invalid API key' };
                }
                if (response.status === 403) {
                    return { success: false, faces: [], error: 'Access denied - Limited Access features may require approval' };
                }
                if (response.status === 400) {
                    return { success: false, faces: [], error: 'Invalid image or request' };
                }
                if (response.status === 429) {
                    return { success: false, faces: [], error: 'Rate limited - try again later' };
                }

                return { success: false, faces: [], error: `API error: ${response.status}` };
            }

            const faces: FaceDetection[] = await response.json();
            console.log(`[AzureVision] Detected ${faces.length} face(s)`);

            return { success: true, faces };

        } catch (error: any) {
            console.error('[AzureVision] Request failed:', error);
            return { success: false, faces: [], error: error.message || 'Network error' };
        }
    },

    /**
     * Detect faces from binary image data (Blob)
     */
    detectFacesFromBlob: async (imageBlob: Blob, options?: {
        returnFaceId?: boolean;
        returnFaceAttributes?: string[];
    }): Promise<DetectionResult> => {
        const { apiKey, endpoint } = getAzureConfig();

        if (!apiKey || !endpoint) {
            console.error('[AzureVision] API key or endpoint not configured');
            return { success: false, faces: [], error: 'Azure Face API not configured' };
        }

        const params = new URLSearchParams({
            returnFaceId: String(options?.returnFaceId ?? false),
            returnFaceLandmarks: 'false',
            recognitionModel: 'recognition_04',
            detectionModel: 'detection_03',
        });

        if (options?.returnFaceAttributes?.length) {
            params.append('returnFaceAttributes', options.returnFaceAttributes.join(','));
        }

        const url = `${endpoint}/face/v1.0/detect?${params.toString()}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Ocp-Apim-Subscription-Key': apiKey,
                },
                body: imageBlob,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[AzureVision] API Error:`, errorText);
                return { success: false, faces: [], error: `API error: ${response.status}` };
            }

            const faces: FaceDetection[] = await response.json();
            return { success: true, faces };

        } catch (error: any) {
            console.error('[AzureVision] Request failed:', error);
            return { success: false, faces: [], error: error.message || 'Network error' };
        }
    },

    /**
     * Generate a human-readable summary of face attributes
     * Useful for enriching media descriptions
     */
    getAttributesSummary: (face: FaceDetection): string => {
        if (!face.faceAttributes) return 'Face detected';

        const attrs = face.faceAttributes;
        const parts: string[] = [];

        // Age
        if (attrs.age) {
            parts.push(`approximately ${Math.round(attrs.age)} years old`);
        }

        // Emotion (find dominant emotion)
        if (attrs.emotion) {
            const emotions = Object.entries(attrs.emotion);
            const dominant = emotions.reduce((a, b) => a[1] > b[1] ? a : b);
            if (dominant[1] > 0.5) {
                parts.push(`expressing ${dominant[0]}`);
            }
        }

        // Smile
        if (attrs.smile !== undefined) {
            if (attrs.smile > 0.7) parts.push('smiling');
            else if (attrs.smile > 0.3) parts.push('slight smile');
        }

        // Glasses
        if (attrs.glasses && attrs.glasses !== 'NoGlasses') {
            parts.push(`wearing ${attrs.glasses.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`);
        }

        // Hair
        if (attrs.hair && !attrs.hair.invisible) {
            if (attrs.hair.bald > 0.7) {
                parts.push('bald');
            } else if (attrs.hair.hairColor?.length) {
                const topColor = attrs.hair.hairColor[0];
                if (topColor.confidence > 0.5) {
                    parts.push(`${topColor.color} hair`);
                }
            }
        }

        // Quality
        if (attrs.qualityForRecognition === 'Low') {
            parts.push('(low quality image)');
        }

        return parts.length > 0 ? `Person: ${parts.join(', ')}` : 'Face detected';
    },

    /**
     * Crop a face region from an image
     * Returns a canvas-based crop URL
     */
    cropFace: async (imageUrl: string, rect: FaceRectangle, padding: number = 0.2): Promise<string | null> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                try {
                    // Add padding around the face
                    const padX = rect.width * padding;
                    const padY = rect.height * padding;

                    const x = Math.max(0, rect.left - padX);
                    const y = Math.max(0, rect.top - padY);
                    const w = Math.min(img.width - x, rect.width + padX * 2);
                    const h = Math.min(img.height - y, rect.height + padY * 2);

                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(null);
                        return;
                    }

                    ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                } catch (e) {
                    console.error('[AzureVision] Crop failed:', e);
                    resolve(null);
                }
            };

            img.onerror = () => {
                console.error('[AzureVision] Failed to load image for cropping');
                resolve(null);
            };

            img.src = imageUrl;
        });
    },

    /**
     * Process an image and get all face crops with attributes
     */
    extractFacesWithMetadata: async (imageUrl: string): Promise<{
        faces: Array<{
            crop: string | null;
            rectangle: FaceRectangle;
            summary: string;
            attributes?: FaceAttributes;
        }>;
        error?: string;
    }> => {
        // Detect faces with available attributes
        const result = await AzureVisionService.detectFaces(imageUrl, {
            returnFaceId: false,
            returnFaceAttributes: ['age', 'smile', 'glasses', 'hair', 'headPose', 'blur', 'exposure', 'qualityForRecognition'],
        });

        if (!result.success) {
            return { faces: [], error: result.error };
        }

        // Generate crops and summaries
        const facesWithData = await Promise.all(
            result.faces.map(async (face) => {
                const crop = await AzureVisionService.cropFace(imageUrl, face.faceRectangle);
                return {
                    crop,
                    rectangle: face.faceRectangle,
                    summary: AzureVisionService.getAttributesSummary(face),
                    attributes: face.faceAttributes,
                };
            })
        );

        return { faces: facesWithData };
    },
};

// ============================================================================
// CONSOLE ACCESS
// ============================================================================

if (typeof window !== 'undefined') {
    (window as any).azureVision = AzureVisionService;
    // console.log('[AzureVision] Service loaded. Access via window.azureVision');
}

export default AzureVisionService;
