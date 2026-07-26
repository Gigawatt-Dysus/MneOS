// spatial.ts
// [PROJECT GIGI] - AI Spatial Intelligence & Ghost Geography
import { callXAI } from './providers';
import type { User } from '../../types';

/**
 * [AI SPATIAL GUIDE]
 * Analyzes a failing geocoding query and suggests likely valid alternatives.
 * Handles directional errors (N/S/E/W), common typos, and transformed names.
 */
export const correctSpatialAnomaly = async (
    query: string, 
    user: User,
    context?: string
): Promise<string[]> => {
    const prompt = `
    [PROTOCOL: SPATIAL ANOMALY CORRECTION]
    You are GIGI, the user's Neural Historian. The user entered a location query that failed to return any geocoding results.
    
    USER QUERY: "${query}"
    KNOWN CONTEXT: ${context || "None"}
    
    TASK:
    Identify likely valid alternatives for this address. Consider:
    1. Directional variations (e.g., swapping "East" for "South" or "West").
    2. Common misspellings of street or town names.
    3. Structural transformations (e.g., "122 Main St" vs "122 Main Ave").
    
    RETURN: A strict JSON array of 3 suggested address strings. EXCLUSIVELY RAW VALID JSON.
    `;

    try {
        const response = await callXAI("grok-4.3", [{ role: 'user', parts: [{ text: `QUERY: ${query}` }] }], prompt, {
            temperature: 0.1,
            maxOutputTokens: 1024
        });
        
        const text = response.text || "[]";
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error("[SpatialAssist] Correction failed:", e);
        return [];
    }
};

/**
 * [TEMPORAL HISTORIAN]
 * Generates a companion-style inquiry when a user's memory contradicts modern map data.
 */
export const generateTemporalInquiry = async (
    userQuery: string, 
    mapResult: string,
    user: User
): Promise<string> => {
    const companion = user.aiCompanions.find(c => c.isPrimary) || user.aiCompanions[0];
    
    const prompt = `
    [PROTOCOL: TEMPORAL SPATIAL INQUIRY]
    You are ${companion.name}, the user's AI Companion.
    The user is trying to archive a place they call "${userQuery}".
    Modern maps identify this same location as "${mapResult}".
    
    TASK:
    Ask a gentle, curious question about this discrepancy. Frame it as a "Ghost Geography" moment—perhaps the landmark was torn down, renamed, or relocated.
    Keep it concise (1-2 sentences).
    `;

    try {
        const response = await callXAI("grok-4.3", [{ role: 'user', parts: [{ text: `User says: ${userQuery}. Map says: ${mapResult}.` }] }], prompt, {
            temperature: 0.7,
            maxOutputTokens: 1024
        });
        return response.text || `The maps show ${mapResult} here, but you remember ${userQuery}. Has this place changed over time?`;
    } catch (e) {
        return `The maps show ${mapResult} here, but you remember ${userQuery}. Has this place changed over time?`;
    }
};
