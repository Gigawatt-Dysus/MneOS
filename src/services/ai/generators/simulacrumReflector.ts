import { callXAI } from '../providers';
import { FAST_MODEL_ID } from '../config';
import { PersonTag } from '../../../types';
import { db } from '../../sovereignCore';
import { collection, doc, updateDoc, getDoc } from '../../sovereignDbAdapter';
import { SimulacrumMessage, SimulacrumSessionMeta } from './simulacrumGenerator';

export const evaluateSessionDrift = async (
    userId: string,
    sessionId: string,
    hostTag: PersonTag,
    history: SimulacrumMessage[],
    force: boolean = false,
    isCageMatch: boolean = false
): Promise<void> => {
    try {
        const modelMessages = history.filter(h => h.role === 'model' && h.tagId === hostTag.id);
        
        // Fire every 4 model messages (approx 4 turns)
        if (!force && (modelMessages.length === 0 || modelMessages.length % 4 !== 0)) {
            return;
        }

        // Fetch current session meta to ensure it exists
        const collectionName = isCageMatch ? 'cage_match_session_meta' : 'simulacrum_session_meta';
        const metaRef = doc(collection(db, collectionName), sessionId);
        const metaSnap = await getDoc(metaRef);
        
        if (!metaSnap.exists()) return;

        const systemInstruction = `[PROTOCOL: SIMULACRUM REFLECTOR]
You are a background cognitive process monitoring the ongoing simulation of [${hostTag.name}].
Your job is to analyze the recent conversation history and output a concise "Session State Evolution" summary.

Focus on:
1. Emotional Trajectory: How is their mood shifting? Are they getting annoyed, warmer, defensive, or relaxed?
2. Concessions & Realizations: Have they conceded any points or learned something new in this session that should influence their immediate next responses?
3. Persona Drift: Have they naturally shifted their cadence or focus based on the user's interaction?

[FIDELITY ANCHOR GUARDRAILS]: 
Do NOT record false facts as true memories. If they were roleplaying or hypothetically discussing something, do not log it as a factual core memory. State evolution is strictly about EMOTIONAL and BEHAVIORAL trajectory.

Output ONLY the raw summary text. Keep it under 3 sentences. This text will be injected into their cognitive prompt for the rest of the session. Do not include any XML tags or conversational filler.`;

        // Grab last 12 messages for context
        const apiHistory = history.slice(-12).map(h => ({
            role: h.role,
            parts: [{ text: `[${h.tagId === hostTag.id ? hostTag.name : (h.tagId ? 'Other' : 'User')}]: ${h.content}` }]
        }));

        apiHistory.push({
            role: 'user',
            parts: [{ text: '[SYSTEM]: Analyze the trajectory and output the updated session state.' }]
        });

        // Use FAST_MODEL_ID for quick async evaluation
        const response = await callXAI(FAST_MODEL_ID, apiHistory as any, systemInstruction, {
            temperature: 0.3,
            maxOutputTokens: 150,
            sessionId: `reflector_${sessionId}_${hostTag.id}`
        });

        const newState = response.text?.trim();

        if (newState) {
            await updateDoc(metaRef, {
                sessionState: newState
            });
            console.log(`[Reflector] Session state updated for ${hostTag.name}: ${newState}`);
            
            // Dispatch event for UI
            window.dispatchEvent(new CustomEvent('gigi-simulacrum-reflection', { 
                detail: { sessionId, tagId: hostTag.id, sessionState: newState } 
            }));
        }

    } catch (e) {
        console.error("Reflector evaluation failed:", e);
    }
};
