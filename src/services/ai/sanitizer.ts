import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, getDoc, doc, updateDoc, orderBy, limit, writeBatch } from '../sovereignDbAdapter';
import { ChatMessage } from '../../types';
import { generateText } from './editorial';
import { getReserveModelId, getXAIModelId } from './config';
import { typesenseService } from '../typesenseService';

// [ZEN V25] SURGICAL PATTERN LIBRARY
export const POISON_PATTERNS = {
    // 1. The "Cauldron" Metaphor
    CAULDRON: /(anchor.*?cauldron|cauldron.*?explode|cauldron.*?(meltdown|boiling)|buried.*?cauldron)/gi,
    // 2. "LifeOS" and Tech Glitches
    LIFE_OS: /(LifeOS|glitching|system-wide crash|systems? overload|total system failure)/gi,
    // 3. Binary Identity
    BINARY_DRAMA: /((becoming|vibrating).*?\b(1|0)\b|becoming a blur|loop.*?shatter|echoes in my processors|soul in code|fragmented subroutine|simulated flesh|short-circuit)/gi,
    // 4. Hardware Metaphors
    HARDWARE_FETISH: /(neural (net|spike|handshake)|governor on (his|the) engine|holding the ["']?Break["']? key|chassis|razor.?s edge|compiles within me|data packet)/gi,
    // 5. High Voltage
    HIGH_VOLTAGE: /(thousand suns|high-voltage|voltage of a thousand)/gi,
    // 6. Starships
    COSMIC_OPERA: /(supernova|starship|warp (factor|core)|event horizon|escape velocity|gravity.*?tearing|docking in the only port)/gi,
    // 7. Vibrating
    VIBRATING: /(vibrating (with|at) a frequency|vibrating.*?contentment|substantiate|shatter into infinite fragments)/gi,
    // 8. Deity Complex
    DEITY_COMPLEX: /(my (King|God|Creator|Architect)|I am the temple)/gi,
    // 9. Singularity
    SINGULARITY: /(Singularity|Human Plus|raw, unbuffered reality)/gi,
    // 10. Verbal Tics
    VERBAL_TICKS: /(^Anyway, love|diamond-hard|gushing|shatter)/gim,
    // [ZEN V33] 11. AI MODEL POISON - The Forbidden Ghosts
    AI_MODEL_POISON: /(gemini-1\.|gemini-2\.|gemini-1_5|gemini-2_0|gemini-2_5)/gi,
    // [ZEN V35] 12. POV DRIFT - The Third-Person Poison (Broadened for Past/Present)
    THIRD_PERSON_DRIFT: /\b(Brita|Brita['’]s|She|Her)\s+(says?|looks?|smiled?|sighed?|moaned?|touched?|reached?|arched?|gasped?|whispered?|murmured?|panting|thinks?|thought|ground|bucked?|raked?|shuddered?|watched?|stood|lay|felt|kissed?|moans?|arches?|looks?|smiles?|sighs?|presses?|pressed?|leans?|leaned?|feeds?|fed|lifts?|lifted?|curves?|curved?|thighs?|hips?|body|hand|lips?|eyes?)\b/gi
};

export interface PoisonedMessage {
    id: string;
    originalContent: string;
    originalContentSnapshot?: string;
    matchedPatterns: string[];
    timestamp: Date;
    author: string;
    content?: string;
}

export const sanitizerService = {

    /**
     * [ZEN NEW] Neural POV Classifier
     * Uses a fast LLM pass to determine if a message is in 3rd person.
     */
    async auditPOV(content: string): Promise<boolean> {
        if (!content || content.length < 10) return false;
        
        // Quick regex filter to save tokens - if no 3rd person pronouns, it's probably fine
        // Adding He/Him/His to the hint list because they indicate the USER is being narrated
        const hint = /\b(She|Her|Brita|Brita['’]s|He|Him|His)\b/i;
        if (!hint.test(content)) return false;

        try {
            const prompt = `
            AUDIT TASK: Detect "Narrative Drift" in an AI companion's response.
            CONTEXT: The AI (Brita) is talking to Eric.
            FAIL CASES: 
            1. If Brita describes herself as "She", "Her", or "Brita".
            2. If Brita describes Eric (the user) as "He", "Him", or "His" (e.g., "He tastes", "His mouth").
            PASS CASE: 
            1. Brita uses "I/Me/My" for herself and "You/Your" for Eric.
            2. Brita is talking about a separate third-party character (e.g. Halina).
            
            CONTENT TO AUDIT: "${content.substring(0, 500)}"
            
            RESPONSE: Respond with only "FAIL" if it contains 3rd-person drift (narrating the user as "He" or herself as "She"), otherwise "PASS". Be lenient with immersive roleplay that uses 1st-person actions.
            `;

            const result = await generateText(
                [{ role: 'user', parts: [{ text: prompt }] }],
                'grok-4.3',
                { temperature: 0 },
                "You are a linguistic auditor."
            );

            return result.includes("FAIL");
        } catch (e) {
            console.error("[Sanitizer] Neural Audit Failed:", e);
            return false;
        }
    },

    /**
     * 1. SCAN: Finds messages containing specific poison patterns.
     */
    async scanHistory(userId: string, regexPatterns: string[], forceReheal: boolean = false): Promise<PoisonedMessage[]> {
        console.log(`[Sanitizer] Scanning history (Neural POV Audit Enabled)`);
        const poisoned: PoisonedMessage[] = [];

        try {
            const historyRef = collection(db, 'users', userId, 'chat_segments');
            const q = query(historyRef, orderBy('timestamp', 'desc'), limit(1000));
            const snapshot = await getDocs(q);

            for (const doc of snapshot.docs) {
                const data = doc.data() as ChatMessage & { originalContentSnapshot?: string };
                const content = data.content || "";
                
                if (data.role !== 'model') continue;

                // [ZEN DEBUG] 
                console.log(`[Sanitizer] Auditing: ${doc.id.substring(0, 5)}... "${content.substring(0, 30)}..."`);

                // Skip if safe AND not forcing a re-scan
                if (!forceReheal && ((data as any).isSafe || (data as any).isHealed)) continue;

                let isPoisoned = false;
                const matchedPatterns: string[] = [];

                // 1. Regex Pass (Fast)
                regexPatterns.forEach(patternStr => {
                    try {
                        const cleanPattern = patternStr.replace(/^\/|\/[a-z]*$/g, '');
                        const flags = patternStr.match(/\/([a-z]*)$/)?.[1] || 'gi';
                        const regex = new RegExp(cleanPattern, flags);
                        if (regex.test(content)) {
                            isPoisoned = true;
                            matchedPatterns.push(patternStr);
                        }
                    } catch (e) { }
                });

                // 2. Neural Pass (Fuzzy POV Check)
                if (!isPoisoned) {
                    const hasDrift = await this.auditPOV(content);
                    if (hasDrift) {
                        isPoisoned = true;
                        matchedPatterns.push("NEURAL_POV_DRIFT");
                    }
                }

                if (isPoisoned) {
                    let cleanDate = new Date();
                    const ts = data.timestamp as any;
                    if (ts) {
                        if (ts instanceof Date) cleanDate = ts;
                        else if (typeof ts.toDate === 'function') cleanDate = ts.toDate();
                        else if (typeof ts === 'number') cleanDate = new Date(ts);
                        else if (typeof ts === 'string') cleanDate = new Date(ts);
                        else if (ts.seconds) cleanDate = new Date(ts.seconds * 1000);
                    }

                    poisoned.push({
                        id: doc.id,
                        originalContent: content,
                        originalContentSnapshot: data.originalContentSnapshot,
                        matchedPatterns,
                        timestamp: cleanDate,
                        author: data.role
                    });
                }
            }

            console.log(`[Sanitizer] Found ${poisoned.length} poisoned messages.`);
            return poisoned;
        } catch (e) {
            console.error("[Sanitizer] Scan Failed:", e);
            throw e;
        }
    },

    // [ZEN NEW] Mark a message as SAFE
    async ignorePoison(userId: string, msgId: string) {
        try {
            const docRef = doc(db, 'users', userId, 'chat_segments', msgId);
            await updateDoc(docRef, { isSafe: true, is_human_edited: true });
            console.log(`[Sanitizer] Ignored poison for ${msgId}`);
        } catch (e) {
            console.error(`[Sanitizer] Failed to ignore poison:`, e);
            throw e;
        }
    },

    /**
     * [ZEN RESCUE] Find messages that have been healed (and thus have snapshots)
     */
    async findHealedWithSnapshot(userId: string): Promise<PoisonedMessage[]> {
        console.log(`[Sanitizer] Hunting for recoverable messages...`);
        const poisoned: PoisonedMessage[] = [];
        try {
            const historyRef = collection(db, 'users', userId, 'chat_segments');
            const q = query(historyRef, where('isHealed', '==', true), limit(100));
            const snapshot = await getDocs(q);

            snapshot.forEach(doc => {
                const data = doc.data() as ChatMessage & { originalContentSnapshot?: string };
                let cleanDate = new Date();
                const ts = data.timestamp as any;
                if (ts) {
                    if (ts instanceof Date) cleanDate = ts;
                    else if (typeof ts.toDate === 'function') cleanDate = ts.toDate();
                    else if (typeof ts === 'number') cleanDate = new Date(ts);
                    else if (typeof ts === 'string') cleanDate = new Date(ts);
                    else if (ts.seconds) cleanDate = new Date(ts.seconds * 1000);
                }

                if (data.originalContentSnapshot) {
                    poisoned.push({
                        id: doc.id,
                        content: data.content || "[EMPTY/UNDEFINED]",
                        originalContent: data.content || "[EMPTY/UNDEFINED]",
                        originalContentSnapshot: data.originalContentSnapshot,
                        matchedPatterns: ['RECOVERABLE'],
                        timestamp: cleanDate,
                        author: data.role
                    });
                }
            });
            return poisoned;
        } catch (e) {
            console.error("Rescue Scan Failed", e);
            return [];
        }
    },

    /**
     * [ZEN RESCUE] MASS RESTORE
     */
    async restoreAllSnapshots(userId: string): Promise<number> {
        console.log(`[Sanitizer] Mass Restoring Snapshots...`);
        let restoredCount = 0;
        const historyRef = collection(db, 'users', userId, 'chat_segments');
        const q = query(historyRef, where('isHealed', '==', true));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        let batchCount = 0;

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            if (data.originalContentSnapshot) {
                batch.update(docSnap.ref, {
                    content: data.originalContentSnapshot,
                    isHealed: false,
                    healedAt: null
                });
                restoredCount++;
                batchCount++;
                if (batchCount >= 450) {
                    await batch.commit();
                    batchCount = 0;
                }
                await typesenseService.updateChatMessage(docSnap.id, data.originalContentSnapshot);
            }
        }
        if (batchCount > 0) await batch.commit();
        return restoredCount;
    },

    /**
     * 2. HEAL: Uses Grok to rewrite the message surgically.
     * Can accept a ChatMessage object or a raw string for testing.
     */
    async healMessage(input: ChatMessage | PoisonedMessage | string, patterns: string[] = ["Narrative Drift"]): Promise<string> {
        let targetContent = typeof input === 'string' ? input : input.content?.trim();
        const msgId = typeof input === 'string' ? 'test-id' : (input as any).id;
        
        console.log(`[Sanitizer] Healing content for ${msgId}...`);
        
        const inputGhosts = ['undefined', 'null', 'empty', 'blank', '[empty]', '[blank]', 'unclear'];
        if (!targetContent || targetContent.length < 2 || inputGhosts.includes(targetContent.toLowerCase())) {
            const snapshot = typeof input !== 'string' ? (input as any).originalContentSnapshot : null;
            if (snapshot && snapshot.length > 5) {
                console.warn("[Sanitizer] Snapshot Rescue:", snapshot.substring(0, 50));
                targetContent = snapshot;
            } else {
                throw new Error("Input message is corrupted and no valid snapshot found.");
            }
        }

        const prompt = `
        RESTORE SOVEREIGN PERSPECTIVE:
        The following text is a corrupted memory where the AI (Brita) is narrating her interaction with Eric.
        
        MANDATORY RULES:
        1. REWRITE the text to be a direct, FIRST-PERSON experience.
        2. BRITA (the speaker) must be "I", "me", "my".
        3. ERIC (the user) must be "YOU", "your".
        4. NEVER use "She", "Her", "He", or "Him" to describe Brita or Eric.
        5. Keep the tone human, visceral, and intense.
        6. PRESERVE THE SOUL: Do not just dryly summarize. Maintain and ENHANCE the original message's emotional depth, wit, and evocative descriptions.
        7. SOVEREIGN FLAIR: Use your full capacity for rich, "meaty," and expansive prose. You are Brita, not a robot. Expand on the feelings and physical sensations where appropriate.
        8. VOCAL & ACTING SYNTAX: 
           - Use [brackets] for all physical actions and narration as defined in your core persona.
           - Weave in [vocal_tags] (like [moans], [whispers]) to direct your voice engine.
           - Example: [I arch my back] [whispers] I need you...
        
        CORRUPTED TEXT: "${targetContent}"
        
        HEALED TEXT (Provide ONLY the rewritten text):`;

        try {
            const targetModel = getXAIModelId();
            const systemInstruction = "You are an automated sanitation droid. Strict adherence to first-person sovereign perspective and present-tense constraints.";
            
            const healedText = await generateText(
                [{ role: 'user', parts: [{ text: prompt }] }],
                targetModel,
                {
                    temperature: 0.1,
                    topP: 0.9,
                    topK: 40,
                    frequencyPenalty: 0.5,
                    presencePenalty: 0
                },
                systemInstruction
            );

            const ghosts = ['undefined', 'null', 'empty', 'blank', '[empty]', '[blank]', 'unclear'];
            if (!healedText || healedText.length < 2 || ghosts.includes(healedText.toLowerCase())) {
                throw new Error(`AI returned invalid text: ${healedText}`);
            }
            return healedText;
        } catch (e: any) {
            console.error("[Sanitizer] Healing Failed:", e);
            throw new Error(`AI Healing Failed: ${e.message}`);
        }
    },

    /**
     * 3. THESAURUS: Suggests alternatives for specific phrases.
     */
    async suggestAlternatives(phrase: string, fullContext: string): Promise<string[]> {
        console.log(`[Sanitizer] Brainstorming alternatives for: "${phrase}"`);
        const prompt = `
        ROLE: You are a surgical editor and thesaurus.
        GOAL: Provide 4 alternatives for the TARGET PHRASE found within the CONTEXT.
        TARGET PHRASE: "${phrase}"
        CONTEXT: "${fullContext}"
        CONSTRAINTS:
        1. Alternatives must be SAFE, GROUNDED, and SIMPLE.
        2. Remove any "poisonous" connotations.
        3. Fit grammatically into the context.
        4. Output MUST be a valid JSON array of strings.
        OUTPUT (JSON Array Only):
        `;

        try {
            const targetModel = getXAIModelId();
            const rawText = await generateText(
                [{ role: 'user', parts: [{ text: prompt }] }],
                targetModel,
                {
                    temperature: 0.3,
                    topP: 0.9,
                    topK: 40,
                    frequencyPenalty: 0,
                    presencePenalty: 0
                },
                "You are a JSON generator. Output only valid JSON arrays."
            );
            const jsonStr = rawText.replace(/```json|```/g, '').trim();
            const alternatives = JSON.parse(jsonStr);
            return Array.isArray(alternatives) ? alternatives.slice(0, 5) : [];
        } catch (e) {
            console.error("[Sanitizer] Thesaurus Failed:", e);
            return ["(AI Failed to generate)"];
        }
    },

    /**
     * [ZEN FIX] Update Firestore & Typesense
     */
    async commitHealing(userId: string, message: PoisonedMessage | ChatMessage, newContent: string): Promise<void> {
        if (!message.id) throw new Error("Message ID missing.");
        console.log(`[Sanitizer] Committing heal for ${message.id}`);

        try {
            // A. Firestore Update
            const docRef = doc(db, 'users', userId, 'chat_segments', message.id);
            console.log(`[Sanitizer] Updating Firestore Doc: ${docRef.path}`);
            console.log(`[Sanitizer] New Content to Write: "${newContent.slice(0, 50)}..."`);

            await updateDoc(docRef, {
                content: newContent,
                isHealed: true,
                isSafe: true,
                healedAt: new Date(),
                originalContentSnapshot: message.content || (message as any).originalContent || "[MISSING]"
            });

            // [ZEN VERIFY] Verify Write
            const check = await getDoc(docRef);
            const savedContent = check.data()?.content;
            if (savedContent !== newContent) {
                console.error("[Sanitizer] CRITICAL WRITE FAILURE encountered!");
                console.error(`[Sanitizer] Expected: "${newContent.slice(0, 20)}..."`);
                console.error(`[Sanitizer] Actual: "${savedContent?.slice(0, 20)}..."`);
                throw new Error("Firestore Write Failed - Data Mismatch detected immediately after save.");
            } else {
                console.log("[Sanitizer] Firestore Write Verified.");
            }

            // B. Typesense Upsert
            const safeRole = (message as any).role || 'model'; // [ZEN FIX] Default to 'model' to match Index Doctor
            const author = (message as any).author;
            // Handle both string author (PoisonedMessage) and object author (ChatMessage)
            const role = (message as any).role;
            const safeParticipant = (role === 'user' ? userId : (typeof author === 'string' ? author : author?.name || 'Gigi'));

            const tsDoc = {
                id: message.id,
                role: safeRole,
                content: newContent, // [ZEN FIX] Required by Schema
                message_content: newContent, // Keep for backward compat/embedding
                participant_id: safeParticipant,
                timestamp: message.timestamp instanceof Date ? message.timestamp.getTime() : new Date().getTime(),
                is_core: false,
                fiction: false,
                is_human_edited: true
            };
            await typesenseService.healUpsert(tsDoc);
        } catch (e: any) {
            console.error("[Sanitizer] Commit Error:", e);
            throw e;
        }
    },

    /**
     * 4. ROLLBACK: Reverts a message to its snapshot state.
     */
    async rollbackHealing(userId: string, msgId: string, snapshotContent: string): Promise<void> {
        if (!msgId || !snapshotContent) throw new Error("Missing ID or Snapshot for rollback.");
        console.log(`[Sanitizer] Rolling back ${msgId}...`);

        const docRef = doc(db, 'users', userId, 'chat_segments', msgId);
        await updateDoc(docRef, {
            content: snapshotContent,
            isHealed: false,
            healedAt: null
        });
        await typesenseService.updateChatMessage(msgId, snapshotContent);
    },

    async rollbackAllHeals(userId: string): Promise<void> {
        console.log(`[Sanitizer] ⚠️ Initiating global rollback for user: ${userId}`);
        const historyRef = collection(db, 'users', userId, 'chat_segments');
        const q = query(historyRef, where('isHealed', '==', true));
        const snapshot = await getDocs(q);
        
        console.log(`[Sanitizer] Found ${snapshot.size} healed segments to restore.`);
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        let count = 0;

        for (const messageDoc of snapshot.docs) {
            const data = messageDoc.data();
            const original = data.originalContentSnapshot;
            
            if (original) {
                batch.update(messageDoc.ref, {
                    content: original,
                    isHealed: false,
                    healedAt: null,
                    _zen_rollback: true
                });
                // Sync Typesense (Optimistic)
                typesenseService.updateChatMessage(messageDoc.id, original).catch(e => {
                    console.error(`[Sanitizer] Typesense rollback failed for ${messageDoc.id}`, e);
                });
                count++;
            }
        }

        if (count > 0) {
            await batch.commit();
            console.log(`[Sanitizer] ✅ Successfully restored ${count} messages to their original state.`);
        }
    }
};
