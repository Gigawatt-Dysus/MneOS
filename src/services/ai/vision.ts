// services/ai/vision.ts

import { callFireworks, callXAI } from './providers';
import { addApiLog } from './logging';
import { fetchImageAsBase64 } from './perception';
import type { Media } from '../../types';
import { getPrimaryModelId } from './config';

// [ZEN FIX] Grok 4.3 Vision Supremacy
const PRIMARY_VISION_MODEL = 'grok-4.3'; 
const FALLBACK_VISION_MODEL = 'grok-4.3'; 

export const analyzeVisuals = async (
    mediaItems: Media[], 
    question: string,
    fireworksKey?: string 
): Promise<string> => {
    
    // Process top 5 images/frames
    const processingPromises = mediaItems.slice(0, 5).map(async (m) => {
        try {
            if (m.base64Data && m.fileType?.startsWith('image/')) {
                return { inlineData: { mimeType: m.fileType, data: m.base64Data } };
            }
            const targetUrl = m.url || m.thumbnailUrl;
            if (targetUrl && (m.fileType?.startsWith('image/') || targetUrl.match(/\.(jpeg|jpg|png|webp)/i))) {
                const base64 = await fetchImageAsBase64(targetUrl);
                return { inlineData: { mimeType: m.fileType || 'image/jpeg', data: base64 } };
            }
            return null;
        } catch (e) {
            return null;
        }
    });

    const imageParts = (await Promise.all(processingPromises)).filter(Boolean);

    if (imageParts.length === 0) return "I couldn't access the visual data for those files.";

    const prompt = `Look at these images. Question: "${question}". Describe what you see relevant to the question. Be concise and warm.`;
    
    // 1. Try Fireworks (Qwen -> Grok Cascade)
    if (fireworksKey) {
        try {
            const res = await callFireworks(PRIMARY_VISION_MODEL, 
                [{ role: 'user', parts: [...imageParts, { text: prompt }] }], 
                "You are an expert visual analyst.",
                fireworksKey
            );
            return res.text || "Vision analysis empty.";
        } catch (e: any) {
            console.warn("Fireworks/Grok Vision Cascade failed, ultimate fallback...", e);
            addApiLog('warning', PRIMARY_VISION_MODEL, `Vision Cascade Failed: ${e.message}`);
        }
    }

    // 2. Ultimate Fallback to Grok 4.3 (xAI)
    try {
        const res = await callXAI(FALLBACK_VISION_MODEL, 
            [{ role: 'user', parts: [...imageParts, { text: prompt }] }],
            "You are an expert visual analyst."
        );
        return res.text || "Grok saw nothing.";
    } catch (grokError: any) {
            addApiLog('error', FALLBACK_VISION_MODEL, `Backup Vision Failed: ${grokError.message}`);
            return "Vision processing failed (All Providers).";
    }
};

/**
 * [ZEN] Neural Polish Engine: Suggests the optimal enhancement filter
 * Uses Grok 4.3 Vision to analyze exposure, contrast, and color balance.
 */
export const suggestPolishPreset = async (
    mediaUrl: string,
    fileType?: string
): Promise<'pop' | 'natural' | 'lift' | 'dim' | 'vibrant'> => {
    try {
        const base64 = await fetchImageAsBase64(mediaUrl);
        const imagePart = { inlineData: { mimeType: fileType || 'image/jpeg', data: base64 } };

        const prompt = `
            Analyze this image technically.
            1. If it is underexposed (too dark), recommend 'lift'.
            2. If it is overexposed (too bright/blown out), recommend 'dim'.
            3. If it is muddy or lacks contrast, recommend 'pop'.
            4. If the colors are flat/dull, recommend 'vibrant'.
            5. If it is already well-balanced, recommend 'natural'.

            Return EXCLUSIVELY one of these strings: pop, natural, lift, dim, vibrant.
        `;

        let suggested = '';

        // 1. Try Fireworks/Grok Cascade (Sovereign/Credit-Safe)
        const fireworksKey = (typeof (window as any).SecretsManager !== 'undefined' ? (window as any).SecretsManager.get('fireworks') : null) || import.meta.env.VITE_FIREWORKS_API_KEY as string;
        
        if (fireworksKey) {
            try {
                const res = await callFireworks(PRIMARY_VISION_MODEL, 
                    [{ role: 'user', parts: [imagePart, { text: prompt }] }], 
                    "You are a technical image analyst.",
                    fireworksKey,
                    { temperature: 0.1, maxOutputTokens: 20 }
                );
                suggested = res.text?.trim().toLowerCase();
            } catch (e) {
                console.warn("[Vision] Polish Cascade Level 1 failed, falling back to Grok...", e);
            }
        }

        // 2. Fallback to Grok (If Cascade fails or key missing)
        if (!suggested) {
            try {
                const res = await callXAI(FALLBACK_VISION_MODEL, 
                    [{ role: 'user', parts: [imagePart, { text: prompt }] }],
                    "You are a technical image analyst.",
                    { temperature: 0.1, maxOutputTokens: 10 }
                );
                suggested = res.text?.trim().toLowerCase();
            } catch (e) {
                console.error("[Vision] Polish Cascade Level 2 failed:", e);
            }
        }

        const validPresets = ['pop', 'natural', 'lift', 'dim', 'vibrant'];
        // Clean up any extraneous words from AI output
        const match = suggested.match(/(pop|natural|lift|dim|vibrant)/);
        const finalChoice = match ? match[0] : (validPresets.includes(suggested) ? suggested : 'pop');

        return finalChoice as any;
    } catch (error) {
        console.error("[Vision] Polish Suggestion Failed:", error);
        return 'pop'; // Fallback
    }
};

/**
 * [G.I.G.I.] Lazy visual fingerprint inference from tag media metadata
 */
export const inferTagVisualProfile = async (
    tag: any,
    mediaList: Media[],
    customContext?: string
): Promise<string> => {
    try {
        const relatedMedia = mediaList.filter(m => 
            !m.isFiction && !m.isAvatar && (m.tagIds?.includes(tag.id) || m.id === tag.mainImageId)
        ).slice(0, 30);

        if (relatedMedia.length === 0) {
            return "No visual media associated with this tag to infer visual profiles.";
        }

        const mediaSummary = relatedMedia.map(m => 
            `- Caption: "${m.caption || 'No caption'}", Date: ${m.logicalDate || m.year || 'Unknown'}, Location: ${m.location?.address || 'Unknown'}`
        ).join('\n');

        const systemPrompt = "You are Guided Intelligence Generational Intuition (G.I.G.I.), Eric's sovereign family archival AI.";
        let userPrompt = `
Analyze the following media metadata for tag "${tag.name}" (type: ${tag.type}, description: ${tag.description || 'none'}).
Extract a visual fingerprint profile summarizing typical settings, clothing, background landmarks, or physical traits shown across these records. 

Keep it to 3-4 concise, descriptive bullet points. Avoid references to filenames or technical IDs. Focus strictly on visual trends to build a RAG representation of this subject.

Media Metadata:
${mediaSummary}
        `;

        if (customContext && customContext.trim() !== '') {
            userPrompt += `\n\nCRITICAL CONTEXT FROM ARCHITECT (Override the visual metadata if contradictory):\n${customContext}\nEnsure you weave this fact seamlessly into the profile points.`;
        }

        const response = await callXAI('grok-4.3', [
            { role: 'user', parts: [{ text: userPrompt }] }
        ], systemPrompt, { temperature: 0.3, maxOutputTokens: 500 });

        return response.text?.trim() || "Unable to synthesize visual profile.";
    } catch (error) {
        console.error("[Vision] Tag Visual Inference Failed:", error);
        return "Visual calibration deferred due to network/provider response status.";
    }
};

/**
 * [G.I.G.I.] Grounded Resemblance Narrative Synthesis for generated "What-If" content
 */
export const synthesizeRenderNarrative = async (
    prompt: string,
    renderUrl: string,
    linkedTags: any[]
): Promise<string> => {
    try {
        const entityDetails = linkedTags.map(t => 
            `- Name: "${t.name}" (Type: ${t.type}, Description: ${t.description || 'none'})`
        ).join('\n');

        const systemPrompt = "You are Guided Intelligence Generational Intuition (G.I.G.I.), Eric's sovereign family archival AI.";
        const userPrompt = `
We have generated a fictional "what-if" memory media based on the prompt: "${prompt}".
The scene contains the following subject entities as visual anchors:
${entityDetails}

Write a short, warm narrative description (2-3 sentences) suitable for a family memory archive. 
CRITICAL: Refer to subjects directly by their actual names (e.g., use the names from the list above like "Ruth", "Eric", etc.) instead of generic pronouns or descriptors (like "a man and a woman", "the husband", "the subjects"). Blending the prompt's intent with the visual render.

Output only the synthesized narrative paragraph.
        `;

        // Attempt Vision call if key/file exists, otherwise fall back to text synthesis
        let responseText = "";
        try {
            if (renderUrl && (renderUrl.startsWith('http') || renderUrl.startsWith('data:'))) {
                const base64 = await fetchImageAsBase64(renderUrl);
                const imagePart = { inlineData: { mimeType: 'image/jpeg', data: base64 } };
                const response = await callXAI('grok-4.3', [
                    { role: 'user', parts: [imagePart, { text: userPrompt }] }
                ], systemPrompt, { temperature: 0.5, maxOutputTokens: 600 });
                responseText = response.text || "";
            }
        } catch (visionErr) {
            console.warn("[Vision] Image-based narrative fallback to text-only:", visionErr);
        }

        if (!responseText) {
            const response = await callXAI('grok-4.3', [
                { role: 'user', parts: [{ text: userPrompt }] }
            ], systemPrompt, { temperature: 0.5, maxOutputTokens: 600 });
            responseText = response.text || "";
        }

        return responseText.trim() || `What-if reimagining based on prompt: "${prompt}"`;
    } catch (error) {
        console.error("[Vision] Narrative synthesis failed:", error);
        return `What-if reimagining based on prompt: "${prompt}"`;
    }
};