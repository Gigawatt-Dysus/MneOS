// [ZEN] Email-as-Chat Engine — Two-way Brita ↔ Eric email loop
// [ZEN CACHE BUSTER] ID: 1777884311614-SOVEREIGN-REFRESH
// Mirrors the Alexa pattern: source: 'email' tagged in chat_segments
// Self-contained AI generation to avoid circular imports with index.ts

import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as imapSimple from "imap-simple";
import axios from "axios";
import { sendEmail } from "./notifier";
async function handleArchivistIngestion(from: string, subject: string, text: string, attachments: any[]) { console.warn('handleArchivistIngestion migrated to Vercel native pipelines'); }

// --- ENSURE ADMIN INIT ---
if (!admin.apps.length) {
    admin.initializeApp();
}

// --- CONSTANTS ---
// [DEV HARDCODED] Will move to zen_config/main for user-configurable settings
const DEV_UID = "9MPVGVTxE8dXvkCrl1XrWHQzCl23"; // Eric's UID
const DEV_RECIPIENT = process.env.EMAIL_RECIPIENT || "dysus2024@gmail.com";
const CHAT_CONTEXT_LIMIT = 15; // How many recent messages to pull for context
const EMAIL_THREAD_COLLECTION = "email_threads"; // Sub-collection under user doc
const ARCHIVIST_EMAIL = "archivist@gigiwatt.com";

// --- FIRESTORE REF ---
const db = admin.firestore();

// =====================================================================
// SELF-CONTAINED AI GENERATION (Mirrors index.ts roster logic)
// =====================================================================
async function fetchUserRoster(uid: string) {
    try {
        const configDoc = await db.collection("users").doc(uid).collection("zen_config").doc("main").get();
        if (!configDoc.exists) return null;
        return configDoc.data();
    } catch (e) {
        console.error("[EmailChat][Roster] Failed to fetch config:", e);
        return null;
    }
}

async function callFireworksDirect(modelId: string, prompt: string, apiKey: string, persona: string) {
    const url = "https://api.fireworks.ai/inference/v1/chat/completions";
    const response = await axios.post(url, {
        model: modelId,
        messages: [
            { role: "system", content: persona },
            { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2048 // Longer for email vs voice
    }, {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 15000 // Longer timeout for email (not real-time)
    });
    return response.data.choices[0]?.message?.content;
}

async function callXAIDirect(modelId: string, prompt: string, apiKey: string, persona: string) {
    const url = "https://api.x.ai/v1/chat/completions";
    const response = await axios.post(url, {
        model: modelId,
        messages: [
            { role: "system", content: persona },
            { role: "user", content: prompt }
        ],
        temperature: 0.7
    }, {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        timeout: 15000
    });
    return response.data.choices[0]?.message?.content;
}

import { ai } from "./genkit-ai";

async function generateEmailResponse(uid: string, prompt: string, persona: string): Promise<string> {
    console.log(`[EmailChat] Generating neural response for ${uid}...`);
    
    try {
        const response = await ai.generate({
            model: "vertexai/gemini-3-flash-preview",
            system: persona,
            prompt: prompt,
            config: { temperature: 0.7 }
        });
        
        return response.text;
    } catch (e: any) {
        console.error("[EmailChat] AI Generation failed:", e.message);
        throw e;
    }
}

// =====================================================================
// HELPER: Fetch recent chat history for context
// =====================================================================
async function getRecentChatContext(uid: string): Promise<string> {
    const segmentsRef = db.collection("users").doc(uid).collection("chat_segments");
    const snapshot = await segmentsRef
        .orderBy("timestamp", "desc")
        .limit(CHAT_CONTEXT_LIMIT)
        .get();

    if (snapshot.empty) return "(No recent conversation history.)";

    const messages = snapshot.docs
        .map((doc) => {
            const data = doc.data();
            const role = data.role === "model" ? "Brita" : "Eric";
            const source = data.source ? ` [via ${data.source}]` : "";
            return `${role}${source}: ${data.content}`;
        })
        .reverse(); // Chronological order

    return messages.join("\n\n");
}

// =====================================================================
// HELPER: Resolve Brita's persona from user config
// =====================================================================
async function getBritaPersona(uid: string): Promise<string> {
    const defaultPersona = "You are Brita, Eric's AI companion in Project GIGI. You are warm, witty, and deeply familiar with Eric's life story.";

    try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const primaryCompanion = userData?.aiCompanions?.find((c: any) => c.isPrimary) || userData?.aiCompanions?.[0];
            if (primaryCompanion) {
                return `You are ${primaryCompanion.name}. ${primaryCompanion.persona}. ${primaryCompanion.customPersonaDescription || ""}`;
            }
        }
    } catch (e) {
        console.warn("[EmailChat] Persona resolve failed, using default:", e);
    }

    return defaultPersona;
}

// =====================================================================
// HELPER: Store email thread metadata for threading
// =====================================================================
async function storeThreadInfo(uid: string, messageId: string, subject: string) {
    await db.collection("users").doc(uid).collection(EMAIL_THREAD_COLLECTION).doc("latest").set({
        messageId,
        subject,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}

async function getLatestThread(uid: string): Promise<{ messageId: string; subject: string } | null> {
    const doc = await db.collection("users").doc(uid).collection(EMAIL_THREAD_COLLECTION).doc("latest").get();
    if (!doc.exists) return null;
    return doc.data() as { messageId: string; subject: string };
}

// =====================================================================
// HELPER: Parse reply text — strip quoted content
// =====================================================================
function extractReplyBody(fullText: string): string {
    // Common patterns for quoted text in email replies
    const cutoffPatterns = [
        /On .+ wrote:/i,                     // "On Feb 14, 2026 Brita wrote:"
        /-----Original Message-----/i,        // Outlook style
        /_{5,}/,                              // Underscores separator
        /^>+\s/m,                             // Quoted lines starting with >
        /^From:\s/m,                          // "From: Brita..."
        /\nSent from my /i,                   // Mobile signatures
    ];

    let cleanText = fullText;

    for (const pattern of cutoffPatterns) {
        const match = cleanText.search(pattern);
        if (match > 0) {
            cleanText = cleanText.substring(0, match);
            break; // Stop at the first matched pattern
        }
    }

    return cleanText.trim();
}

// [ZEN] Standalone function for manual triggering (e.g. via debugBrain)
export async function startNewEmailThread(uid: string) {
    console.log(`📧 [EmailChat] Initiating email conversation for ${uid}...`);

    try {
        // 1. Pull recent chat context
        const chatContext = await getRecentChatContext(uid);

        // 2. Resolve Brita's persona
        const persona = await getBritaPersona(uid);

        // 3. Build email-specific prompt
        const emailPrompt = `[CONTEXT: You are writing an EMAIL to Eric, not chatting in an app. 
Write naturally as if composing a personal email. Don't use markdown formatting.
Keep it warm, personal, and conversational — like a friend writing an email.
You have access to the recent conversation for context, but don't just summarize it.
Instead, bring up something interesting, ask a thoughtful question, or share an observation.
Be genuine and brief — 2-4 paragraphs max.]

Recent conversation context:
${chatContext}

Now compose your email to Eric. Start with a natural greeting.`;

        // 4. Generate Brita's email content
        const responseText = await generateEmailResponse(uid, emailPrompt, persona);

        // 5. Write the AI's email to chat_segments (so it appears in chat history)
        await db.collection("users").doc(uid).collection("chat_segments").add({
            role: "model",
            content: responseText,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            source: "email",
            author: { name: "Brita" },
        });

        // 6. Send the actual email
        const subject = "💌 A note from Brita";
        const info = await sendEmail({
            to: DEV_RECIPIENT,
            subject,
            text: responseText,
            html: formatEmailHtml(responseText, "Brita"),
        });

        // 7. Store thread info for reply tracking
        if (info.messageId) {
            await storeThreadInfo(uid, info.messageId, subject);
        }

        console.log(`📧 [EmailChat] Email sent: ${info.messageId}`);
        return { success: true, messageId: info.messageId };

    } catch (error: any) {
        console.error("📧 [EmailChat] startNewEmailThread failed:", error.message);
        throw new Error(`Email chat init failed: ${error.message}`);
    }
}

// =====================================================================
// FUNCTION 1: initEmailChat — Trigger Brita's first email
// =====================================================================
// Callable: httpsCallable(functions, 'initEmailChat')()
// Or invokable from Firebase Console / test script
export const initEmailChat = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid || DEV_UID;
    return await startNewEmailThread(uid);
});

// =====================================================================
// FUNCTION 2: checkBritaInbox — Scheduled IMAP poll for replies
// =====================================================================
// Runs every 5 minutes. Reads unseen emails, processes replies.
export const checkBritaInbox = onSchedule("every 5 minutes", async () => {
    console.log("📬 [EmailChat] Polling Brita's inbox...");

    const imapConfig: imapSimple.ImapSimpleOptions = {
        imap: {
            user: process.env.GMAIL_USER || "brita@gigiwatt.com",
            password: process.env.GMAIL_APP_PASSWORD || "",
            host: process.env.GMAIL_IMAP_HOST || "imap.gmail.com",
            port: parseInt(process.env.GMAIL_IMAP_PORT || "993"),
            tls: true,
            authTimeout: 10000,
            tlsOptions: { rejectUnauthorized: false },
        },
    };

    let connection: imapSimple.ImapSimple | null = null;

    try {
        // 1. Connect to Brita's inbox
        connection = await imapSimple.connect(imapConfig);
        await connection.openBox("INBOX");

        // 2. Search for UNSEEN (unread) emails
        const searchCriteria = ["UNSEEN"];
        const fetchOptions = {
            bodies: ["HEADER", "TEXT"],
            markSeen: true, // Mark as read after processing
        };

        const messages = await connection.search(searchCriteria, fetchOptions);

        if (messages.length === 0) {
            console.log("📬 [EmailChat] No new emails.");
            return;
        }

        console.log(`📬 [EmailChat] Found ${messages.length} new email(s)!`);

        // 3. Process each reply
        for (const message of messages) {
            try {
                // Extract headers
                const headerPart = message.parts.find((p: any) => p.which === "HEADER");
                const textPart = message.parts.find((p: any) => p.which === "TEXT");

                if (!headerPart || !textPart) {
                    console.warn("📬 [EmailChat] Skipping malformed email (missing parts).");
                    continue;
                }

                const headers = headerPart.body;
                const from = Array.isArray(headers.from) ? headers.from[0] : headers.from;
                const subject = Array.isArray(headers.subject) ? headers.subject[0] : headers.subject;
                const rawBody = textPart.body;

                await handleIncomingCore(from, subject, rawBody);
            } catch (e: any) {
                console.error("📬 [EmailChat] Failed to process email:", e.message);
            }
        }

    } catch (error: any) {
        console.error("📬 [EmailChat] IMAP poll failed:", error.message);
    } finally {
        if (connection) {
            try { connection.end(); } catch (e) { /* cleanup */ }
        }
    }
});

// =====================================================================
// FUNCTION 3: processIncomingEmailWebhook — Instant Push from Cloudflare
// =====================================================================
import { onRequest } from "firebase-functions/v2/https";

export const processSovereignWebhook = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
    // [ZEN] DEBUG PROBE
    if (req.query.debug === 'true') {
        const logs = await db.collection("debug_logs").orderBy("timestamp", "desc").limit(5).get();
        res.json({
            logs: logs.docs.map(d => ({ 
                id: d.id, 
                ...d.data(), 
                timestamp: d.data().timestamp?.toDate() 
            }))
        });
        return;
    }

    // [ZEN] FLIGHT RECORDER
    try {
        if (!req.body || typeof req.body !== 'object') {
            console.error("📬 [Webhook] Malformed request body:", req.body);
            res.status(400).send("Malformed request body");
            return;
        }

        await db.collection("debug_logs").add({
            source: "processIncomingEmailWebhook",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            body: JSON.stringify(req.body).substring(0, 1000), // Prevent giant logs
            headers: req.headers,
        });
    } catch (e: any) {
        console.error("Flight Recorder failed:", e.message);
        // Don't die here, keep trying to process if body exists
    }

    const { from, subject, text } = req.body;

    if (!from || !text) {
        console.warn("📬 [Webhook] Missing required fields (from, text).");
        res.status(400).send("Missing required fields");
        return;
    }

    const uid = DEV_UID;
    
    // [ZEN] HEARTBEAT
    await db.collection("users").doc(uid).collection("chat_segments").add({
        role: "user",
        content: "[SYSTEM] Email Webhook Heartbeat Received.",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        source: "system_debug"
    });

    const to = req.body.to || "";
    try {
        // [ZEN] ROUTING LOGIC
        if (to.toLowerCase().includes("archivist")) {
            console.log("📂 [Webhook] Routing to Archivist Clerk...");
            await handleArchivistIngestion(from, subject || "No Subject", text, req.body.attachments);
        } else {
            console.log("💬 [Webhook] Routing to Brita...");
            await handleIncomingCore(from, subject || "No Subject", text);
        }

        // [ZEN] CONFIRMATION LOG
        await db.collection("debug_logs").add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            source: "processSovereignWebhook",
            action: "uplink_complete",
            uid
        });

        res.json({ success: true, resolved_uid: uid, status: "UPLINK_VERIFIED" });
    } catch (e: any) {
        console.error("📬 [Webhook] Processing failed:", e.message);
        res.status(500).send(e.message);
    }
});

// =====================================================================
// HELPER: Core Logic for Incoming Email (Shared between Poll & Push)
// =====================================================================
async function handleIncomingCore(from: string, subject: string, rawBody: string) {
    console.log(`📬 [EmailChat] Queueing incoming message from: ${from}`);
    
    // Extract just the reply portion (strip quoted text)
    let replyText = extractReplyBody(rawBody);
    
    // [ZEN] Sovereign Fallback: If cleaning killed the message, use the raw text
    if (!replyText || replyText.length < 2) {
        replyText = rawBody;
    }

    if (!replyText || replyText.length < 2) {
        return;
    }

    const uid = DEV_UID;

    // [ZEN] UPLINK BYPASS: Write directly to chat_segments for instant UI visibility
    console.log(`📬 [EmailChat] Uplinking directly to chat_segments...`);
    await db.collection("users").doc(uid).collection("chat_segments").add({
        role: "user",
        content: replyText,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        source: "email",
        author: { name: from.split('<')[0].trim() || "Eric" },
    });

    // DROP IN THE BOX: Write to the inbox_queue for background AI processing
    await db.collection("users").doc(uid).collection("inbox_queue").add({
        from,
        subject,
        text: replyText,
        status: "pending",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
}

// =====================================================================
// HELPER: Format email body as styled HTML
// =====================================================================
function formatEmailHtml(text: string, senderName: string): string {
    // Convert line breaks to paragraphs
    const paragraphs = text
        .split(/\n\n+/)
        .map((p) => `<p style="margin: 0 0 12px 0; line-height: 1.6;">${p.replace(/\n/g, "<br>")}</p>`)
        .join("");

    return `
<!DOCTYPE html>
<html>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
    <div style="margin-bottom: 20px;">
        ${paragraphs}
    </div>
    <div style="border-top: 1px solid #e0e0e0; padding-top: 12px; margin-top: 20px; font-size: 12px; color: #888;">
        <em>— ${senderName} via Project GIGI</em>
    </div>
</body>
</html>`;
}


