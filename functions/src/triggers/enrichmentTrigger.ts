import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import { z } from "zod";

const ai = genkit({
    plugins: [googleAI()],
    model: "gemini-3-flash-preview", // Default safely
});

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// [ZEN SCHEMA] The One True Schema for Metadata
const MetadataSchema = z.object({
    title: z.string(),
    summary: z.string(),
    keywords: z.array(z.string()),
    sentiment: z.string(),
    is_fiction: z.boolean()
});

export const enrichChatSegment = onDocumentWritten({
    document: "users/{uid}/chat_segments/{docId}",
    memory: "1GiB",
    timeoutSeconds: 300
}, async (event) => {
    const snap = event.data?.after;
    if (!snap) return; // Deleted doc

    const data = snap.data();
    if (!data || !data.content) return;

    // 1. [CRITICAL CHECK] Prevent Infinite Loops
    // Only proceed if metadata is MISSING or incomplete
    if (data.search_metadata && Array.isArray(data.search_metadata.keywords) && data.search_metadata.keywords.length > 0) {
        // Already enriched. Stop.
        return;
    }

    // 2. [SOURCE FILTER] Ignore System messages or short garbage
    if (data.role === 'system' || (data.content.length < 10 && !data.content.includes("image"))) {
        return;
    }

    const docId = event.params.docId;
    const uid = event.params.uid;

    console.log(`[Enrichment] 🧠 Processing Naked Record: ${docId} (Source: ${data.source || 'unknown'})`);

    try {
        // 3. [AI GENERATION] Call Gemini to generate tags
        const prompt = `
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

            CONTENT:
            "${data.content.substring(0, 5000)}"
        `;

        const llmResponse = await ai.generate({
            prompt: prompt,
            config: { temperature: 0.2 },
        });

        const rawText = llmResponse.text;
        const jsonBlock = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const metadata = JSON.parse(jsonBlock);

        // 4. [VALIDATION] Verify Schema
        const safeMetadata = MetadataSchema.parse(metadata);

        // 5. [ATOMIC UPDATE] Write back to the SAME document
        // This will trigger the function again, but Step 1 will catch it and exit.
        await snap.ref.update({
            search_metadata: safeMetadata,
            // Flatten critical fields for easier querying
            is_core: !safeMetadata.is_fiction, // Default: Real = Core, Fiction = Not Core
            keywords: safeMetadata.keywords,
            sentiment: safeMetadata.sentiment,
            fiction: safeMetadata.is_fiction,
            last_enriched: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[Enrichment] ✅ Successfully Enriched: ${docId}`);

    } catch (error) {
        console.error(`[Enrichment] ❌ Failed to enrich ${docId}:`, error);
        // We do NOT delete or retry indefinitely to avoid costs. 
        // We just log the failure. Use a "retry script" for batch healing later.
    }
});
