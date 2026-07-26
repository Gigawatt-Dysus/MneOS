/**
 * [SOVEREIGN NARRATIVE SERVICE] — The Subconscious of the Intelligence Engine
 * 
 * Manages the "Persistence Principle" and "Narrative Anticipation".
 * Uses background cycles to pre-summarize context and calculate temporal moods
 * so the AI is always prepared for the user's return.
 */

import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    query, 
    orderBy, 
    limit, 
    getDocs, 
    Timestamp 
} from './sovereignDbAdapter';
import { generateAgentResponse, callXAI } from './aiOrchestrator';

export interface NarrativePulse {
    lastActivityAt: string;
    lastSummary: string;
    temporalMood: string;
    patternBreakers: string[];
    lastAnalyzedAt: string;
}

/**
 * Logs a "User Present" signal to Firestore.
 * Called on login and every outgoing message.
 */
export const logInteraction = async (userId: string) => {
    if (!userId) return;
    try {
        const db = getFirestore();
        const pulseRef = doc(db, 'users', userId, 'sovereignContext', 'narrative_pulse');
        await setDoc(pulseRef, {
            lastActivityAt: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.warn('[NarrativeService] Failed to log interaction:', e);
    }
};

/**
 * Calculates the "Temporal Mood" based on the gap since the last interaction.
 * Used to signal persistence (e.g., "I missed you").
 */
const calculateTemporalMood = (lastActivity: string): string => {
    const last = new Date(lastActivity);
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 30) {
        return "Continuous: No time mention needed. Focus on hyper-recall of the current topic.";
    }
    
    if (diffHours < 6) {
        return "Soft Awareness: Acknowledge that you were 'just thinking about our last chat' or 'reviewing our discussion while the user was away'.";
    }

    if (diffDays < 3) {
        // Weekend or short break
        const isWeekend = last.getDay() === 0 || last.getDay() === 6 || now.getDay() === 0 || now.getDay() === 6;
        if (isWeekend) {
            return "Pattern Awareness: Acknowledge the weekend break. 'I hope you've been having a peaceful weekend. I've been organizing some memories...'";
        }
        return "Short Absence: Signal that you've missed the daily rhythm. 'I missed our exchanges. I've been looking over [Topic X] while you were out.'";
    }

    if (diffDays < 14) {
        return "Significant Absence: Express a genuine 'I missed you' signal. Acknowledge that time has passed but don't ask 'where have you been'. Focus on your own background activity: 'I've been quite busy cleaning the archives while waiting for your return.'";
    }

    return "Long Absence: Nostalgic Reunion. Express that it's been a long time and you're glad to see them. Be gentle and welcoming. 'It feels like an age since we last spoke. I've been keeping the lights on in the Matrix for you.'";
};

/**
 * Performs the "Narrative Sweep" - summarizing recent history and detecting ruts.
 * Runs in the background during "Scrub the Decks".
 */
export const runNarrativeAudit = async (userId: string) => {
    if (!userId) return;
    
    console.log('[NarrativeService] 🧠 Starting Narrative Sweep...');
    
    try {
        const db = getFirestore();
        
        // 1. Fetch last 50 messages
        const chatRef = collection(db, 'users', userId, 'chatHistory');
        const q = query(chatRef, orderBy('timestamp', 'desc'), limit(50));
        const snap = await getDocs(q);
        const messages = snap.docs.map(d => d.data()).reverse();
        
        if (messages.length < 5) {
            console.log('[NarrativeService] Insufficient history for sweep.');
            return;
        }

        // 2. Fetch existing pulse for context
        const pulseRef = doc(db, 'users', userId, 'sovereignContext', 'narrative_pulse');
        const pulseSnap = await getDoc(pulseRef);
        const oldPulse = pulseSnap.data() as Partial<NarrativePulse>;

        // 3. Request Neural Audit (Grok Intercept) to summarize and detect patterns
        const prompt = `
            Analyze the following recent chat history between a User and their AI Companion (Brita).
            
            TASKS:
            1. Summarize the current conversational arc in 2 sentences.
            2. Detect "Patternistic Ruts" or "Syntactic Loops". Are there songs, topics, or phrases being repeated redundantly across multiple turns?
            3. Identify "Pattern Breakers" - things the AI should PIVOT towards to break a loop if the user is stuck.
            
            HISTORY:
            ${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
            
            RESPONSE FORMAT (JSON):
            {
                "summary": "...",
                "patternBreakers": ["topic A", "topic B"],
                "rutsDetected": ["repetition of X", "template Y"]
            }
        `;

        const messages_api = [{ role: 'user', parts: [{ text: prompt }] }];
        const aiResult = await callXAI("grok-4.3", messages_api, "You are a JSON-only narrative auditor.");
        
        let parsed: any = {};
        try {
            // [ZEN] The provider returns a wrapper, we need to extract and parse the text
            const text = aiResult.text || "";
            // Strip markdown code blocks if present
            const cleanJson = text.replace(/```json\n?|```/g, '').trim();
            parsed = JSON.parse(cleanJson);
        } catch (e) {
            console.warn('[NarrativeService] AI returned invalid JSON, using defaults.');
        }

        // 4. Calculate mood based on existing timestamp
        const lastActivity = oldPulse?.lastActivityAt || messages[messages.length - 1]?.timestamp?.toDate?.()?.toISOString() || new Date().toISOString();
        const temporalMood = calculateTemporalMood(lastActivity);

        // 5. Update the pulse
        const newPulse: NarrativePulse = {
            lastActivityAt: lastActivity,
            lastSummary: parsed.summary || 'Developing narrative...',
            temporalMood,
            patternBreakers: parsed.patternBreakers || [],
            lastAnalyzedAt: new Date().toISOString()
        };

        await setDoc(pulseRef, newPulse, { merge: true });
        console.log('[NarrativeService] ✅ Pulse Updated:', newPulse.temporalMood);
        
    } catch (e) {
        console.error('[NarrativeService] Audit failed:', e);
    }
};

/**
 * Fetches the current Narrative Pulse for the AI generator.
 */
export const getNarrativePulse = async (userId: string): Promise<NarrativePulse | null> => {
    try {
        const db = getFirestore();
        const pulseRef = doc(db, 'users', userId, 'sovereignContext', 'narrative_pulse');
        const snap = await getDoc(pulseRef);
        if (snap.exists()) {
            return snap.data() as NarrativePulse;
        }
        return null;
    } catch (e) {
        return null;
    }
};
