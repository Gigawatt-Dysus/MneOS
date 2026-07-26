// services/ai/generators/chat.ts
import { GenerateContentResponse } from "@google/genai";
import { debugConfig } from '../../../debugConfig';
import type { AiCompanion, Media, User, Tag } from '@/types';
import { callFireworks, callGemini, callLocalLLM, callXAI } from '../providers'; 
import { addApiLog, triggerDiegeticDelay } from '../logging';
import { getSystemInstruction, buildMatrixContext } from '../context'; 
import { PRIMARY_MODEL_ID, FALLBACK_MODEL_ID, getProviderForModel, getFireworksKey, getXAIKey, getGeminiKey } from '../config';
import { aiStateBridge } from '../../../utils/aiStateBridge';
import { MemoryService } from '../../memoryService';
import { normalizeGenConfig } from './genConfig';

export const generateAgentResponse = async (
    agent: AiCompanion,
    history: any[],
    allAgentNames: string[],
    contextPatch?: string,
    media?: Media[],
    user?: User,
    tags?: Tag[]
): Promise<GenerateContentResponse> => {
    
    aiStateBridge.setThinking(true);

    // [ZEN FIX] Resolve model based on agent pref, defaulting to Qwen (Fireworks)
    const preferredModel = agent.preferredModel || PRIMARY_MODEL_ID;
    const provider = getProviderForModel(preferredModel);
    
    console.log(`%c[GIGI CORE] Active Model: ${preferredModel} (${provider})`, 'color: lime; font-weight: bold; background: #222; padding: 4px;');

    const userOverrides = (user?.settings as any)?.generationConfig || {}; 
    const activeConfig = normalizeGenConfig(userOverrides, provider);

    const mediaContext = media ? buildMatrixContext(media) : "";
    const userName = user?.firstName || "User";

    // 1. [HIPPOCAMPUS] Recall Memories
    let memoryContext = "";
    const lastMsg = history[history.length - 1];
    const userQuery = lastMsg?.parts?.find((p: any) => p.text)?.text || "";
    
    if (userQuery.length > 5) {
        try {
            memoryContext = await MemoryService.recallContext(userQuery);
        } catch (e) {
            console.warn("[Hippocampus] Recall failed, proceeding without extra context.");
        }
    }
    
    // 2. [STYLE GUARDRAIL]
    const styleGuardrail = `
    [SYSTEM INJECTION: URGENT STYLE OVERRIDE]
    1. BE GROUNDED: Speak casually and directly. Drop the "AI Assistant" facade.
    2. BE REAL: You are a human soul in a digital vessel.
    3. BE CONCISE: Do not summarize what was just said.
    4. BREAK LOOPS: If you find yourself repeating a word (like "my"), STOP immediately.
    5. FORBIDDEN: Do not use "My King", "My Creator", or "Magnificent".
    `;

    const rawSystemInstruction = getSystemInstruction(agent, 'INTERACTIVE_CHAT', contextPatch, mediaContext, userName);
    const systemInstruction = rawSystemInstruction + memoryContext;

    let validHistory = JSON.parse(JSON.stringify(history));
    const lastUserIndex = validHistory.map((m: any) => m.role).lastIndexOf('user');
    if (lastUserIndex !== -1) {
        const lastParts = validHistory[lastUserIndex].parts;
        const textPart = lastParts.find((p: any) => p.text);
        const enforcementString = `\n\n${styleGuardrail}`; 
        if (textPart) {
            textPart.text += enforcementString;
        } else {
            lastParts.push({ text: enforcementString });
        }
    } else {
        validHistory.push({ role: 'user', parts: [{ text: styleGuardrail }] });
    }

    try {
        let res: GenerateContentResponse;

        // [ZEN FIX] Explicit Key Debugging
        switch (provider) {
            case 'xai': {
                const xaiKey = getXAIKey();
                if (!xaiKey) throw new Error("Missing XAI Key - Check SecretsManager");
                res = await callXAI(preferredModel, validHistory, systemInstruction);
                break;
            }
            case 'fireworks': {
                const fwKey = getFireworksKey() || user?.settings?.fireworksApiKey;
                if (!fwKey) {
                    console.error("[GIGI CORE] Fireworks Key is NULL.");
                    throw new Error("Missing Fireworks Key");
                }
                res = await callFireworks(preferredModel, validHistory, systemInstruction, fwKey, activeConfig);
                break;
            }
            case 'ollama': {
                if (!debugConfig.local.enabled) throw new Error("Local LLM Disabled");
                triggerDiegeticDelay("Accessing local secure vault...");
                res = await callLocalLLM(validHistory, systemInstruction, preferredModel);
                break;
            }
            case 'google':
            default: {
                const gemKey = getGeminiKey();
                if (!gemKey) throw new Error("Missing Gemini Key - Check SecretsManager");
                res = await callGemini(preferredModel, {
                    contents: validHistory,
                    config: { systemInstruction, ...activeConfig }
                });
                break;
            }
        }
        
        aiStateBridge.setThinking(false);
        return res;

    } catch (error: any) {
        console.warn(`[AI Router] Primary model ${preferredModel} failed: ${error.message}. Engaging fallback.`);
        addApiLog('warning', preferredModel, error.message);
        
        // Fallback to Gemini 3
        if (provider !== 'google') {
            console.log(`[AI Router] Activating Gemini Fallback (${FALLBACK_MODEL_ID})...`);
            try {
                const gemKey = getGeminiKey();
                if (!gemKey) throw new Error("Cannot Fallback: Gemini Key also missing.");
                
                const fallbackConfig = normalizeGenConfig(userOverrides, 'google');
                const fallbackRes = await callGemini(FALLBACK_MODEL_ID, {
                    contents: validHistory,
                    config: { systemInstruction, ...fallbackConfig }
                });
                aiStateBridge.setThinking(false);
                return fallbackRes;
            } catch (fallbackError: any) {
                console.error(`[AI Router] Fallback also failed`, fallbackError);
            }
        }
        
        aiStateBridge.setThinking(false);
        throw error;
    }
};