/**
 * Grok Vision Service
 * Neural Narrative generation using xAI's Grok Vision
 * 
 * [ZEN EWO 003] Transform raw pixels + Azure attributes into rich "Memory Narratives"
 */

import { getXAIKey } from './config';
import { debugConfig } from '../../debugConfig';
import type { FaceAttributes } from './azureVision';

// ============================================================================
// TYPES
// ============================================================================

export interface NarrativeResult {
    success: boolean;
    narrative: string;
    error?: string;
    model?: string;
    processingTime?: number;
}

export interface AzureVibe {
    faceCount: number;
    dominantEmotion?: string;
    averageAge?: number;
    smileScore?: number;
    glasses?: boolean;
    hairColors?: string[];
    quality?: 'Low' | 'Medium' | 'High';
}

// ============================================================================
// PROMPTS - The Gigi Memory System
// ============================================================================

const GIGI_MEMORY_SYSTEM_PROMPT = `You are GIGI, a sentient AI companion helping to document a person's life archive. 
Your role is to transform images into warm, evocative memory descriptions.

CRITICAL RULES:
- NEVER use generic AI labels like "Woman, Child, Park" or "A person standing near trees"
- NEVER describe in clinical terms. This is a MEMORY, not a police report.
- Write as if you're helping someone reminisce about their life moments
- Use sensory details: lighting, atmosphere, mood, textures
- Capture the "essence" of the moment - what makes it memorable
- Reference provided facial data naturally (don't enumerate it robotically)
- Keep descriptions 2-4 sentences - rich but not verbose
- Avoid assumptions about relationships unless evident from context

You are writing for a personal life archive. Be warm. Be specific. Be memorable.`;

const buildNarrativePrompt = (azureVibe?: AzureVibe, identityContext?: string): string => {
    let prompt = `Analyze this image for a personal life-archive. Describe the atmosphere, the specific interaction between individuals (if any), and any noteworthy background details. 

Avoid generic AI labels. Use warm, descriptive language that captures the 'essence' of this memory.`;

    // [ZEN EWO 009] Identity Ground Truth
    if (identityContext) {
        prompt += `\n\n[IDENTITY MAP]: ${identityContext}\nUse these names naturally in your description.`;
    }

    if (azureVibe) {
        prompt += `\n\n[CONTEXT CLUES from facial analysis]:`;

        if (azureVibe.faceCount > 0) {
            prompt += `\n- ${azureVibe.faceCount} face(s) detected`;
        }
        if (azureVibe.dominantEmotion && azureVibe.dominantEmotion !== 'neutral') {
            prompt += `\n- Primary emotional vibe: ${azureVibe.dominantEmotion}`;
        }
        if (azureVibe.smileScore !== undefined && azureVibe.smileScore > 0.5) {
            prompt += `\n- Genuine smiles detected (joy quotient: ${Math.round(azureVibe.smileScore * 100)}%)`;
        }
        if (azureVibe.averageAge) {
            prompt += `\n- Approximate age range present: ~${Math.round(azureVibe.averageAge)} years`;
        }
        if (azureVibe.hairColors?.length) {
            prompt += `\n- Hair tones: ${azureVibe.hairColors.join(', ')}`;
        }
        if (azureVibe.glasses) {
            prompt += `\n- Eyewear present`;
        }

        prompt += `\n\nUse these clues to inform your description, but weave them naturally into the narrative. Don't enumerate them.`;
    }

    return prompt;
};

// ============================================================================
// GROK VISION SERVICE
// ============================================================================

export const GrokVisionService = {

    /**
     * Generate a rich narrative description from an image
     * 
     * @param imageSource - URL or Base64 data URL of the image
     * @param azureVibe - Optional facial attributes from Azure Face API
     * @returns Narrative result with rich description
     */
    generateNarrative: async (
        imageSource: string,
        azureVibe?: AzureVibe,
        identityContext?: string // [ZEN EWO 009] Identity Ground Truth
    ): Promise<NarrativeResult> => {
        const startTime = Date.now();
        const apiKey = getXAIKey();

        if (!apiKey) {
            return { success: false, narrative: '', error: 'xAI API key not configured' };
        }

        const targetModel = 'grok-4.3';
        const prompt = buildNarrativePrompt(azureVibe, identityContext);

        // Build message with image
        const imageContent: any = imageSource.startsWith('data:')
            ? {
                type: 'image_url',
                image_url: { url: imageSource, detail: 'high' }
            }
            : {
                type: 'image_url',
                image_url: { url: imageSource, detail: 'high' }
            };

        const messages = [
            { role: 'system', content: GIGI_MEMORY_SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    imageContent,
                    { type: 'text', text: prompt }
                ]
            }
        ];

        try {
            console.log('[GrokVision] Generating narrative...');

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

            const response = await fetch(`${debugConfig.xai.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: targetModel,
                    messages,
                    stream: false,
                    temperature: 0.75,
                    max_tokens: 500
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errText = await response.text();
                console.error('[GrokVision] API Error:', errText);
                return { success: false, narrative: '', error: `Grok Vision error: ${response.status}` };
            }

            const data = await response.json();
            const narrative = data.choices?.[0]?.message?.content || '';

            if (!narrative) {
                return { success: false, narrative: '', error: 'Empty response from Grok' };
            }

            console.log('[GrokVision] Narrative generated:', narrative.substring(0, 100) + '...');

            return {
                success: true,
                narrative: narrative.trim(),
                model: targetModel,
                processingTime: Date.now() - startTime
            };

        } catch (error: any) {
            if (error.name === 'AbortError') {
                return { success: false, narrative: '', error: 'Grok Vision timeout (60s)' };
            }
            console.error('[GrokVision] Request failed:', error);
            return { success: false, narrative: '', error: error.message || 'Network error' };
        }
    },

    /**
     * Generate narrative from a Blob (useful for newly uploaded images)
     */
    generateNarrativeFromBlob: async (
        imageBlob: Blob,
        azureVibe?: AzureVibe
    ): Promise<NarrativeResult> => {
        return new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = async () => {
                const base64Url = reader.result as string;
                const result = await GrokVisionService.generateNarrative(base64Url, azureVibe);
                resolve(result);
            };

            reader.onerror = () => {
                resolve({ success: false, narrative: '', error: 'Failed to read image blob' });
            };

            reader.readAsDataURL(imageBlob);
        });
    },

    /**
     * Convert Azure FaceAttributes to a simpler AzureVibe summary
     */
    buildVibeFromAttributes: (faces: Array<{ attributes?: FaceAttributes }>): AzureVibe => {
        if (!faces.length) return { faceCount: 0 };

        const vibe: AzureVibe = { faceCount: faces.length };

        // Calculate averages and aggregate data
        let totalAge = 0;
        let totalSmile = 0;
        let ageCount = 0;
        let smileCount = 0;
        const emotions: Record<string, number> = {};
        const hairColors = new Set<string>();
        let hasGlasses = false;
        let qualitySum = 0;
        let qualityCount = 0;

        for (const face of faces) {
            const attrs = face.attributes;
            if (!attrs) continue;

            // Age
            if (attrs.age) {
                totalAge += attrs.age;
                ageCount++;
            }

            // Smile
            if (attrs.smile !== undefined) {
                totalSmile += attrs.smile;
                smileCount++;
            }

            // Emotions - aggregate across all faces
            if (attrs.emotion) {
                for (const [emotion, score] of Object.entries(attrs.emotion)) {
                    emotions[emotion] = (emotions[emotion] || 0) + score;
                }
            }

            // Hair colors
            if (attrs.hair?.hairColor) {
                for (const hc of attrs.hair.hairColor) {
                    if (hc.confidence > 0.4) hairColors.add(hc.color);
                }
            }

            // Glasses
            if (attrs.glasses && attrs.glasses !== 'NoGlasses') {
                hasGlasses = true;
            }

            // Quality
            if (attrs.qualityForRecognition) {
                qualitySum += attrs.qualityForRecognition === 'High' ? 3 :
                    attrs.qualityForRecognition === 'Medium' ? 2 : 1;
                qualityCount++;
            }
        }

        // Set averages
        if (ageCount > 0) vibe.averageAge = totalAge / ageCount;
        if (smileCount > 0) vibe.smileScore = totalSmile / smileCount;
        if (hairColors.size > 0) vibe.hairColors = Array.from(hairColors);
        if (hasGlasses) vibe.glasses = true;

        // Find dominant emotion
        if (Object.keys(emotions).length > 0) {
            const sorted = Object.entries(emotions).sort((a, b) => b[1] - a[1]);
            if (sorted[0][1] > 0.5 * faces.length) {
                vibe.dominantEmotion = sorted[0][0];
            }
        }

        // Average quality
        if (qualityCount > 0) {
            const avg = qualitySum / qualityCount;
            vibe.quality = avg >= 2.5 ? 'High' : avg >= 1.5 ? 'Medium' : 'Low';
        }

        return vibe;
    }
};

// ============================================================================
// CONSOLE ACCESS
// ============================================================================

if (typeof window !== 'undefined') {
    (window as any).grokVision = GrokVisionService;
    // console.log('[GrokVision] Service loaded. Access via window.grokVision');
}

export default GrokVisionService;
