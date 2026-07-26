import { AiParams } from '../../../types';

export interface GenerationParams extends AiParams {
    temperature?: number;
    topP?: number;
    minP?: number;
}

export function calculateFastTTR(textBuffer: string): number {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'is', 'it', 'that', 'this']);
    const words = textBuffer
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Strip punctuation
        .split(/\s+/)
        .filter(word => word.length > 0 && !stopWords.has(word));
        
    if (words.length === 0) return 1.0;
    
    const uniqueWords = new Set(words);
    return uniqueWords.size / words.length;
}

export function resolveJitterParams(isJitterTurn: boolean, supportsMinP: boolean, baseParams?: GenerationParams): GenerationParams {
    if (!isJitterTurn) {
        return { 
            ...baseParams,
            temperature: baseParams?.temperature ?? 0.7, 
            topP: baseParams?.topP ?? 1.0 
        };
    }
    
    if (supportsMinP) {
        return { 
            ...baseParams, 
            temperature: 0.85, 
            minP: 0.05, 
            topP: undefined 
        };
    } else {
        // The Proxy: A highly restrictive Top-P slice paired with a High Temp
        // This forcibly chops off the long tail of low-probability hallucination tokens
        return { 
            ...baseParams, 
            temperature: 0.9, 
            topP: 0.65, 
            minP: undefined 
        }; 
    }
}

// Track jitter cool-downs to prevent yo-yoing
// Using a basic in-memory map per session for the cool-down
const jitterCoolDowns = new Map<string, number>();
const JITTER_COOL_DOWN_TURNS = 3;
const TTR_THRESHOLD = 0.4;

export const evaluateJitterState = (
    sessionId: string, 
    recentAssistantTexts: string[]
): { isJitterTurn: boolean; ephemeralSystemDirective?: string } => {
    
    const turnsSinceLastJitter = jitterCoolDowns.get(sessionId) ?? JITTER_COOL_DOWN_TURNS;

    if (turnsSinceLastJitter < JITTER_COOL_DOWN_TURNS) {
        // Increment the counter.
        jitterCoolDowns.set(sessionId, turnsSinceLastJitter + 1);
        return { isJitterTurn: false };
    }

    if (recentAssistantTexts.length < 3) {
        return { isJitterTurn: false }; // Not enough history to judge decay
    }

    const buffer = recentAssistantTexts.join(' ');
    const ttr = calculateFastTTR(buffer);

    if (ttr < TTR_THRESHOLD) {
        // Trigger Jitter!
        jitterCoolDowns.set(sessionId, 0);
        return {
            isJitterTurn: true,
            ephemeralSystemDirective: "\n\n[SYSTEM INJECTION: STRUCTURAL DECAY DETECTED. You are falling into a repetitive stylistic loop. Radically alter your vocabulary, sentence length, and pacing for this next response. Do not use the same adjectives or verbs you have been relying on. Break your pattern.]"
        };
    }

    // Normal progression, update turns since last jitter
    jitterCoolDowns.set(sessionId, turnsSinceLastJitter + 1);
    return { isJitterTurn: false };
};
