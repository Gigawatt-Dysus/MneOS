import { getFirestore, collection, getDocs, doc, updateDoc } from './sovereignDbAdapter';
import { SecretsManager } from '../utils/SecretsManager';
import { getPrimaryModelId, getReserveModelId, FAST_MODEL_ID } from './ai/config';
import { callXAI } from './ai/providers';

// [ZEN FIX] Added 'is_fiction' to the interface
interface EnrichmentResult {
    title: string;
    summary: string;
    keywords: string[];
    sentiment: string;
    is_fiction: boolean; // <--- The new magic flag
}

const SAFE_QWEN = "accounts/fireworks/models/qwen3-vl-30b-a3b-instruct";
const SOVEREIGN_RESERVE = "grok-4.3"; 

// [ZEN HELPER] Librarian Queue (Gatekeeper Protocol)
// Single-lane throttle to prevent Rate Limit (429) bans.
// Logic: 2000ms gap between tasks.
class RequestQueue {
    private queue: Array<{ id: string, resolve: (val: any) => void, reject: (err: any) => void, task: () => Promise<any> }> = [];
    private isProcessing = false;
    private listeners: Array<(status: 'idle' | 'busy' | 'error') => void> = [];
    private minTime = 2000;

    enqueue<T>(task: () => Promise<T>, id: string = "anon"): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ id, resolve, reject, task });
            this.notify('busy');
            this.process();
        });
    }

    subscribe(callback: (status: 'idle' | 'busy' | 'error') => void) {
        this.listeners.push(callback);
        // Initial sync
        callback(this.isProcessing || this.queue.length > 0 ? 'busy' : 'idle');
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    private notify(status: 'idle' | 'busy' | 'error') {
        this.listeners.forEach(cb => cb(status));
    }

    private async process() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            if (!item) break;

            this.notify('busy');
            console.log(`[Librarian Queue] Processing: ${item.id}. Remaining: ${this.queue.length}`);

            try {
                const result = await item.task();
                item.resolve(result);
                // Success: Wait buffer
                await new Promise(r => setTimeout(r, this.minTime));
            } catch (error: any) {
                console.warn(`[Librarian Queue] Task Failed (${item.id}):`, error);

                // If 429, we signal ERROR state to UI but don't crash
                if (error.message?.includes('429')) {
                    this.notify('error');
                    // Wait LONGER on 429
                    await new Promise(r => setTimeout(r, 5000));
                } else {
                    // Standard wait
                    await new Promise(r => setTimeout(r, this.minTime));
                }

                item.reject(error);
            }
        }

        this.isProcessing = false;
        this.notify('idle');
    }
}

export const librarianQueue = new RequestQueue();

export const EnrichmentService = {

    // [ZEN HELPER] Single Document Enrichment (Exposed for Editor)
    async enrichSingleDocument(text: string): Promise<EnrichmentResult | null> {
        // [ZEN V41] Force fast model for single-doc metadata
        let primaryModel = getReserveModelId() || FAST_MODEL_ID;
        let reserveModel = FAST_MODEL_ID;

        if (primaryModel.includes("llama")) primaryModel = SAFE_QWEN;

        try {
            // TRY PRIMARY
            let metadata = await this.dispatchAnalysis(primaryModel, text);

            // IF PRIMARY FAILS -> TRY RESERVE
            if (!metadata) {
                console.warn(`[Librarian] Primary failed for single doc. Trying Reserve...`);
                metadata = await this.dispatchAnalysis(reserveModel, text);
            }

            return metadata;
        } catch (error) {
            console.error("[Librarian] Single Enrichment Failed:", error);
            return null;
        }
    },

    async enrichMemoryBank(userId: string, onProgress: (msg: string) => void) {
        // [ZEN V41] BUDGET AUSTERITY: Use Fast tier for background analysis
        let primaryModel = getReserveModelId() || FAST_MODEL_ID;
        let reserveModel = FAST_MODEL_ID;

        // [ZEN ANTIDOTE] Keep the anti-poison logic
        if (primaryModel.includes("llama")) {
            console.warn(`[Librarian] ☣️ POISON DETECTED: "${primaryModel}". Force-swapping to Qwen.`);
            primaryModel = SAFE_QWEN;
        }

        console.log(`[Librarian] 🟢 Active: ${primaryModel}`);
        console.log(`[Librarian] 🟡 Reserve: ${reserveModel}`);

        const db = getFirestore();
        const segmentsRef = collection(db, 'users', userId, 'chat_segments');

        try {
            const snapshot = await getDocs(segmentsRef);
            if (snapshot.empty) return { success: true, count: 0 };

            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

            // Filter
            // [ZEN FIX] Zombie Recovery: Include items with NO metadata OR empty keywords
            const todo = docs.filter(d => {
                const hasKeywords = d.search_metadata?.keywords &&
                    Array.isArray(d.search_metadata.keywords) &&
                    d.search_metadata.keywords.length > 0;

                // If it lacks keywords, it's a Zombie or New -> Process it
                const needsEnrichment = !d.search_metadata || !hasKeywords;

                return needsEnrichment &&
                    d.content &&
                    d.content.length > 50 &&
                    d.role !== 'system';
            });

            onProgress(`Found ${todo.length} memories to analyze.`);

            let processed = 0;
            let totalErrors = 0;

            for (const docData of todo) {
                if (totalErrors >= 3) {
                    const msg = `🛑 EMERGENCY STOP: 3 Failures. Aborting to prevent Ban.`;
                    console.error(msg);
                    onProgress(msg);
                    return { success: false, error: msg };
                }

                // [ZEN EWO 009] Human Supremacy Rule - Version Locking
                // If a human has manually edited this (v3-manual), we DO NOT overwrite it.
                if (docData.metadataVersion === 'v3-manual') {
                    console.log(`[Librarian] ⛔ SKIPPING ${docData.id}: Human Override (v3-manual)`);
                    processed++; // Count as processed since we assessed it
                    continue;
                }

                processed++;
                onProgress(`Analyzing ${processed}/${todo.length}...`);

                try {
                    // TRY PRIMARY
                    let metadata = await this.dispatchAnalysis(primaryModel, docData.content);

                    // IF PRIMARY FAILS -> TRY RESERVE
                    if (!metadata) {
                        console.warn(`[Librarian] Primary failed. Trying Reserve...`);
                        await new Promise(r => setTimeout(r, 2000));
                        metadata = await this.dispatchAnalysis(reserveModel, docData.content);
                    }

                    // IF SUCCESS
                    if (metadata) {
                        const docRef = doc(db, 'users', userId, 'chat_segments', docData.id);

                        // [ZEN FIX] Save the new fiction flag to Firestore
                        await updateDoc(docRef, {
                            search_metadata: metadata,
                            // We save it at the top level too for easier querying/filtering
                            fiction: metadata.is_fiction || false
                        });

                        const typeTag = metadata.is_fiction ? "📖 FICTION" : "🧠 MEMORY";
                        console.log(`[Librarian] Enriched [${typeTag}]: "${metadata.title}"`);
                        totalErrors = 0;
                    } else {
                        console.error(`[Librarian] All models failed for ${docData.id}`);
                        totalErrors++;
                    }

                } catch (err: any) {
                    console.error(`[Librarian] Doc Error ${docData.id}:`, err);
                    if (err.message && (err.message.includes("429") || err.message.includes("401"))) {
                        totalErrors += 3;
                    } else {
                        totalErrors++;
                    }
                } finally {
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            return { success: true, count: processed };

        } catch (e: any) {
            console.error("[Librarian] Critical Failure:", e);
            return { success: false, error: e.message };
        }
    },

    async dispatchAnalysis(modelId: string, text: string): Promise<EnrichmentResult | null> {
        // [ZEN V41] Safety check: Don't analyze ultra-short signals
        if (!text || text.length < 50) {
            return {
                title: "Short Signal",
                summary: text,
                keywords: [],
                sentiment: "Neutral",
                is_fiction: false
            };
        }
        return librarianQueue.enqueue(async () => {
            try {
                if (modelId.includes('grok')) {
                    return await this.callGrok(modelId, text);
                }
                else {
                    return await this.callFireworks(modelId, text);
                }
            } catch (e) {
                console.error(`[Librarian] Adapter Error (${modelId}):`, e);
                throw e; // Propagate to Queue
            }
        });
    },

    async callFireworks(model: string, text: string): Promise<EnrichmentResult> {
        const apiKey = SecretsManager.get('fireworks');
        if (!apiKey) throw new Error("Missing Fireworks Key");

        const systemText = this.getSystemPrompt();

        const payload = {
            model: model,
            max_tokens: 2048,
            top_p: 1,
            top_k: 40,
            presence_penalty: 0,
            frequency_penalty: 0,
            temperature: 0.6,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: systemText + "\n\nANALYZE THIS:\n" + text.substring(0, 12000)
                        }
                    ]
                }
            ]
        };

        const response = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Fireworks API ${response.status}: ${errText}`);
        }

        const data = await response.json();
        return this.parseJSON(data.choices[0].message.content);
    },


    async callGrok(model: string, text: string): Promise<EnrichmentResult> {
        const apiKey = SecretsManager.get('xai');
        if (!apiKey) throw new Error("Missing xAI Key");

        const prompt = this.getSystemPrompt() + `\n\nCONTENT:\n"${text.substring(0, 12000)}"`;

        const response = await fetch("https://api.x.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: "You are a JSON-only API. Output raw JSON." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.2,
                stream: false
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`xAI Error: ${response.status} - ${errBody || response.statusText}`);
        }
        const data = await response.json();
        return this.parseJSON(data.choices[0].message.content);
    },

    // [ZEN FIX] Updated System Prompt to detect Fiction
    getSystemPrompt() {
        return `
            You are the Archivist. Analyze the text below.
            
            Determine if the content is "Real Memory" (conversations about life, facts, feelings) 
            OR "Fiction" (stories, roleplay, creative writing, screenplays, song lyrics).
            
            RETURN RAW JSON ONLY. No markdown.
            {
                "title": "Short descriptive title",
                "summary": "Detailed summary (max 100 words). Include emotional nuance.",
                "keywords": ["5-10", "search", "keywords", "emotions", "topics"],
                "sentiment": "Positive, Negative, Neutral, Traumatic, Romantic, etc.",
                "is_fiction": true/false
            }
        `;
    },

    parseJSON(raw: string): EnrichmentResult {
        try {
            let clean = raw.trim();
            // 1. Strip Markdown Code Blocks
            clean = clean.replace(/```json/gi, '').replace(/```/g, '');

            // 2. Extract JSON Object (greedy outer braces)
            const start = clean.indexOf('{');
            const end = clean.lastIndexOf('}');

            if (start === -1 || end === -1) throw new Error("No JSON braces found.");

            clean = clean.substring(start, end + 1);

            return JSON.parse(clean);
        } catch (e) {
            console.warn("[Librarian] Strict JSON Parse failed. Attempting Repair...", e);
            try {
                // [ZEN REPAIR] Attempt to quote unquoted keys (common LLM error)
                // Looks for { key: or , key: and quotes the key.
                let clean = raw.trim();
                const start = clean.indexOf('{');
                const end = clean.lastIndexOf('}');
                if (start !== -1 && end !== -1) clean = clean.substring(start, end + 1);

                // Regex: Match alphanumeric keys followed by colon, not already quoted
                const fixed = clean.replace(/([{,])\s*([a-zA-Z0-9_]+?)\s*:/g, '$1 "$2":');
                return JSON.parse(fixed);
            } catch (e2) {
                console.error("[Librarian] JSON Parse Crumbled. Raw Output:", raw);
                throw e; // Throw original or new error
            }
        }
    }
};