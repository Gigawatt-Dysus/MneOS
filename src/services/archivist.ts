import { collection, getDocs, getFirestore, doc, updateDoc } from './sovereignDbAdapter';
import { getPrimaryModelId, getFireworksKey, getXAIKey } from './ai/config';
import { callFireworks, callXAI } from './ai/providers';

interface ArchivistStats {
    scanned: number;
    healed: number;
    errors: string[];
}

// [ZEN HELPER] Dynamic Client Generation - Short-circuited for MongoDB native migration
const getTypesenseClient = (): any => {
    return null;
};

/**
 * [ZEN CORE] VETTED ROSTER GENERATION
 * Priority: 1. Fireworks (Qwen), 2. xAI (Grok)
 */
const generateMetadataWithRoster = async (content: string, role: string): Promise<string> => {
    const systemPrompt = `
    TASK: Analyze this chat log segment for a Search Index.
    
    CRITICAL INSTRUCTION:
    Return ONLY a single valid JSON object. 
    MAX 8 KEYWORDS.
    Do not include markdown formatting (no \`\`\`).
    
    OUTPUT FORMAT:
    {
        "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
        "sentiment": "OneOrTwoWords",
        "is_fiction": boolean,
        "summary": "One concise sentence summarizing the core topic."
    }
    `;

    const messages = [{ role: 'user', parts: [{ text: `CONTENT: "${content.substring(0, 5000)}"\nROLE: ${role}` }] }];
    const analyticalParams = { temperature: 0.1, maxOutputTokens: 512, topP: 0.95, topK: 40, frequencyPenalty: 0, presencePenalty: 0 }; // [ZEN FIX] Hard cap at 512 tokens

    // 1. PRIMARY: FIREWORKS (Qwen/Llama)
    try {
        const fwKey = getFireworksKey();
        const fwModel = getPrimaryModelId();
        if (fwKey && fwModel) {
            const result = await callFireworks(fwModel, messages, systemPrompt, fwKey, analyticalParams);
            return result.text || "";
        }
    } catch (e) {
        // console.warn("[Archivist] Primary Roster Failed, failing over...", e);
    }

    // 2. SECONDARY: xAI (Grok)
    try {
        const xaiKey = getXAIKey();
        const xaiModel = "grok-4.3";
        if (xaiKey) {
            const result = await callXAI(xaiModel, messages, systemPrompt); // Grok generally follows defaults well
            return result.text || "";
        }
    } catch (e) {
        // console.warn("[Archivist] Secondary Roster Failed, failing over...", e);
    }

    throw new Error("ALL ROSTER CLUSTERS FAILED. Unable to generate metadata.");
};

const extractJson = (text: string): string => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return text; // Fallback to raw if no JSON structure
    return text.substring(start, end + 1);
};

/**
 * THE ARCHIVIST
 * Scans for "hollow" chat segments (missing metadata) and uses AI to enrich them natively in MongoDB Atlas.
 */
export const runArchivist = async (userId: string): Promise<ArchivistStats> => {
    const db = getFirestore();
    const stats: ArchivistStats = { scanned: 0, healed: 0, errors: [] };
    const tsClient = getTypesenseClient();

    if (!tsClient) {
        console.log("[THE ARCHIVIST] Typesense deprecated. Healing natively in MongoDB Atlas.");
    }

    try {
        const collectionRef = collection(db, 'users', userId, 'chat_segments');
        const snapshot = await getDocs(collectionRef);

        if (snapshot.empty) return stats;

        stats.scanned = snapshot.size;
        console.log(`[THE ARCHIVIST] Analysis Phase: Scanning ${stats.scanned} documents...`);

        const hollowDocs: any[] = [];

        // 1. Identify Hollow Docs
        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const isHollow = !data.search_metadata ||
                !data.keywords ||
                (Array.isArray(data.keywords) && data.keywords.length === 0) ||
                !data.search_metadata.summary;

            if (isHollow && data.content && data.content.length > 5) {
                hollowDocs.push({ id: docSnap.id, ...data });
            }
        });

        console.log(`[THE ARCHIVIST] Found ${hollowDocs.length} hollow records requiring enrichment.`);

        // 2. Process Batch (Chunked conservatively)
        const batchSize = 5;
        for (let i = 0; i < hollowDocs.length; i += batchSize) {
            const chunk = hollowDocs.slice(i, i + batchSize);

            await Promise.all(chunk.map(async (docData) => {
                try {
                    // A. ANALYZE (Using Vetted Roster)
                    // [ZEN FIX] Lower token limit to cut off loops, Max 8 keywords to prevent listing forever
                    const text = await generateMetadataWithRoster(docData.content, docData.role);
                    let cleanText = extractJson(text);
                    let analysis: any = {};

                    try {
                        analysis = JSON.parse(cleanText);
                    } catch (parserError) {
                        // [ZEN FIX] Attempt to close truncated JSON if the AI looped and got cut off
                        try {
                            console.warn(`[Archivist] JSON broken for ${docData.id}. Attempting surgical repair...`);
                            if (cleanText.includes('"keywords": [') && !cleanText.includes('}')) {
                                cleanText += '"] }'; // Crude closure attempt
                                analysis = JSON.parse(cleanText);
                            } else {
                                throw parserError;
                            }
                        } catch (repairError) {
                            console.error(`[Archivist] ❌ Critical Parse Failure for ${docData.id}. Skipping record.`);
                            stats.errors.push(`${docData.id}: JSON Parse Failed`);
                            return; // Skip this doc, but CONTINUE the batch
                        }
                    }

                    // B. ENRICH
                    const enrichedData = {
                        keywords: analysis.keywords || [],
                        search_metadata: {
                            keywords: analysis.keywords || [],
                            is_fiction: analysis.is_fiction || false,
                            sentiment: analysis.sentiment || "Neutral",
                            summary: analysis.summary || "No summary available."
                        },
                        is_fiction: analysis.is_fiction || false,
                        is_core: docData.is_core || false,
                        island_id: docData.island_id || "",
                        model_id: docData.model_id || "unknown",
                        last_audited: new Date().toISOString()
                    };

                    // C. UPDATE FIRESTORE/MONGODB
                    const docRef = doc(db, 'users', userId, 'chat_segments', docData.id);
                    await updateDoc(docRef, enrichedData);
                    stats.healed++;

                } catch (e: any) {
                    stats.errors.push(`${docData.id}: ${e.message}`);
                }
            }));

            // tiny nap to avoid any provider flooding
            await new Promise(r => setTimeout(r, 500));
        }

    } catch (error: any) {
        console.error("[THE ARCHIVIST] Fatal Error:", error);
        stats.errors.push(error.message);
    }

    console.log(`[THE ARCHIVIST] Mission Complete. Healed ${stats.healed} documents.`);
    return stats;
};
