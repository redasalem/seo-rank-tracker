import nodemailer from "nodemailer";

/**
 * Send an email using nodemailer.
 * Supports SMTP details from env.
 * If SMTP details are missing or send fails, it falls back to logging the email to console
 * so development/testing is not blocked.
 */
export const sendEmail = async ({ to, subject, html, text }) => {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpSender = process.env.SMTP_SENDER || '"Rank Pilot" <noreply@rankpilot.com>';

    console.log(`[Email Service] Attempting to send email to: ${to}`);

    // If SMTP credentials are not configured, log to console and return
    if (!smtpHost || !smtpUser || !smtpPass) {
        console.warn("[Email Service] SMTP configuration missing. Falling back to console logging.");
        console.log("----------------------------------------");
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body (Text): ${text}`);
        console.log(`Body (HTML): ${html}`);
        console.log("----------------------------------------");
        return { success: true, loggedToConsole: true };
    }

    try {
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: Number(smtpPort),
            secure: Number(smtpPort) === 465, // true for 465, false for other ports
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        });

        const info = await transporter.sendMail({
            from: smtpSender,
            to,
            subject,
            text,
            html,
        });

        console.log(`[Email Service] Email sent successfully: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("[Email Service] Error sending email via SMTP:", error);
        console.log("[Email Service] Fallback: Logging email details to console instead.");
        console.log("----------------------------------------");
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body (Text): ${text}`);
        console.log(`Body (HTML): ${html}`);
        console.log("----------------------------------------");
        return { success: true, loggedToConsole: true, error: error.message };
    }
};
