// services/ai/vision.ts

import { callFireworks, callGemini } from './providers';
import { addApiLog } from './logging';
import { fetchImageAsBase64 } from './perception';
import type { Media } from '@/types';

// [ZEN FIX] Fireworks Vision Model (Qwen 2.5-VL 72B is used by callFireworks internally)
// We pass this ID to trigger the Vision Cascade in providers.ts
const PRIMARY_VISION_MODEL = 'accounts/fireworks/models/qwen2p5-vl-72b-instruct'; 
const FALLBACK_VISION_MODEL = 'gemini-1.5-flash';

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

    // 2. Ultimate Fallback to Gemini (If Fireworks Key missing or total failure)
    try {
        const res = await callGemini(FALLBACK_VISION_MODEL, {
            contents: [{ role: 'user', parts: [...imageParts, { text: prompt }] }]
        });
        return res.text || "Gemini saw nothing.";
    } catch (geminiError: any) {
            addApiLog('error', FALLBACK_VISION_MODEL, `Backup Vision Failed: ${geminiError.message}`);
            return "Vision processing failed (All Providers).";
    }
};