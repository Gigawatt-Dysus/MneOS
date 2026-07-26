/**
 * [SOVEREIGN STYLE SERVICE] — Syntactic Mirror of the User
 *
 * This service learns and protects the user's unique syntactic and prose patterns.
 * e.g., using "..." for train-of-thought, or specific casing like "TARDIS".
 *
 * It prevents the Health Auditor from "correcting" these intended patterns.
 */

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    arrayUnion
} from './sovereignDbAdapter';

export interface StylePreference {
    id: string;
    pattern: string;
    type: 'prose_style' | 'acronym' | 'custom_term';
    examples: string[];
    isApproved: boolean;
    detectedAt: string;
}

export interface StyleProfile {
    userId: string;
    acronyms: string[];
    proseStyles: string[];
    ignoredCorrections: string[];
}

// [ZEN OPTIMIZATION] Session Cache to prevent redundant Firestore hits
const sessionSeenPatterns = new Set<string>();

/**
 * Analyzes a text string for potential user style patterns.
 * If a pattern is repeated across different contexts, it's flagged for "Style Learning."
 */
export const analyzeProseStyle = async (userId: string, text: string): Promise<void> => {
    if (!text || text.length < 10) return;

    // 1. Detect Ellipses (...) for Train of Thought
    if (text.includes('...')) {
        await recordPattern(userId, '...', 'prose_style');
    }

    // 2. Detect Custom Acronyms (AllCaps, 3+ chars)
    const acronyms = text.match(/\b[A-Z]{3,}\b/g);
    if (acronyms) {
        for (const acro of acronyms) {
            // [ZEN] Skip common short noise or previously seen in this session
            if (acro.length < 3) continue;
            await recordPattern(userId, acro, 'acronym');
        }
    }
};

/**
 * Records a pattern as a candidate for the Style Profile.
 */
const recordPattern = async (userId: string, pattern: string, type: StylePreference['type']) => {
    const patternId = `style-${type}-${pattern.replace(/[^a-z0-9]/gi, '_')}`;
    
    // [ZEN] Don't hammer Firestore for patterns we've already processed this session
    if (sessionSeenPatterns.has(patternId)) return;
    sessionSeenPatterns.add(patternId);

    const db = getFirestore();
    const patternRef = doc(db, 'users', userId, 'styleProfile', 'candidates', 'list', patternId);

    try {
        const snap = await getDoc(patternRef);
        if (snap.exists()) {
            // Increment frequency or update last detected
            await updateDoc(patternRef, {
                frequency: (snap.data().frequency || 1) + 1,
                lastDetected: new Date().toISOString()
            });
        } else {
            await setDoc(patternRef, {
                pattern,
                type,
                frequency: 1,
                detectedAt: new Date().toISOString(),
                isApproved: false
            });
        }
    } catch (e) {
        // Silently fail to keep UI smooth
    }
};

/**
 * [PRIMARY EXPORT] Checks if a string or correction should be suppressed
 * based on the user's approved Style Profile.
 */
export const isProtectedStyle = async (userId: string, text: string): Promise<boolean> => {
    const db = getFirestore();
    const profileRef = doc(db, 'users', userId, 'styleProfile', 'active');
    const snap = await getDoc(profileRef);

    if (!snap.exists()) return false;
    const profile = snap.data() as StyleProfile;

    // Check Acronyms
    if (profile.acronyms?.some(a => text.includes(a))) return true;

    // Check Prose Styles (e.g. ellipses)
    if (profile.proseStyles?.some(p => text.includes(p))) return true;

    return false;
};

/**
 * Approves a candidate pattern into the active Style Profile.
 */
export const approveStylePreference = async (userId: string, patternId: string): Promise<void> => {
    const db = getFirestore();
    const candidateRef = doc(db, 'users', userId, 'styleProfile', 'candidates', 'list', patternId);
    const snap = await getDoc(candidateRef);

    if (!snap.exists()) return;
    const data = snap.data() as StylePreference;

    // 1. Move to active profile
    const profileRef = doc(db, 'users', userId, 'styleProfile', 'active');
    const field = data.type === 'acronym' ? 'acronyms' : 'proseStyles';
    
    await setDoc(profileRef, {
        [field]: arrayUnion(data.pattern)
    }, { merge: true });

    // 2. Mark as approved in candidate list
    await updateDoc(candidateRef, { isApproved: true });
};
