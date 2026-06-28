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
    const smtpSender = process.env.SMTP_SENDER || '"RankBoost" <noreply@rankboost.com>';

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

/**
 * Send a clean, professional invoice email after successful payment.
 */
export const sendInvoiceEmail = async (email, name, amount, date, plan) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const dashboardUrl = `${frontendUrl}/dashboard`;

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #1f2937; margin-bottom: 5px;">RankBoost</h2>
                <p style="color: #6b7280; margin-top: 0; font-size: 14px;">Track, Analyze, and Dominate SEO</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            
            <h3 style="color: #1f2937;">Hi ${name},</h3>
            <p style="color: #4b5563; line-height: 1.5;">Thank you for your purchase! Your subscription to RankBoost Pro is now active and ready to use.</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
                <h4 style="margin-top: 0; margin-bottom: 15px; color: #374151; font-size: 16px;">Invoice Details</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 15px; color: #4b5563;">
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Plan</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${plan}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Amount</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${amount}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Date</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${date}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; padding-top: 15px;"><strong>Status</strong></td>
                        <td style="padding: 10px 0; padding-top: 15px; text-align: right; color: #10b981; font-weight: bold;">Paid ✓</td>
                    </tr>
                </table>
            </div>

            <div style="text-align: center; margin: 35px 0;">
                <a href="${dashboardUrl}" style="background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">Go to Dashboard</a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you have any questions or need support, simply reply to this email.</p>
        </div>
    `;

    return sendEmail({
        to: email,
        subject: "Your RankBoost Pro subscription is confirmed 🎉",
        text: `Hi ${name}, thank you for your purchase! Your invoice for ${plan} (${amount}) on ${date} is Paid. Go to ${dashboardUrl} to start using RankBoost Pro.`,
        html
    });
};
