const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false, 
    auth: {
        user: process.env.SMTP_USER || process.env.GMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD,
    },
});

async function main() {
    try {
        console.log("Testing Brevo connection...");
        const info = await transporter.sendMail({
            from: `"Brita — Project GIGI" <${process.env.GMAIL_USER}>`,
            to: "dysus2024@gmail.com",
            subject: "Test from Brevo",
            text: "This is a test email sent from Brevo via nodemailer."
        });
        console.log("Success! Message ID:", info.messageId);
    } catch (err) {
        console.error("Failed to send email:", err);
    }
}

main();
