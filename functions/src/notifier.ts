// functions/src/notifier.ts
// [ZEN] Email Notification Module — Nodemailer + Gmail App Password
// Portable across the Gigi-verse: copy this file, install nodemailer, reuse the same App Password.

import * as nodemailer from "nodemailer";

// --- TRANSPORTER SETUP ---
// Firebase Functions v2 loads functions/.env automatically at deploy time.
// Required env vars: GMAIL_USER, GMAIL_APP_PASSWORD
// --- TRANSPORTER SETUP ---
// Priority 1: SMTP Relay (Brevo/SendGrid) for Sovereign domains
// Priority 2: Gmail (Personal account) fallback
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, 
    auth: {
        user: process.env.SMTP_USER || process.env.GMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD,
    },
});

// --- PUBLIC API ---

export interface EmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    inReplyTo?: string;   // For email threading
    references?: string;  // For email threading
}

/**
 * Send an email via the configured Gmail transporter.
 * Usable from any Cloud Function, trigger, or scheduled job.
 *
 * @example
 * import { sendEmail } from "./notifier";
 * await sendEmail({
 *   to: "dysus2024@gmail.com",
 *   subject: "🌅 Zen Daily Digest",
 *   html: "<h2>Good morning, Eric.</h2>"
 * });
 */
export async function sendEmail(options: EmailOptions) {
    const from = `"Brita — Project GIGI" <${process.env.GMAIL_USER}>`;

    const mailOptions = {
        from,
        ...options,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 [ZEN NOTIFIER] Email sent: ${info.messageId} → ${options.to}`);
    return info;
}
