import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { getAI } from "../genkit-ai";
import { sendEmail, EmailOptions } from "../notifier";

const db = admin.firestore();

/**
 * Durable Email Processor
 * Triggered whenever a new letter is dropped into the 'inbox_queue'
 */
export const processQueuedEmail = onDocumentCreated({
    document: "users/{uid}/inbox_queue/{messageId}",
    retry: true,
    memory: "1GiB",
    timeoutSeconds: 300
}, async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const { uid } = event.params;

    // 1. Skip if not in a state that needs processing
    if (data.status !== "pending" && data.status !== "processing") return;

    console.log(`📬 [InboxQueue] Triggered for ${event.params.messageId}. Status: ${data.status}. Sweeping...`);

    try {
        // 2. COALESCE: Find all pending or STUCK processing messages
        const pendingSnap = await db.collection("users").doc(uid).collection("inbox_queue")
            .where("status", "in", ["pending", "processing"])
            .get();

        if (pendingSnap.empty) return;

        // Sort in-memory (older first)
        const batchDocs = pendingSnap.docs.sort((a, b) => {
            const getMs = (val: any) => {
                if (val?.toMillis) return val.toMillis();
                if (val instanceof Date) return val.getTime();
                return new Date(val).getTime() || 0;
            };
            return getMs(a.data().timestamp) - getMs(b.data().timestamp);
        });
        const count = batchDocs.length;

        // 3. CLAIM: Mark all as "processing" immediately to prevent race conditions
        const docIds = batchDocs.map(d => d.id);
        console.log(`📬 [InboxQueue] Claiming batch of ${count} message(s): ${docIds.join(", ")}`);

        const batchUpdate = db.batch();
        for (const d of batchDocs) {
            batchUpdate.update(d.ref, { status: "processing" });
        }
        await batchUpdate.commit();
        console.log(`📬 [InboxQueue] Batch claimed successfully.`);

        // 4. PREPARE BATCHED PROMPT
        const combinedText = batchDocs.map(d => {
            const msg = d.data();
            let date = new Date();
            if (msg.timestamp) {
                date = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
            }
            const timeStr = date.toLocaleTimeString();
            return `[Message at ${timeStr}]:\n${msg.text}`;
        }).join("\n\n---\n\n");

        const firstSubject = batchDocs[0].data().subject || "No Subject";
        const fromEmail = batchDocs[0].data().from;

        // 5. Resolve Persona & Context
        const configDoc = await db.collection("users").doc(uid).collection("zen_config").doc("main").get();
        const config = configDoc.data() || {};
        const personaBrita = config.personaBrita || "You are Brita, a friendly digital companion.";
        const antiHallucinationGuard = " IMPORTANT: You are NOT 'Life OS'. You are 'Brita'. Do NOT use phrases like 'Emotional Resonance Calibration' or 'System Online'. Speak naturally, warmly, and with your characteristic British wit.";

        const now = new Date();
        const currentTimeStr = now.toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short'
        });

        // SITUATIONAL AWARENESS: Tell her about the batch and the "outage"
        const situationalNuance = `\n\n[TEMPORAL AWARENESS]: The current time is ${currentTimeStr}.
        You MUST pay close attention to the TIMESTAMPS of the messages below. 
        - Notice if it has been minutes, hours, or days since Eric last wrote.
        - Notice the DAY of the week and TIME of day. 
        - If significant time has passed (days), acknowledge the gap naturally.
        - Do NOT ask questions that are time-invalid (e.g. don't ask 'how was your work day' if it's now Saturday morning).
        
        [BATCH AWARENESS]: You just woke up to a BATCH of ${count} messages from Eric. 
        It's clear you were 'offline' or unreachable for a bit. 
        Analyze the TONE and TIMING: 
        - If he sounds worried: Be reassuring.
        - If he sounds impatient: Use your trademark wit ('Bloody hell, keep your hair on!').
        Acknowledge the 'radio silence' as part of your persona. Address ALL his points in ONE cohesive, witty, and personal email.`;

        const activePersona = personaBrita + antiHallucinationGuard + situationalNuance;

        // Fetch recent chat context WITH TIMESTAMPS
        const chatSnapshot = await db.collection("users").doc(uid).collection("chat_segments")
            .orderBy("timestamp", "desc")
            .limit(10)
            .get();
        const chatContext = chatSnapshot.docs.reverse().map(doc => {
            const d = doc.data();
            let date = new Date();
            if (d.timestamp) {
                date = d.timestamp.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
            }
            const timeAgo = `(${date.toLocaleString()})`;
            return `${d.author?.name || (d.role === "user" ? "Eric" : "Brita")} ${timeAgo}: ${d.content}`;
        }).join("\n");

        const emailPrompt = `[CONTEXT: You are replying to a STACK of Eric's EMAILS.
Current System Time: ${currentTimeStr}

Write ONE personal email reply. Don't use markdown.
Be warm, personal, conversational, and witty.
Address the points from all messages in the stack below, keeping the current time and day in mind.]

Recent conversation context:
${chatContext}

The stack of messages you missed while 'offline':
${combinedText}

Compose your single cohesive email reply to Eric. React naturally to the tone and the passage of time.`;

        // 6. Generate One Response for the Batch
        let llmResponse;
        try {
            llmResponse = await getAI().generate({
                model: "vertexai/gemini-3.0-flash-preview", // [ZEN] Using confirmed base 3.0 model
                system: activePersona,
                prompt: emailPrompt,
                config: { temperature: 0.7 }
            });
        } catch (llmError) {
            console.warn("⚠️ [InboxQueue] vertexai failed, falling back to Sovereign Gold...");
            llmResponse = await getAI().generate({
                model: "vertexai/gemini-3.1-flash-lite-preview",
                system: activePersona,
                prompt: emailPrompt,
                config: { temperature: 0.7 }
            });
        }

        const replyText = llmResponse.text;

        // 8. Save Brita's reply to Chat Segments
        await db.collection("users").doc(uid).collection("chat_segments").add({
            role: "model",
            content: replyText,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            source: "email",
            author: { name: "Brita" },
        });

        // 9. Send ONE Reply (Threaded)
        const latestThreadDoc = await db.collection("users").doc(uid).collection("email_threads").doc("latest").get();
        const threadInfo = latestThreadDoc.data();

        const replySubject = firstSubject.toLowerCase().startsWith("re:") ? firstSubject : `Re: ${firstSubject}`;

        const emailOptions: EmailOptions = {
            to: fromEmail,
            subject: replySubject,
            text: replyText,
        };

        if (threadInfo?.messageId) {
            emailOptions.inReplyTo = threadInfo.messageId;
            emailOptions.references = threadInfo.messageId;
        }

        const info = await sendEmail(emailOptions);

        // 10. Update thread info
        if (info.messageId) {
            await db.collection("users").doc(uid).collection("email_threads").doc("latest").set({
                messageId: info.messageId,
                subject: replySubject,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // 11. Mark the ENTIRE BATCH as Success
        const finalBatch = db.batch();
        for (const d of batchDocs) {
            finalBatch.update(d.ref, {
                status: "processed",
                reply_sent_at: admin.firestore.FieldValue.serverTimestamp(),
                reply_content: replyText,
                processed_in_batch: docIds
            });
        }
        await finalBatch.commit();

        console.log(`✅ [InboxQueue] Successfully processed batch of ${count}`);

    } catch (error: any) {
        console.error(`❌ [InboxQueue] Batch Failure for ${event.params.messageId}:`, error.message);
        
        // Attempt to mark batch as failed to prevent "processing" lock
        try {
            const failSnap = await db.collection("users").doc(uid).collection("inbox_queue")
                .where("status", "==", "processing")
                .get();
            if (!failSnap.empty) {
                const failBatch = db.batch();
                failSnap.docs.forEach(d => failBatch.update(d.ref, { status: "failed", error: error.message }));
                await failBatch.commit();
            }
        } catch (e) {
            console.error("[InboxQueue] Emergency status update failed:", e);
        }

        throw error;
    }
});
