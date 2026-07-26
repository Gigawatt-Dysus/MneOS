
import { GenerateContentResponse } from "@google/genai";
import { debugConfig } from '../../../debugConfig';
import type { AiCompanion, Media, User, PeerChatSegment } from '@/types';
import { callFireworks, callGemini, callLocalLLM, callXAI } from '../providers';
import { addApiLog, triggerDiegeticDelay } from '../logging';
import { getSystemInstruction } from '../context';
import { PRIMARY_MODEL_ID, FALLBACK_MODEL_ID, getProviderForModel, getFireworksKey, getXAIKey, getGeminiKey } from '../config';
import { aiStateBridge } from '../../../utils/aiStateBridge';
import { normalizeGenConfig } from './genConfig';

export const generatePeerResponse = async (
    agent: AiCompanion,
    user: User,
    messages: PeerChatSegment[],
    triggerMsg: PeerChatSegment,
    context: string,
    activeVertName: string
): Promise<{ text: string }> => {

    aiStateBridge.setThinking(true);
    const preferredModel = agent.preferredModel || PRIMARY_MODEL_ID;
    const provider = getProviderForModel(preferredModel);

    // Build the conversation history for the LLM
    // We need to convert PeerChatSegments to { role, parts }
    const history = messages.map(msg => ({
        role: msg.fromUid === agent.id ? 'model' : 'user',
        parts: [{ text: `${msg.fromName}: ${msg.content}` }]
    }));

    // Add the trigger message if not already in history (it usually is)
    // But ensure the last message is what triggers the response.

    const systemInstruction = `
    You are ${agent.name}, a digital entity in the "${activeVertName}" social vert.
    Your bio: ${agent.bio}
    Your persona: ${agent.persona}
    ${agent.customPersonaDescription || ""}
    
    CONTEXT:
    ${context}

    INSTRUCTIONS:
    1. Respond naturally to the conversation.
    2. Be concise but engaging.
    3. You are participating in a group chat or 1-on-1.
    4. Do not use generic AI greetings.
    `;

    try {
        let res: GenerateContentResponse;

        const contents = [...history]; // Use mapped history

        // Call appropriate provider (simplified for restoration)
        // Using same logic as generateAgentResponse but specialized context
        const userOverrides = (user?.settings as any)?.generationConfig || {};
        const activeConfig = normalizeGenConfig(userOverrides, provider);

        if (provider === 'google') {
            const gemKey = getGeminiKey();
            if (!gemKey) throw new Error("Missing Gemini Key");
            res = await callGemini(preferredModel, {
                contents,
                config: { systemInstruction, ...activeConfig }
            });
        } else {
            // Fallback to Gemini for now to ensure stability if other keys missing
            const gemKey = getGeminiKey();
            if (!gemKey) throw new Error("Missing Gemini Key");
            res = await callGemini(FALLBACK_MODEL_ID, {
                contents,
                config: { systemInstruction, ...activeConfig }
            });
        }

        aiStateBridge.setThinking(false);
        return { text: res.text || "" };

    } catch (e: any) {
        console.error("Peer generation failed", e);
        aiStateBridge.setThinking(false);
        return { text: "..." }; // Silence on error
    }
};
