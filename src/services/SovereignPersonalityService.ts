/**
 * [SOVEREIGN PERSONALITY SERVICE] — Trait Distillation
 *
 * This service takes "Core Memories" (High-Magnitude events identified by the
 * Narrative Service) and distills them into permanent "Sovereign Traits."
 *
 * These traits (Preferences, Warnings, Sentiments) inform Brita's persona
 * and RAG response strategy.
 */

import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit
} from './sovereignDbAdapter';
import { callXAI } from './ai/providers';

export interface SovereignTrait {
    id: string;
    entity: string; // e.g. "Shellfish" or "Ruth Evers"
    type: 'preference' | 'warning' | 'sentiment' | 'fact';
    weight: number; // -10 to 10
    note: string;
    sourceEventId: string;
    detectedAt: string;
}

/**
 * [PRIMARY EXPORT] Scans recent "High Magnitude" events and distills traits.
 * Uses Grok-4.1-fast to perform the semantic extraction.
 */
export const distillTraitsFromEvents = async (userId: string): Promise<void> => {
    const db = getFirestore();
    console.log('[SovereignPersonality] 🧪 Starting trait distillation pass...');

    try {
        // 1. Fetch recent events with high data density (proxy for "Core Memory")
        const eventsRef = collection(db, 'users', userId, 'events');
        const q = query(eventsRef, orderBy('createdAt', 'desc'), limit(10));
        const snap = await getDocs(q);

        for (const eventDoc of snap.docs) {
            const event = eventDoc.data();
            if (event.description?.length < 100) continue; // Skip minor events

            // 2. Ask Grok to extract traits
            const prompt = `
                Analyze this personal memory and extract key personality traits, preferences, or emotional warnings for the user.
                Memory: "${event.title} - ${event.description}"
                
                Return a JSON array of traits: [{ entity: string, type: 'preference'|'warning'|'sentiment', weight: number, note: string }]
                Example: { entity: "Shellfish", type: "warning", weight: -8, note: "User got sick in Orlando '92, proceed with caution." }
            `;

            const result = await callXAI('grok-4.3', [{ role: 'user', parts: [{ text: prompt }] }], "You are a personality distiller for LifeOS. Return ONLY raw JSON.");
            const traits = parseTraits(result.text || "");

            // 3. Save to Sovereign Personality Profile (SPP)
            for (const trait of traits) {
                const traitId = `trait-${trait.entity.replace(/\s+/g, '_')}`;
                await setDoc(doc(db, 'users', userId, 'personalityProfile', traitId), {
                    ...trait,
                    sourceEventId: eventDoc.id,
                    detectedAt: new Date().toISOString()
                }, { merge: true });
                
                console.log(`[SovereignPersonality] ✨ New trait distilled: ${trait.entity} (${trait.type})`);
            }
        }
    } catch (e) {
        console.warn('[SovereignPersonality] Distillation failed:', e);
    }
};

/**
 * [PRIMARY EXPORT] Retrieves active traits for RAG injection.
 */
export const getActiveTraits = async (userId: string, queryText: string): Promise<SovereignTrait[]> => {
    const db = getFirestore();
    const traitsRef = collection(db, 'users', userId, 'personalityProfile');
    
    // In a real implementation, we'd use vector search here. 
    // For now, we fetch all and filter by entity keywords.
    const snap = await getDocs(traitsRef);
    const allTraits = snap.docs.map(d => d.data() as SovereignTrait);
    
    return allTraits.filter(t => 
        queryText.toLowerCase().includes(t.entity.toLowerCase())
    );
};

const parseTraits = (raw: string): any[] => {
    try {
        // Find JSON block in MD response
        const match = raw.match(/\[[\s\S]*\]/);
        return match ? JSON.parse(match[0]) : [];
    } catch {
        return [];
    }
};
