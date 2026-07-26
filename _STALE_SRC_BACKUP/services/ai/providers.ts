import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { debugConfig } from '../../debugConfig';
import { getGeminiKey, getXAIKey } from './config';
import type { AiParams } from '@/types';
import { SecretsManager } from '../../utils/SecretsManager';

// [ZEN TOOL] History Truncator
// Used to prevent context window overflows (100k+ tokens) by slicing history
const truncateHistory = (messages: any[], limit: number = 20): any[] => {
    if (!messages || messages.length <= limit) return messages || [];
    
    // Always preserve the System Prompt (usually index 0)
    const system = messages[0];
    // Keep the last 'limit' messages
    const recent = messages.slice(-limit);
    
    console.log(`[Context Defense] Truncated history from ${messages.length} to ${recent.length + 1} items.`);
    return [system, ...recent];
};

// ------------------------------------------------------------------
// 1. LOCAL LLM PROVIDER (Ollama/LM Studio)
// ------------------------------------------------------------------
export const callLocalLLM = async (messages: any[], systemInstruction: string, modelOverride?: string): Promise<GenerateContentResponse> => {
    if (!debugConfig.local.enabled) {
        throw new Error("Local LLM is disabled in config.");
    }

    const model = modelOverride || debugConfig.local.mainModel;
    let url = debugConfig.local.url;
    // Normalize URL
    if (url.endsWith('/')) url = url.slice(0, -1);

    console.log(`%c[LocalLLM] Requesting ${model} via ${url}...`, 'color: orange; font-weight: bold;');
    
    const isV1 = url.includes('/v1');
    const endpoint = isV1 ? `${url}/chat/completions` : `${url}/api/chat`;

    // Format for OpenAI-compatible or Ollama-native
    const formattedMessages = [
        { role: 'system', content: systemInstruction },
        ...messages.map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.parts[0].text
        }))
    ];

    const body = isV1 ? {
        model: model,
        messages: formattedMessages,
        stream: false, 
        temperature: 0.8
    } : {
        model: model,
        messages: formattedMessages,
        stream: false, 
        options: { temperature: 0.8, num_ctx: 8192 }
    };

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s Timeout

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Local LLM HTTP Error: ${response.statusText}`);
        
        const data = await response.json();
        // Handle different response formats (Ollama vs OpenAI)
        let fullText = data.choices?.[0]?.message?.content || data.message?.content || data.response || "";
        
        return {
            text: fullText,
            candidates: [{ finishReason: 'STOP', content: { parts: [{ text: fullText }] } }]
        } as GenerateContentResponse;

    } catch (error: any) {
        if (error.name === 'AbortError') throw new Error("Local LLM Timed Out (60s)");
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error("Local LLM Unreachable (Offline or CORS)");
        }
        throw error;
    }
};

// ------------------------------------------------------------------
// 2. xAI (GROK) PROVIDER - Full Implementation
// ------------------------------------------------------------------
export const callXAI = async (modelId: string, messages: any[], systemInstruction: string): Promise<GenerateContentResponse> => {
    const apiKey = getXAIKey();
    if (!apiKey) throw new Error("xAI API Key missing.");
    
    // Logic to select Vision model if images are present
    const hasImages = messages.some((m: any) => m.parts.some((p: any) => p.inlineData || p.fileData));
    const targetModel = hasImages ? 'grok-2-vision-1212' : modelId;

    console.log(`%c[xAI] Target: ${targetModel}`, 'color: cyan; font-weight: bold;');

    // [ZEN FIX] Grok has strict context limits (32k for vision). 
    // We truncate purely for the API call to avoid 400 Bad Request.
    let workingMessages = messages;
    if (messages.length > 12) {
        workingMessages = messages.slice(-12);
        console.warn("[xAI] Truncated history for Grok Context Limit");
    }

    const formattedMessages = [
        { role: 'system', content: systemInstruction },
        ...workingMessages.map((m: any) => {
            const role = m.role === 'model' ? 'assistant' : 'user';
            
            const contentParts = m.parts.map((part: any) => {
                if (part.text) return { type: "text", text: part.text };
                
                // Handle Base64
                if (part.inlineData) {
                    // Grok hates video mime types in image slots
                    if (part.inlineData.mimeType.startsWith('video/')) {
                        console.warn("[xAI] Video MIME detected. Skipping.");
                        return null; 
                    }
                    return {
                        type: "image_url",
                        image_url: {
                            url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                            detail: "high" 
                        }
                    };
                }
                
                // Handle Remote URL
                if (part.fileData && part.fileData.fileUri) {
                     return {
                        type: "image_url",
                        image_url: { url: part.fileData.fileUri, detail: "high" }
                    };
                }
                return null;
            }).filter(Boolean);

            if (contentParts.length === 1 && contentParts[0].type === 'text') {
                return { role, content: contentParts[0].text };
            }
            if (contentParts.length === 0) return { role, content: "[Media Skipped]" };
            
            return { role, content: contentParts };
        })
    ];

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s Timeout for Vision

        const response = await fetch(`${debugConfig.xai.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: targetModel,
                messages: formattedMessages,
                stream: false, 
                temperature: 0.7
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`xAI Error: ${errText}`);
        }

        const data = await response.json();
        const text = data.choices[0]?.message?.content || "";
        return { text, candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] } as GenerateContentResponse;
    } catch (e: any) {
        if (e.name === 'AbortError') throw new Error("xAI Timed Out");
        console.error("[xAI] Request Failed:", e);
        throw e;
    }
};

// [ZEN NEW] Stateless Vision Helper
// Used by Fireworks Provider to offload Vision tasks to Grok without sending full history
const callGrokVisionStateless = async (imagePart: any, userPrompt: string): Promise<string> => {
    const apiKey = getXAIKey();
    if (!apiKey) throw new Error("xAI API Key missing.");

    // Construct a minimal payload: System + Image + 1 Prompt
    const payload = {
        model: 'grok-2-vision-1212',
        messages: [
            { 
                role: 'user', 
                content: [
                    { type: "text", text: userPrompt || "Describe this image in detail." },
                    { 
                        type: "image_url", 
                        image_url: { 
                            url: imagePart.inlineData 
                                ? `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
                                : imagePart.fileData.fileUri 
                        } 
                    }
                ] 
            }
        ],
        stream: false,
        temperature: 0.5,
        max_tokens: 1000 
    };

    console.log("[Vision] Requesting STATELESS description from Grok...");

    try {
        const response = await fetch(`${debugConfig.xai.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Grok Refused: ${response.statusText}`);
        const data = await response.json();
        return data.choices[0]?.message?.content || "Image analysis failed.";
    } catch (e) {
        console.error("[Vision] Grok Failed:", e);
        return "I couldn't see the image clearly.";
    }
};

// ------------------------------------------------------------------
// 3. FIREWORKS AI PROVIDER (Primary)
// ------------------------------------------------------------------
const SOFT_REFUSALS = [
    "Oh my... I can't look at that right now, I'm at work! 😳",
    "I'm going to pretend I didn't see that. Let's talk about something else?",
    "My visual sensors are acting up... I can't process this image right now.",
    "Wow. Okay, I can't analyze this image due to safety protocols, but we can chat about it?",
    "That's a bit too intense for my current settings! 🫣"
];

export const callFireworks = async (
    modelId: string, 
    messages: any[], 
    systemInstruction: string, 
    fireworksKey?: string,
    aiParams?: AiParams
): Promise<GenerateContentResponse> => {
    
    const apiKey = fireworksKey; 
    if (!apiKey) throw new Error("Fireworks API Key missing.");

    // 1. VISION INTERCEPTOR CHECK
    const lastMsg = messages[messages.length - 1];
    // Check for Inline Data OR File Data (Firebase URL)
    const imagePart = lastMsg?.parts?.find((p: any) => p.inlineData || p.fileData);

    if (imagePart) {
        console.log(`%c[Vision Interceptor] Image detected. Initiating Stateless Protocol.`, 'color: magenta; font-weight: bold;');
        
        // A. Offload Vision to Grok (Stateless)
        // We do this to avoid context bloat and 404s on experimental models
        const userText = lastMsg.parts.find((p: any) => p.text)?.text || "";
        
        try {
            const description = await callGrokVisionStateless(imagePart, "Describe this image vividly, focusing on mood, details, and any text visible.");
            console.log(`[Vision] Grok Analysis: ${description.substring(0, 50)}...`);

            // B. Inject Description into History as Text
            // We create a "Virtual" message that replaces the image with its text description
            const virtualLastMsg = {
                role: 'user',
                parts: [{ 
                    text: `[SYSTEM: User uploaded an image. VISUAL ANALYSIS: "${description}"]\n\nUser's Message: ${userText}` 
                }]
            };

            const textHistory = [...messages.slice(0, -1), virtualLastMsg];
            
            // C. Call Text Model (e.g. Llama 3.3) with the description
            return executeFireworksTextRequest(modelId, textHistory, systemInstruction, apiKey, aiParams);

        } catch (visionError: any) {
            console.warn("[Vision] Grok Stateless failed. Fallback to Soft Refusal.", visionError);
            const refusal = SOFT_REFUSALS[Math.floor(Math.random() * SOFT_REFUSALS.length)];
            return {
                text: refusal,
                candidates: [{ finishReason: 'STOP', content: { parts: [{ text: refusal }] } }]
            } as GenerateContentResponse;
        }
    }

    // 2. STANDARD TEXT REQUEST
    return executeFireworksTextRequest(modelId, messages, systemInstruction, apiKey, aiParams);
};

const executeFireworksTextRequest = async (
    targetModel: string, 
    messages: any[], 
    systemInstruction: string, 
    apiKey: string, 
    aiParams?: AiParams
) => {
    
    // Use Truncator
    const safeMessages = truncateHistory(messages, 20);

    const formattedMessages = [
        { role: 'system', content: systemInstruction },
        ...safeMessages.map((m: any) => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: m.parts.map((p: any) => p.text).join('\n') 
        }))
    ];

    const requestBody = {
        model: targetModel,
        messages: formattedMessages,
        stream: false,
        max_tokens: 4096,
        temperature: aiParams?.temperature ?? 0.7,
        top_p: aiParams?.topP ?? 1,
        frequency_penalty: aiParams?.frequencyPenalty ?? 0,
        presence_penalty: aiParams?.presencePenalty ?? 0,
        top_k: aiParams?.topK ?? 40 
    };

    console.log(`%c[Fireworks] POST to ${targetModel} (${formattedMessages.length} msgs)`, 'color: green; font-weight: bold;');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); 

    try {
        const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Fireworks] Error ${response.status}:`, errText);
            throw new Error(`Fireworks Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const text = data.choices[0]?.message?.content || "";
        return { text, candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] } as GenerateContentResponse;
    } catch (e: any) {
        if (e.name === 'AbortError') throw new Error("Fireworks Timed Out (45s)");
        throw e;
    }
};

// ------------------------------------------------------------------
// 4. GEMINI PROVIDER (Fallback)
// ------------------------------------------------------------------
export const callGemini = async (modelName: string, config: any): Promise<GenerateContentResponse> => {
    const finalKey = getGeminiKey();
    if (!finalKey) throw new Error("Gemini API Key missing.");
    
    const ai = new GoogleGenAI({ apiKey: finalKey });
    return await ai.models.generateContent({
        model: modelName,
        ...config
    });
};

// ------------------------------------------------------------------
// 5. HIPPOCAMPUS EMBEDDING PROVIDER
// ------------------------------------------------------------------
export const getEmbedding = async (text: string): Promise<number[] | null> => {
    if (!text || text.length < 2) return null;

    // 1. Check Cache
    const cacheKey = `emb_${text.substring(0, 30)}_${text.length}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
    }

    // 2. Get Key (Try SecretsManager first, then direct cache)
    const apiKey = SecretsManager.get('fireworks') || localStorage.getItem('fireworks_key_cache');
    
    if (!apiKey) {
        console.warn("[Embedding] No Fireworks Key found. Skipping vector generation.");
        return null;
    }

    // 3. Call Fireworks Nomic Model
    try {
        const response = await fetch("https://api.fireworks.ai/inference/v1/embeddings", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "nomic-ai/nomic-embed-text-v1.5",
                input: text,
                dimensions: 768
            })
        });

        if (!response.ok) throw new Error(`API Error ${response.status}`);
        
        const data = await response.json();
        const vector = data.data?.[0]?.embedding;
        
        if (vector) {
            try { localStorage.setItem(cacheKey, JSON.stringify(vector)); } catch(e) {}
            return vector;
        }
        return null;

    } catch (e) {
        console.error("[Embedding] Failed:", e);
        return null;
    }
};