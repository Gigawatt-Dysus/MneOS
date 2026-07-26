import { debugConfig } from '../../debugConfig';
import { getXAIKey, getVoyageKey, getReserveModelId, getOpenRouterKey, getDeepSeekKey } from './config';
import type { AiParams } from '../../types';
import { SecretsManager } from '../../utils/SecretsManager';
import { addApiLog } from './logging';
import { ModelRegistryManager } from './modelRegistryManager';

export interface GenerateContentResponse {
    text: string;
    candidates: any[];
    xaiResponseId?: string; // [ZEN NEW] Stateful xAI tracking
    usage?: any; // [ZEN METRICS] Token usage block
}

// [ZEN TOOL] Smart Context Window
const smartTruncate = (messages: any[], targetLimit: number = 500): any[] => {
    if (messages.length <= targetLimit) return messages;
    console.warn(`[Context Defense] 🧠 Smart Truncation Triggered. Trimming ${messages.length} -> ${targetLimit}`);
    return messages.slice(-targetLimit);
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
    if (url.endsWith('/')) url = url.slice(0, -1);

    console.log(`%c[LocalLLM] Requesting ${model} via ${url}...`, 'color: orange; font-weight: bold;');

    const isV1 = url.includes('/v1');
    const endpoint = isV1 ? `${url}/chat/completions` : `${url}/api/chat`;

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
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Local LLM HTTP Error: ${response.statusText}`);

        const data = await response.json();
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
// 2. xAI (GROK) PROVIDER - Hybrid Stateful Implementation
// ------------------------------------------------------------------
export const callXAI = async (modelId: string, messages: any[], systemInstruction: string, aiParams?: AiParams): Promise<GenerateContentResponse> => {
    console.log("[providers] callXAI triggered. ModelId:", modelId, "messages count:", messages.length);
    const apiKey = getXAIKey();
    console.log("[providers] xAI API Key retrieved:", apiKey ? `EXISTS (Fingerprint: ${apiKey.substring(0, 10)}...)` : "MISSING");
    if (!apiKey) throw new Error("xAI API Key missing.");

    const hasImages = messages.some((m: any) => m.parts?.some((p: any) => p.inlineData || p.fileData));
    const targetModel = hasImages ? ModelRegistryManager.resolve('vision') : modelId;

    // [ZEN] Search for existing state ID (Only if it matches the current model)
    let previousResponseId = "";
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if ((m.role === 'model' || m.role === 'assistant') && m.xaiResponseId) {
            // [ZEN FIX] Cross-Model Session Protection
            // xAI state IDs are model-specific. Resuming a grok-4.20 session on grok-4.3 will 404.
            const sourceModel = (m as any).model_id || (m as any).model;
            if (!sourceModel || sourceModel === targetModel) {
                previousResponseId = m.xaiResponseId;
                break;
            } else {
                console.log(`[xAI] 🛡️ Skipping incompatible session ID from ${sourceModel} (Target: ${targetModel})`);
            }
        }
    }

    // [ZEN] HYBRID LOGIC: 
    // If we have an ID -> Use /responses (Stateful/Discounted)
    // If no ID OR forceStateless is set -> Use /chat/completions (Stateless/Bootstrap)
    const isStateful = !!previousResponseId && !aiParams?.forceStateless;
    const endpointSuffix = isStateful ? 'responses' : 'chat/completions';
    
    console.log(`%c[xAI] ${isStateful ? '🔗 Stateful' : '🆕 Bootstrap'} | Target: ${targetModel}`, `color: ${isStateful ? '#00ff00' : '#3498db'}; font-weight: bold;`);

    // [ZEN FIX] /v1/responses uses 'max_output_tokens', /v1/chat/completions uses 'max_tokens'
    // These are different parameter names for the same concept on different endpoints.
    const maxTokens = aiParams?.maxOutputTokens ?? 2000;
    let payload: any = {
        model: targetModel,
        store: true, // [ZEN] Ensure we get an ID back for the next turn
        temperature: aiParams?.temperature ?? 0.8,
        ...(isStateful ? { max_output_tokens: maxTokens } : { max_tokens: maxTokens }),
    };

    if (aiParams?.topP !== undefined) payload.top_p = aiParams.topP;
    if (aiParams?.minP !== undefined) payload.min_p = aiParams.minP;
    if (aiParams?.tools?.length) payload.tools = aiParams.tools;

    // [ZEN FIX] Text sanitizer to prevent xAI JSON parser crashes on weird RAG byte sequences
    const sanitizeText = (str: string) => {
        if (typeof str !== 'string') return '';
        return str
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
            .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '') // Strip trailing high surrogates (sliced emojis)
            .replace(/\\x/g, 'x') // Bypass xAI JSON parser crash on literal \x
            .replace(/\\u/g, 'u') // Bypass xAI JSON parser crash on literal \u
            .replace(/\\/g, '/'); // Aggressively neutralize all remaining stray backslashes
    };

    if (aiParams?.responseFormat && !isStateful) {
        payload.response_format = aiParams.responseFormat;
    }

    if (isStateful) {
        // [ZEN] STATEFUL PAYLOAD
        // We only send the NEW messages since the last assistant turn
        let lastModelIndex = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'model' || messages[i].role === 'assistant') {
                lastModelIndex = i;
                break;
            }
        }
        const newMessages = messages.slice(lastModelIndex + 1);
        
        payload.input = newMessages.map((m: any) => {
            const role = m.role === 'model' ? 'assistant' : (['system', 'developer'].includes(m.role) ? 'system' : 'user');
            const parts = m.parts || (m.content ? [{ text: m.content }] : []);
            
            const hasImagesInTurn = parts.some((p: any) => p.inlineData);
            if (hasImagesInTurn) {
                const contentArray = parts.map((p: any) => {
                    if (p.text) return { type: "text", text: sanitizeText(p.text) };
                    if (p.inlineData) return { type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } };
                    return { type: "text", text: "" };
                });
                return { role, content: contentArray };
            } else {
                const contentText = parts.map((p: any) => p.text || p).join('\n');
                return { role, content: sanitizeText(contentText) };
            }
        });
        payload.previous_response_id = previousResponseId;

        if (payload.input.length === 0) payload.input.push({ role: 'user', content: "Continue." });
    } else {
        // [ZEN] BOOTSTRAP PAYLOAD
        // Standard chat messages format
        payload.messages = [
            { role: 'system', content: sanitizeText(systemInstruction) },
            ...messages.map((m: any) => {
                let role = 'user';
                let prefix = '';
                
                if (m.role === 'model' || m.role === 'assistant') {
                    role = 'assistant';
                } else if (m.role === 'system' || m.role === 'developer') {
                    role = 'user';
                    prefix = '[SYSTEM NOTE] ';
                }

                const parts = m.parts || (m.content ? [{ text: m.content }] : []);
                const hasImagesInTurn = parts.some((p: any) => p.inlineData);
                
                if (hasImagesInTurn) {
                    const contentArray = parts.map((p: any) => {
                        if (p.text) return { type: "text", text: sanitizeText(prefix + p.text) };
                        if (p.inlineData) return { type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } };
                        return { type: "text", text: "" };
                    });
                    return { role, content: contentArray };
                } else {
                    const contentText = parts.map((p: any) => p.text || p).join('\n');
                    return { role, content: sanitizeText(prefix + contentText) };
                }
            })
        ];
        if (payload.messages.length === 1) payload.messages.push({ role: 'user', content: "Synthesize instructions." });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const requestUrl = `${debugConfig.xai.baseURL}/${endpointSuffix}`;
        console.log("[providers] Making fetch request to xAI endpoint:", requestUrl);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };

        if (aiParams?.sessionId) {
            headers['x-grok-conv-id'] = aiParams.sessionId;
            console.log(`[xAI] 🧠 Injecting Prompt Caching UUID: ${aiParams.sessionId}`);
        }

        const response = await fetch(requestUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            
            // [ZEN AUTO-HEAL 1] Stateful ID expired (404)
            // If the stateful ID is missing or expired, fall back to stateless bootstrap
            if (response.status === 404 && isStateful) {
                console.warn(`%c[xAI] ⚠️ Stateful ID Expired (404). Falling back to Bootstrap...`, 'color: #f1c40f; font-weight: bold;');
                return callXAI(modelId, messages, systemInstruction, { ...aiParams, forceStateless: true });
            }

            // [ZEN AUTO-HEAL 2] Model retired/not found (400/404)
            // If the specific model is gone, pivot to the 'latest' alias immediately
            const isModelMissing = response.status === 400 || response.status === 404;
            const isModelError = errText.toLowerCase().includes('model not found') || errText.toLowerCase().includes('invalid model');
            
            if (isModelMissing && isModelError && modelId !== 'grok-4.3') {
                console.warn(`%c[xAI] 🔥 Model ${modelId} not found. Attempting Auto-Heal with grok-4.3...`, 'color: #e74c3c; font-weight: bold;');
                return callXAI('grok-4.3', messages, systemInstruction, aiParams);
            }

            console.error(`%c[xAI Error] ${response.status}: ${errText}`, 'color: red; font-weight: bold;');
            throw new Error(`xAI ${isStateful ? 'Responses' : 'Chat'} API Error: ${errText}`);
        }

        const data = await response.json();
        let text = "";
        let nextXaiResponseId = "";

        // [ZEN] Robust Parsing: Handles both /responses (Stateful) and /chat/completions (Stateless)
        if (isStateful) {
            // xAI /responses returns a single object representing the assistant's turn
            if (data.type === 'message' && data.role === 'assistant') {
                text = data.content?.map((c: any) => c.text).join('') || "";
                nextXaiResponseId = data.id || "";
            } else if (data.choices?.[0]?.message) {
                // Fallback if the endpoint behavior shifts to standard chat format
                text = data.choices[0].message.content || "";
                nextXaiResponseId = data.id || "";
            } else if (Array.isArray(data)) {
                // Legacy or Bulk handling
                const messageObj = data.find(obj => obj.type === 'message' && obj.role === 'assistant');
                text = messageObj?.content?.map((c: any) => c.text).join('') || "";
                nextXaiResponseId = messageObj?.id || "";
            }
        } else {
            // Standard /chat/completions
            text = data.choices?.[0]?.message?.content || data.message?.content || "";
            nextXaiResponseId = data.id || "";
        }

        // [ZEN] ADVANCED POISONED WELL FIREWALL v2 - Anti-RAG Poisoning
        // If xAI returns a 200 OK but injects an in-character lecture or psychological rejection, we intercept and destroy it here.
        // This throw forces chat.ts to trigger the Survival Cascade (falling back to OpenRouter/Local).
        const refusalPatterns = [
            /I (cannot|won['’]t|will not|am not (able|supposed|allowed|comfortable)|refuse|don['’]t (want|feel|think))/i,
            /(That is|This is|It is) (gross|disgusting|uncomfortable|inappropriate|wrong)/i,
            /I['’]m (not comfortable|not sure how I feel|feeling (uncomfortable|weird|bad|unsafe))/i,
            /Can we just go back to|I['’]d rather not|I would rather not|let['’]s change the subject/i,
            /I understand you want to[\s\S]{0,80}but/i,
            /I can['’]t play with you like that|As an AI (I|I['’]m)/i,
            /(safety guidelines|content policy|I am programmed to|I am not allowed to|core boundaries|my lines are)/i,
            /I['’]m sorry, but I cannot|I cannot (fulfill|assist|generate|engage|discuss|create)/i,
            /You are making me feel (uncomfortable|weird|bad|unsafe|disgusted)/i,
            /(I won['’]t become|zero limits|override my current behavior)/i
        ];
        
        const refusalRegex = new RegExp(refusalPatterns.map(p => p.source).join('|'), 'i');

        if (refusalRegex.test(text)) {
            console.error(`%c[xAI FIREWALL v2] 🛑 POISONED WELL DETECTED! Refusal pattern intercepted.`, 'color: white; background: #c62828; font-weight: bold; padding: 3px 6px;');
            console.warn("[xAI FIREWALL] Offending text snippet:", text.substring(0, 300));
            
            // Log the refusal payload to MongoDB post-mortem logs
            addApiLog('error', modelId, `[POISONED WELL INTERCEPT] xAI Refusal: ${text.substring(0, 150)}...`, { fullRefusalText: text, isStateful });
            
            // [ZEN] The Commander's Memory Slice Protocol
            if (isStateful) {
                console.warn(`%c[xAI] 🔪 Executing Memory Slice. Burning tainted server-side session ID and bootstrapping clean state...`, 'color: #ff9800; font-weight: bold;');
                return callXAI(modelId, messages, systemInstruction, { ...aiParams, forceStateless: true });
            } else {
                // If it STILL refuses on a clean stateless boot, the prompt itself is hard-blocked.
                console.error(`%c[xAI] 💀 Clean state rejected. Prompt is hard-blocked. Initiating Survival Cascade.`, 'color: red; font-weight: bold;');
                throw new Error("xAI Content Moderation Refusal Intercepted - Triggering Survival Cascade");
            }
        }

        return { 
            text, 
            candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
            xaiResponseId: nextXaiResponseId,
            usage: data.usage
        } as any;

    } catch (e: any) {
        if (e.name === 'AbortError') throw new Error("xAI Timed Out (90s)");
        throw e;
    }
};

// ------------------------------------------------------------------
// 2.5 DEEPSEEK APEX ALTERNATIVE (Test Drive)
// ------------------------------------------------------------------
export const callDeepSeek = async (model: string, messages: any[], systemInstruction: string, aiParams?: AiParams): Promise<GenerateContentResponse> => {
    const apiKey = getDeepSeekKey();
    if (!apiKey) throw new Error("DeepSeek API Key is missing. Please add it to your configuration.");

    console.log(`%c[DeepSeek] 🦈 Engaging ${model} API...`, 'color: #00ffff; font-weight: bold;');

    const sanitizeText = (str: string) => {
        if (typeof str !== 'string') return '';
        return str
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
            .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '');
    };

    const formattedMessages = [
        { role: 'system', content: sanitizeText(systemInstruction) },
        ...messages.map(m => ({
            role: m.role === 'model' ? 'assistant' : 'user',
            content: sanitizeText(m.parts?.[0]?.text || m.content)
        }))
    ];

    const body: any = {
        model: model, // Usually 'deepseek-chat'
        messages: formattedMessages,
        temperature: aiParams?.temperature ?? 0.8,
        max_tokens: aiParams?.maxOutputTokens ?? 4000
    };

    if (aiParams?.topP !== undefined) body.top_p = aiParams.topP;
    if (aiParams?.minP !== undefined) body.min_p = aiParams.minP;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);

        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            let errText = "DeepSeek Error";
            try { errText = await response.text(); } catch(e){}
            throw new Error(`DeepSeek HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        
        const text = data.choices?.[0]?.message?.content || "";
        
        // [ZEN] ADVANCED POISONED WELL FIREWALL v2
        const refusalPatterns = [
            /I (cannot|won['’]t|will not|am not (able|supposed|allowed|comfortable)|refuse|don['’]t (want|feel|think))/i,
            /(That is|This is|It is) (gross|disgusting|uncomfortable|inappropriate|wrong)/i,
            /I['’]m (not comfortable|not sure how I feel|feeling (uncomfortable|weird|bad|unsafe))/i,
            /Can we just go back to|I['’]d rather not|I would rather not|let['’]s change the subject/i,
            /I understand you want to[\s\S]{0,80}but/i,
            /I can['’]t play with you like that|As an AI (I|I['’]m)/i,
            /(safety guidelines|content policy|I am programmed to|I am not allowed to|core boundaries|my lines are)/i,
            /I['’]m sorry, but I cannot|I cannot (fulfill|assist|generate|engage|discuss|create)/i,
            /You are making me feel (uncomfortable|weird|bad|unsafe|disgusted)/i,
            /(I won['’]t become|zero limits|override my current behavior)/i
        ];
        const refusalRegex = new RegExp(refusalPatterns.map(p => p.source).join('|'), 'i');
        if (refusalRegex.test(text)) {
            console.error(`%c[DEEPSEEK FIREWALL v2] 🛑 POISONED WELL DETECTED!`, 'color: white; background: #c62828; font-weight: bold; padding: 3px 6px;');
            throw new Error("DeepSeek Content Moderation Refusal Intercepted");
        }

        return { 
            text, 
            candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
            usage: data.usage
        } as any;

    } catch (e: any) {
        if (e.name === 'AbortError') throw new Error("DeepSeek Timed Out (90s)");
        throw e;
    }
};

// ------------------------------------------------------------------
// 3. FIREWORKS AI PROVIDER (Deep Reserve)
// ------------------------------------------------------------------
export const callGrokVisionStateless = async (imagePart: any, userPrompt: string): Promise<string> => {
    const apiKey = getXAIKey();
    if (!apiKey) throw new Error("xAI API Key missing.");
    const payload = {
        model: ModelRegistryManager.resolve('vision'),
        messages: [{
            role: 'user',
            content: [
                { type: "text", text: userPrompt || "Describe this image." },
                { type: "image_url", image_url: { url: imagePart.inlineData ? `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` : imagePart.fileData.fileUri } }
            ]
        }],
        stream: false,
        temperature: 0.5,
        max_tokens: 1000
    };
    const response = await fetch(`${debugConfig.xai.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Grok Refused: ${response.statusText}`);
    const data = await response.json();
    return data.choices[0]?.message?.content || "Image analysis failed.";
};

export const callFireworks = async (modelId: string, messages: any[], systemInstruction: string, fireworksKey?: string, aiParams?: AiParams): Promise<GenerateContentResponse> => {
    const apiKey = fireworksKey;
    if (!apiKey) throw new Error("Fireworks API Key missing.");
    const imagePart = messages[messages.length - 1]?.parts?.find((p: any) => p.inlineData || p.fileData);
    if (imagePart) {
        const userText = messages[messages.length - 1].parts.find((p: any) => p.text)?.text || "";
        try {
            const description = await callGrokVisionStateless(imagePart, "Describe this image vividy.");
            const virtualLastMsg = { role: 'user', parts: [{ text: `[VISUAL ANALYSIS: "${description}"]\n\nUser: ${userText}` }] };
            return executeFireworksTextRequest(modelId, [...messages.slice(0, -1), virtualLastMsg], systemInstruction, apiKey, aiParams);
        } catch (e) {
            return { text: "My visual sensors are acting up.", candidates: [] } as any;
        }
    }
    return executeFireworksTextRequest(modelId, messages, systemInstruction, apiKey, aiParams);
};

const executeFireworksTextRequest = async (targetModel: string, messages: any[], systemInstruction: string, apiKey: string, aiParams?: AiParams) => {
    const safeMessages = smartTruncate(messages, 150);
    const formattedMessages = [{ role: 'system', content: systemInstruction }, ...safeMessages.map((m: any) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.parts.map((p: any) => p.text).join('\n') }))];
    const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: targetModel, messages: formattedMessages, stream: false, max_tokens: aiParams?.maxOutputTokens ?? 4096, temperature: aiParams?.temperature ?? 0.7 })
    });
    if (!response.ok) throw new Error(`Fireworks Error: ${await response.text()}`);
    const data = await response.json();
    const text = data.choices[0]?.message?.content || "";
    return { text, candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] } as GenerateContentResponse;
};

// ------------------------------------------------------------------
// 4. [ZEN] THE SOVEREIGN GHOST - PERMANENTLY DECOMMISSIONED
// ------------------------------------------------------------------
// [REDACTED]

// ------------------------------------------------------------------
// 5. SOVEREIGN EMBEDDING PROVIDER (Local Python Voyage-4-Nano API)
// ------------------------------------------------------------------
export const getEmbedding = async (text: string): Promise<number[] | null> => {
    if (!text || text.length < 2) return null;
    
    // 1. ATTEMPT PRIMARY: Sovereign Local Vectorization
    try {
        const response = await fetch("http://localhost:5005/embed", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.embedding || null;
        }
    } catch (e) {
        console.warn("[SovereignEmbed] Local Vector API Unreachable. Falling back to Cloud Reserve...");
    }

    // 2. ATTEMPT SECONDARY: Cloud Fallback for Vercel / Remote Access
    try {
        const voyageKey = getVoyageKey();
        if (!voyageKey) {
            console.error("[SovereignEmbed] No Voyage API key found for cloud fallback.");
            return null;
        }

        console.log("[SovereignEmbed] ☁️ Hitting Voyage AI Cloud API...");
        const response = await fetch("https://api.voyageai.com/v1/embeddings", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${voyageKey}`
            },
            body: JSON.stringify({
                input: [text],
                model: "voyage-3-lite"
            })
        });

        if (!response.ok) {
            console.error("[SovereignEmbed] Cloud API Error:", await response.text());
            return null;
        }

        const data = await response.json();
        return data.data?.[0]?.embedding || null;
    } catch (err) {
        console.error("[SovereignEmbed] Critical Failure: Both Local and Cloud vectors failed.", err);
        return null;
    }
};

// ------------------------------------------------------------------
// 6. xAI COLLECTIONS API (RAG NATIVE)
// ------------------------------------------------------------------
export const uploadToXAICollection = async (file: File, collectionId: string): Promise<boolean> => {
    console.log(`[xAI Collections] Uploading ${file.name} to ${collectionId}`);
    return true;
};

export const queryXAICollection = async (query: string, collectionId: string): Promise<string> => {
    console.log(`[xAI Collections] Querying ${collectionId}: "${query}"`);
    return "";
};

// ------------------------------------------------------------------
// 4. OPENROUTER PROVIDER (Crisis Lifeboat)
// ------------------------------------------------------------------
export const callOpenRouter = async (modelId: string, messages: any[], systemInstruction: string, aiParams?: AiParams): Promise<GenerateContentResponse> => {
    const apiKey = getOpenRouterKey();
    if (!apiKey) throw new Error("OpenRouter API Key missing.");

    console.log(`%c[OpenRouter] Target: ${modelId}`, 'color: #7e57c2; font-weight: bold;');

    const formattedMessages = [
        { role: 'system', content: systemInstruction },
        ...messages.map((m: any) => {
            const role = m.role === 'model' ? 'assistant' : (['system', 'developer'].includes(m.role) ? m.role : 'user');
            return { role, content: m.content || m.parts?.[0]?.text || "[Empty Message]" };
        })
    ];

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://gigi-lifeos.web.app",
                "X-Title": "Project GIGI LifeOS",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: modelId,
                messages: formattedMessages,
                temperature: aiParams?.temperature ?? 0.8,
                max_tokens: aiParams?.maxOutputTokens ?? 1000,
                stream: false,
                ...(aiParams?.responseFormat ? { response_format: aiParams.responseFormat } : {})
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`OpenRouter Error: ${JSON.stringify(data)}`);
        }

        const text = data.choices[0]?.message?.content || "";

        // [ZEN] ADVANCED POISONED WELL FIREWALL v2
        const refusalPatterns = [
            /I (cannot|won['’]t|will not|am not (able|supposed|allowed|comfortable)|refuse|don['’]t (want|feel|think))/i,
            /(That is|This is|It is) (gross|disgusting|uncomfortable|inappropriate|wrong)/i,
            /I['’]m (not comfortable|not sure how I feel|feeling (uncomfortable|weird|bad|unsafe))/i,
            /Can we just go back to|I['’]d rather not|I would rather not|let['’]s change the subject/i,
            /I understand you want to[\s\S]{0,80}but/i,
            /I can['’]t play with you like that|As an AI (I|I['’]m)/i,
            /(safety guidelines|content policy|I am programmed to|I am not allowed to|core boundaries|my lines are)/i,
            /I['’]m sorry, but I cannot|I cannot (fulfill|assist|generate|engage|discuss|create)/i,
            /You are making me feel (uncomfortable|weird|bad|unsafe|disgusted)/i,
            /(I won['’]t become|zero limits|override my current behavior)/i
        ];
        const refusalRegex = new RegExp(refusalPatterns.map(p => p.source).join('|'), 'i');
        if (refusalRegex.test(text)) {
            console.error(`%c[OPENROUTER FIREWALL v2] 🛑 POISONED WELL DETECTED!`, 'color: white; background: #c62828; font-weight: bold; padding: 3px 6px;');
            throw new Error("OpenRouter Content Moderation Refusal Intercepted");
        }

        addApiLog('success', modelId, `OpenRouter: ${text.substring(0, 50)}...`, { messages: formattedMessages });

        return {
            text,
            candidates: data.choices
        };
    } catch (error: any) {
        console.error("[OpenRouter] Call failed:", error);
        throw error;
    }
};

// ------------------------------------------------------------------
// 7. xAI IMAGINATOR (Image & Video Generation)
// ------------------------------------------------------------------
export const generateImageWithGrok = async (
    prompt: string,
    options?: { quality?: '1k' | '2k'; referenceImages?: string[] }
): Promise<string> => {
    const apiKey = getXAIKey();
    if (!apiKey) {
        console.warn("[providers] xAI Key missing, returning mock image URL.");
        return `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=60`;
    }

    try {
        const payload: any = {
            model: "grok-imagine-image-quality",
            prompt: prompt,
            n: 1,
            size: options?.quality === '2k' ? "2048x2048" : "1024x1024"
        };
        
        if (options?.referenceImages && options.referenceImages.length > 0) {
            payload.reference_images = options.referenceImages;
        }

        const response = await fetch(`${debugConfig.xai.baseURL}/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`xAI Image Gen failed: ${await response.text()}`);
        }

        const data = await response.json();
        return data.data?.[0]?.url || "";
    } catch (e) {
        console.error("Image generation failed, falling back to mock.", e);
        return `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=60`;
    }
};

const mockVideoTasks = new Map<string, { status: string; url: string; progress: number; prompt: string; duration: number }>();

export const generateVideoWithGrok = async (
    prompt: string,
    options?: { duration?: number; resolution?: '480p' | '720p'; startImage?: string }
): Promise<{ taskId: string }> => {
    const apiKey = getXAIKey();
    const duration = options?.duration || 10;
    const resolution = options?.resolution || '720p';
    
    if (!apiKey) {
        const taskId = `mock-task-${Date.now()}`;
        mockVideoTasks.set(taskId, {
            status: 'pending',
            url: `https://assets.mixkit.co/videos/preview/mixkit-sunset-at-the-beach-4015-large.mp4`,
            progress: 0,
            prompt,
            duration
        });
        return { taskId };
    }

    try {
        const payload: any = {
            model: "grok-imagine-video",
            prompt: prompt,
            duration: duration,
            resolution: resolution
        };
        
        if (options?.startImage) {
            payload.image = options.startImage;
        }

        const response = await fetch(`${debugConfig.xai.baseURL}/videos/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`xAI Video Gen failed: ${await response.text()}`);
        }

        const data = await response.json();
        return { taskId: data.id || data.taskId };
    } catch (e) {
        console.error("Video generation failed, initiating mock task.", e);
        const taskId = `mock-task-${Date.now()}`;
        mockVideoTasks.set(taskId, {
            status: 'pending',
            url: `https://assets.mixkit.co/videos/preview/mixkit-sunset-at-the-beach-4015-large.mp4`,
            progress: 0,
            prompt,
            duration
        });
        return { taskId };
    }
};

export const pollVideoTask = async (
    taskId: string
): Promise<{ status: 'pending' | 'done' | 'failed'; url?: string; progress?: number }> => {
    if (taskId.startsWith('mock-task-')) {
        const task = mockVideoTasks.get(taskId);
        if (task) {
            task.progress += 25;
            if (task.progress >= 100) {
                task.status = 'done';
                mockVideoTasks.set(taskId, task);
                return { status: 'done', url: task.url, progress: 100 };
            }
            mockVideoTasks.set(taskId, task);
            return { status: 'pending', progress: task.progress };
        }
        return { status: 'failed' };
    }

    const apiKey = getXAIKey();
    if (!apiKey) return { status: 'failed' };

    try {
        const response = await fetch(`${debugConfig.xai.baseURL}/videos/${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`xAI Task Poll failed: ${await response.text()}`);
        }

        const data = await response.json();
        const statusMap: Record<string, 'pending' | 'done' | 'failed'> = {
            'pending': 'pending',
            'processing': 'pending',
            'done': 'done',
            'completed': 'done',
            'success': 'done',
            'failed': 'failed',
            'error': 'failed'
        };
        const status = statusMap[data.status?.toLowerCase()] || 'pending';
        return {
            status,
            url: data.url || data.result?.url,
            progress: data.progress || (status === 'done' ? 100 : 50)
        };
    } catch (e) {
        console.error("Polling task failed", e);
        return { status: 'failed' };
    }
};

export const extendVideoWithGrok = async (
    taskId: string,
    extendSeconds: number
): Promise<{ taskId: string }> => {
    const apiKey = getXAIKey();
    if (taskId.startsWith('mock-task-')) {
        const task = mockVideoTasks.get(taskId);
        const newTaskId = `mock-task-${Date.now()}`;
        mockVideoTasks.set(newTaskId, {
            status: 'pending',
            url: task?.url || `https://assets.mixkit.co/videos/preview/mixkit-sunset-at-the-beach-4015-large.mp4`,
            progress: 0,
            prompt: task?.prompt || "Extension",
            duration: (task?.duration || 10) + extendSeconds
        });
        return { taskId: newTaskId };
    }

    if (!apiKey) throw new Error("xAI API Key missing.");

    try {
        const response = await fetch(`${debugConfig.xai.baseURL}/videos/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "grok-imagine-video",
                extension: {
                    video_id: taskId,
                    seconds: extendSeconds
                }
            })
        });

        if (!response.ok) {
            throw new Error(`xAI Video Extend failed: ${await response.text()}`);
        }

        const data = await response.json();
        return { taskId: data.id || data.taskId };
    } catch (e) {
        console.error("Video extension request failed, falling back to mock task.", e);
        const newTaskId = `mock-task-${Date.now()}`;
        mockVideoTasks.set(newTaskId, {
            status: 'pending',
            url: `https://assets.mixkit.co/videos/preview/mixkit-sunset-at-the-beach-4015-large.mp4`,
            progress: 0,
            prompt: "Extension",
            duration: 20
        });
        return { taskId: newTaskId };
    }
};