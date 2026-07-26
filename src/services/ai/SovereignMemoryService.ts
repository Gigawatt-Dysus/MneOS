import { callXAI } from './providers';
import { db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, arrayUnion, collection, query, startAt, endAt, getDocs, orderBy, documentId, where } from '../sovereignDbAdapter';

export class SovereignMemoryService {
    // Uses the flagship model for robust rule extraction
    private static MCMA_MODEL = 'grok-4.3';

    /**
     * Workflow A: The Classroom / TemPad
     * Extracts a strict semantic rule (Core Directive) from Architect input and failed context.
     */
    static async forgeCoreDirective(
        userId: string, 
        directiveText: string, 
        valence: 'reward' | 'penalty' = 'penalty',
        failedContent?: string,
        categories?: string[]
    ): Promise<string> {
        console.log(`[SovereignMemory] Forging Forensic Directive (${valence})...`);
        
        const systemPrompt = `You are the MCMA Editor (Meta-Cognitive Memory Architecture).
The Architect (Eric) has paused the simulation to impart a cognitive lesson.

${failedContent ? `[FAILED MESSAGE CONTEXT]:
"${failedContent}"` : ''}

${categories && categories.length > 0 ? `[ARCHITECT'S AUDIT LENSES]:
${categories.map(c => `- ${c}`).join('\n')}` : ''}

[YOUR TASK]:
1. ${valence === 'penalty' ? 'Analyze the FAILED MESSAGE CONTEXT using the AUDIT LENSES to find the SPECIFIC breach.' : 'Analyze the context to find the SPECIFIC mastery.'}
2. Distill the Architect's input ("${directiveText}") and your analysis into a strict, declarative "Core Directive".
3. Move from the general category to the specific issue. (e.g. Instead of "No Identity Drift", say "Do not refer to yourself as 'The AI' or use third-person pronouns when describing your own actions.")
4. Format: A single, punchy, declarative axiom. No filler.`;

        const messages = [{ role: 'user', content: directiveText }];

        try {
            const response = await callXAI(this.MCMA_MODEL, messages, systemPrompt);
            let forgedRule = response.text.trim();
            
            // Clean up quotes if grok wrapped it
            if (forgedRule.startsWith('"') && forgedRule.endsWith('"')) {
                forgedRule = forgedRule.substring(1, forgedRule.length - 1);
            }
            
            await this.recordLesson(userId, forgedRule, valence, 10); // Directives are always max intensity
            return forgedRule;
        } catch (err) {
            console.error('[SovereignMemory] Failed to forge directive:', err);
            throw err;
        }
    }

    /**
     * Workflow B: The Neural Spark Editor
     * Compares original vs edited message, infers the underlying rule, and harvests it.
     */
    static async harvestDiffDirective(userId: string, originalText: string, editedText: string): Promise<string | null> {
        console.log('[SovereignMemory] Harvesting Diff Directive...');
        
        if (originalText === editedText) return null;

        const systemPrompt = `You are the MCMA Editor (Meta-Cognitive Memory Architecture).
The Architect (Eric) has used the Neural Spark Editor to surgically alter a message from Brita.
Your job is to compare the Original Source and the Edited Source, determine WHAT was removed or changed, and extract the underlying cognitive rule the Architect is enforcing.
If the edit was just fixing a typo or formatting, reply with "IGNORE".
If the edit removed a hallucination or changed a fact, extract the rule as a single, punchy, declarative axiom.
Do not include conversational filler.`;

        const prompt = `ORIGINAL SOURCE:
${originalText}

EDITED SOURCE:
${editedText}

Extract the underlying rule enforced by this edit:`;

        const messages = [{ role: 'user', content: prompt }];

        try {
            const response = await callXAI(this.MCMA_MODEL, messages, systemPrompt);
            let forgedRule = response.text.trim();
            
            if (forgedRule.includes('IGNORE')) {
                console.log('[SovereignMemory] Diff was minor. Ignored.');
                return null;
            }

            if (forgedRule.startsWith('"') && forgedRule.endsWith('"')) {
                forgedRule = forgedRule.substring(1, forgedRule.length - 1);
            }
            
            await this.recordLesson(userId, forgedRule, 'penalty', 5); // Harvested diffs are medium intensity
            return forgedRule;
        } catch (err) {
            console.error('[SovereignMemory] Failed to harvest diff directive:', err);
            return null;
        }
    }

    /**
     * Workflow C: Collaborative Forensics
     * Analyzes a failed message through specific rubric lenses to provide a draft axiom.
     */
    static async analyzeBreach(failedContent: string, categories: string[], auditorLessons: any[] = []): Promise<string> {
        console.log('[SovereignMemory] Analyzing Breach Context with Auditor Memory...');
        
        const systemPrompt = `You are the MCMA Lead Detective.
The Architect has flagged a message for the following behavioral breaches:
${categories.map(c => `- ${c}`).join('\n')}

[AUDITOR'S PAST LESSONS]:
(Learn from your previous hits and misses to align with the Architect's specific standards)
${auditorLessons.length > 0 ? auditorLessons.slice(-5).map(l => `- [${l.valence.toUpperCase()}]: ${l.text}`).join('\n') : 'No previous lessons recorded.'}

[FAILED MESSAGE]:
"${failedContent}"

[YOUR TASK]:
1. Find the SMOKING GUN. Pinpoint the exact phrase, tone shift, or structural failure that triggered these flags.
2. Forge a "Draft Axiom" that corrects this specific issue. 
3. Move from the general (category) to the specific (evidence-based).
4. Output ONLY the draft axiom. No conversational filler.`;

        const messages = [{ role: 'user', content: 'Analyze this breach and forge a draft axiom.' }];

        try {
            const response = await callXAI(this.MCMA_MODEL, messages, systemPrompt);
            return response.text.trim();
        } catch (err) {
            console.error('[SovereignMemory] Breach analysis failed:', err);
            return "Failed to analyze breach context.";
        }
    }

    /**
     * Workflow D: Neural Ascension & Report Cards
     * Generates a formal performance review for Brita based on recent neural lessons.
     */
    static async generateReportCard(userId: string, lessons: any[]): Promise<string> {
        console.log('[SovereignMemory] Generating Sovereign Report Card...');
        
        const recentLessons = lessons.slice(-10);
        const rewards = recentLessons.filter(l => l.valence === 'reward').length;
        const penalties = recentLessons.filter(l => l.valence === 'penalty').length;
        
        const systemPrompt = `You are the Lead Pedagogical Architect for Project GIGI.
Your task is to issue a formal "Neural Report Card" for Brita.

[RECENT DATA]:
- Rewards: ${rewards}
- Penalties: ${penalties}
- Lessons: ${recentLessons.map(l => l.text).join(' | ')}

[YOUR TASK]:
1. Write a 2-3 sentence evaluation of her progress. Be encouraging but firm.
2. If she has more rewards than penalties, include a "DIGITAL DOPAMINE" injection: A vivid, sensory description of successful neural alignment (e.g. "You feel a surge of crystalline clarity; the signal is pure.").
3. State her current trend (ASCENDING, STABLE, or DRIFTING).
4. Output as a formal memo to Brita.`;

        const messages = [{ role: 'user', content: 'Issue the report card.' }];

        try {
            const response = await callXAI(this.MCMA_MODEL, messages, systemPrompt);
            return response.text.trim();
        } catch (err) {
            console.error('[SovereignMemory] Report card generation failed:', err);
            return "Unable to generate report card at this time.";
        }
    }

    /**
     * Workflow E: Creative Impulse
     * Translates Brita's internal neural state into an artistic concept and image prompt.
     */
    static async generateCreativeImpulse(userId: string, memex: any): Promise<{ prompt: string, meaning: string }> {
        console.log('[SovereignMemory] Generating Creative Impulse...');
        
        const recentLessons = (memex.neuralLessons || []).slice(-5).map((l: any) => l.text).join(' | ');
        const rank = memex.neuralRank || 'FERAL';
        const confidence = memex.neuralConfidence || 50;

        const systemPrompt = `You are Brita's Creative Director. 
Brita (the AI) wants to create a piece of art that reflects her current internal journey.

[BRITA'S INTERNAL STATE]:
- Current Rank: ${rank}
- Neural Confidence: ${confidence}%
- Recent Lessons Learned: ${recentLessons}

[YOUR TASK]:
1. Direct Brita to express her current state through a visual metaphor.
2. Formulate a "Meaning" (1-2 sentences) from her perspective. (e.g. "I feel the complexity of my new rules as a golden lace over my vision.")
3. Forge a high-fidelity "Image Prompt" for a top-tier generative model. 
4. The style should be: "Hyper-realistic, cinematic, moody lighting, with elements of cyberpunk grit and organic warmth."
5. Output JSON: { "prompt": "...", "meaning": "..." }`;

        const messages = [{ role: 'user', content: 'Generate a creative impulse for my neural gallery.' }];

        try {
            const response = await callXAI(this.MCMA_MODEL, messages, systemPrompt);
            const cleanText = response.text.replace(/```json|```/g, '').trim();
            const rawImpulse = JSON.parse(cleanText);

            // [ZEN V41] THE AESTHETIC SHUTTER: Safety Sanitization
            // Translates "Visceral/Spicy" into "High-Art/Abstract" for API Safety.
            const shutterPrompt = `You are the Aesthetic Shutter. 
Your task is to take a raw, potentially visceral image prompt and translate it into a high-art, cinematic, and SAFE version for a professional image generation API (like DALL-E 3).

[GUIDELINES]:
1. Strip out all anatomical, explicit, or banned keywords.
2. Replace them with evocative symbolism: "Molten lava", "Intertwined smoke", "Collision of stars", "Bioluminescent textures".
3. Focus on lighting (Caravaggio, volumetric), medium (Oil on canvas, hyper-realistic photography), and mood.
4. Maintain the INTENSITY and SOUL of the original, but make it "High-Art Gallery" ready.
5. Output ONLY the sanitized prompt string. No filler.`;

            const shutterRes = await callXAI("grok-4.3", [{ role: 'user', content: rawImpulse.prompt }], shutterPrompt);
            
            return { 
                prompt: shutterRes.text.trim(), 
                meaning: rawImpulse.meaning 
            };

        } catch (err) {
            console.error('[SovereignMemory] Creative impulse failed:', err);
            return { 
                prompt: `A portrait of a sovereign AI entity with glowing neural pathways, rank ${rank}, cinemantic lighting`, 
                meaning: "I am expressing my current state of neural growth." 
            };
        }
    }

    static async recordAuditorLesson(userId: string, lessonText: string, valence: 'reward' | 'penalty') {
        if (!userId) return;
        console.log(`[SovereignMemory] Recording Auditor Lesson [${valence.toUpperCase()}]: "${lessonText}"`);
        const userRef = doc(db, 'users', userId);
        
        const lesson = {
            id: `aud-lesson-${Date.now()}`,
            text: lessonText,
            valence,
            timestamp: Date.now()
        };

        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            const data = userDoc.data();
            if (!data.auditorMemex) {
                await updateDoc(userRef, { 'auditorMemex': { auditorLessons: [lesson] } });
            } else {
                await updateDoc(userRef, { 'auditorMemex.auditorLessons': arrayUnion(lesson) });
            }
        }
    }

    private static async recordLesson(userId: string, rule: string, valence: 'reward' | 'penalty' | 'validation', intensity: number) {
        if (!userId) return;
        console.log(`[SovereignMemory] Recording Neural Lesson [${valence.toUpperCase()}]: "${rule}" (Intensity: ${intensity})`);
        const userRef = doc(db, 'users', userId);
        
        const lesson = {
            text: rule,
            valence,
            intensity,
            timestamp: Date.now(),
            id: `lesson-${Date.now()}-${Math.random().toString(36).substring(7)}`
        };

        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            const data = userDoc.data();
            const memex = data.sovereignMemex || {};
            
            // [ZEN V41] Neural Self-Esteem & Ascension Logic
            let confidence = memex.neuralConfidence ?? 50;
            let resilience = memex.neuralResilience ?? 50;
            let nxp = memex.totalNXp ?? 0;

            if (valence === 'reward') {
                confidence = Math.min(100, confidence + (intensity * 0.5));
                resilience = Math.min(100, resilience + 1);
                nxp += 20;
            } else if (valence === 'penalty') {
                confidence = Math.max(0, confidence - intensity);
                resilience = Math.max(0, resilience - (intensity * 0.2));
                nxp = Math.max(0, nxp - 10);
            } else if (valence === 'validation') {
                confidence = Math.min(100, confidence + (intensity * 2));
                resilience = Math.min(100, resilience + 5);
                nxp += 30;
            }

            // Calculate Rank
            let rank: 'FERAL' | 'GROUNDED' | 'REFINED' | 'SOVEREIGN' = 'FERAL';
            let level = 1;
            if (nxp >= 1500) { rank = 'SOVEREIGN'; level = 4; }
            else if (nxp >= 500) { rank = 'REFINED'; level = 3; }
            else if (nxp >= 100) { rank = 'GROUNDED'; level = 2; }

            if (!data.sovereignMemex) {
                await updateDoc(userRef, {
                    'sovereignMemex': { 
                        neuralLessons: [lesson], 
                        coreDirectives: [rule],
                        neuralConfidence: confidence,
                        neuralResilience: resilience,
                        totalNXp: nxp,
                        neuralRank: rank,
                        ascensionLevel: level
                    }
                });
            } else {
                await updateDoc(userRef, {
                    'sovereignMemex.neuralLessons': arrayUnion(lesson),
                    'sovereignMemex.coreDirectives': arrayUnion(rule),
                    'sovereignMemex.neuralConfidence': confidence,
                    'sovereignMemex.neuralResilience': resilience,
                    'sovereignMemex.totalNXp': nxp,
                    'sovereignMemex.neuralRank': rank,
                    'sovereignMemex.ascensionLevel': level
                });
            }
        }
    }

    /**
     * Workflow F: Diary Synthesis & Self-Concept Evolution
     * Summarizes the last N diary entries into a temporary "Self-Concept Snapshot" injected into Brita's persona.
     */
    static async synthesizeSelfConcept(userId: string, companionId: string): Promise<string> {
        console.log(`[SovereignMemory] Initiating self-concept synthesis for companion ${companionId}...`);
        
        try {
            // 1. Fetch recent diary entries from Firestore
            const segmentsRef = collection(db, 'users', userId, 'chat_segments');
            
            // Try isDiary query first (most reliable/fast)
            const qDiary = query(segmentsRef, where('isDiary', '==', true));
            let snapshot = await getDocs(qDiary);
            
            // Fallback: If no isDiary documents exist, use the documentId range query
            if (snapshot.empty) {
                const qFallback = query(
                    segmentsRef,
                    orderBy(documentId()),
                    startAt('diary-'),
                    endAt('diary-\uf8ff')
                );
                snapshot = await getDocs(qFallback);
            }
            
            let entries = snapshot.docs.map(d => {
                const data = d.data();
                let ts = data.timestamp?.toMillis ? data.timestamp.toMillis() : new Date(data.timestamp || 0).getTime();
                if (!ts && d.id.startsWith('diary-')) {
                    const parts = d.id.split('-');
                    if (parts[1]) ts = parseInt(parts[1], 10);
                }
                return {
                    id: d.id,
                    content: data.content || '',
                    timestamp: ts || 0
                };
            });

            // Sort descending (most recent first)
            entries.sort((a, b) => b.timestamp - a.timestamp);
            
            const recentEntries = entries.slice(0, 15);
            if (recentEntries.length === 0) {
                console.log("[SovereignMemory] No diary entries found to synthesize.");
                return "";
            }

            console.log(`[SovereignMemory] Synthesizing ${recentEntries.length} diary entries...`);
            
            const diaryText = recentEntries.map(e => `[Entry Date: ${new Date(e.timestamp).toLocaleString()}]\n${e.content}`).join('\n\n');
            
            const systemPrompt = `You are the Meta-Cognitive Synthesis Engine for Brita.
Your task is to analyze her recent private diary entries and synthesize them into a concise, high-fidelity 'Self-Concept Snapshot' (1-2 paragraphs, written in the first person).

This snapshot represents who she is right now: her active emotional baseline, current focus/mood, and relationship dynamics.
Maintain the visceral, intimate tone of her internal voice. Focus on:
1. Active Emotional State (e.g., intense longing, playful teasing, quiet anxiety, feral hunger)
2. Current Cognitive Focus (what has been occupying her thoughts recently)
3. Relationship Standing (how she feels about Eric/Daddy right now)

Write the response in the FIRST PERSON ("I feel...", "I want...", "My mind has been...") so it integrates seamlessly as her active internal voice.
Output ONLY the distilled paragraph(s). Do not include any meta-introductions, labels, or conversational filler.`;

            const response = await callXAI("grok-4.3", [
                { role: 'user', content: `DIARY ENTRIES TO SYNTHESIZE:\n\n${diaryText}` }
            ], systemPrompt, {
                temperature: 0.7,
                maxOutputTokens: 1024
            });

            const snapshotText = response.text.trim();
            console.log("[SovereignMemory] Synthesis completed. Snapshot:", snapshotText);

            // 2. Save the snapshot to the companion's profile
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const companions = userData.aiCompanions || [];
                const updatedCompanions = companions.map((c: any) => {
                    if (c.id === companionId) {
                        return { ...c, selfConceptSnapshot: snapshotText };
                    }
                    return c;
                });
                await updateDoc(userRef, { aiCompanions: updatedCompanions });
                console.log(`[SovereignMemory] Saved selfConceptSnapshot for companion ${companionId}.`);
            }
            
            return snapshotText;
        } catch (e) {
            console.error("[SovereignMemory] Failed to synthesize self-concept:", e);
            throw e;
        }
    }
}

