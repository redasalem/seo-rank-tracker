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

/**
 * Send email verification link
 */


/**
 * Send email verification link
 */
export const sendVerificationEmail = async (email, name, token) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const verifyUrl = `${frontendUrl}/verify-email/${token}`;

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #6366f1; margin-bottom: 5px;">RankBoost</h2>
            </div>
            
            <h3 style="color: #1f2937;">Hi ${name},</h3>
            <p style="color: #4b5563; line-height: 1.5;">Welcome to RankBoost! Please confirm your email address by clicking the button below.</p>
            
            <div style="text-align: center; margin: 35px 0;">
                <a href="${verifyUrl}" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">Verify Email</a>
            </div>
            
            <p style="color: #6b7280; font-size: 13px;">If you didn't create an account, you can safely ignore this email.</p>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 11px; text-align: center;">RankBoost - Track, Analyze, and Dominate SEO</p>
        </div>
    `;

    return sendEmail({
        to: email,
        subject: "Confirm your RankBoost email address",
        text: `Hi ${name}, please verify your email address by visiting this link: ${verifyUrl}`,
        html
    });
};

/**
 * Send periodic ranking report email
 */
const emailTranslations = {
    en: {
        subjectWeekly: "Your RankBoost Weekly Report 🚀",
        subjectMonthly: "Your RankBoost Monthly Report 🚀",
        plainText: (name, period, total, url) => `Hi ${name}, your ranking summary for ${period} is ready. Tracked keywords: ${total}. Go to ${url} for the full breakdown.`,
        subtitleWeekly: "Your Weekly SEO Performance Report",
        subtitleMonthly: "Your Monthly SEO Performance Report",
        greeting: (name) => `Hi ${name},`,
        summaryText: "Here is your ranking summary for the period:",
        trackedKeywords: "Tracked Keywords",
        avgRankChange: "Avg Rank Change",
        biggestGain: "Biggest Gain",
        biggestDrop: "Biggest Drop",
        keywordBreakdown: "Keyword Breakdown",
        keyword: "Keyword",
        rank: "Rank",
        change: "Change",
        upgradeTitle: "Want the full keyword breakdown?",
        upgradeDesc: "Upgrade to Pro to see exactly which keywords moved up or down.",
        upgradeBtn: "Upgrade to Pro",
        viewDashboard: "View Dashboard",
        footerReason: (freq) => `You are receiving this because your report frequency is set to ${freq}.`,
        managePreferences: "Manage your email preferences"
    },
    ar: {
        subjectWeekly: "تقريرك الأسبوعي من RankBoost 🚀",
        subjectMonthly: "تقريرك الشهري من RankBoost 🚀",
        plainText: (name, period, total, url) => `مرحباً ${name}، ملخص ترتيبك للفترة ${period} جاهز. الكلمات المتبعة: ${total}. اذهب إلى ${url} للتفاصيل الكاملة.`,
        subtitleWeekly: "تقرير أداء SEO الأسبوعي الخاص بك",
        subtitleMonthly: "تقرير أداء SEO الشهري الخاص بك",
        greeting: (name) => `مرحباً ${name}،`,
        summaryText: "إليك ملخص ترتيبك للفترة:",
        trackedKeywords: "الكلمات المتتبعة",
        avgRankChange: "متوسط التغير في الترتيب",
        biggestGain: "أكبر تقدم",
        biggestDrop: "أكبر تراجع",
        keywordBreakdown: "تفاصيل الكلمات المفتاحية",
        keyword: "الكلمة المفتاحية",
        rank: "الترتيب",
        change: "التغير",
        upgradeTitle: "هل تريد رؤية تفاصيل الكلمات المفتاحية؟",
        upgradeDesc: "قم بالترقية إلى Pro لرؤية الكلمات التي تقدمت أو تراجعت بالضبط.",
        upgradeBtn: "الترقية إلى Pro",
        viewDashboard: "عرض لوحة التحكم",
        footerReason: (freq) => `أنت تتلقى هذه الرسالة لأنك اخترت استلام التقارير بشكل ${freq === 'weekly' ? 'أسبوعي' : 'شهري'}.`,
        managePreferences: "إدارة تفضيلات البريد الإلكتروني الخاص بك"
    }
};

export const sendPeriodicReportEmail = async (user, stats, keywordDetails = []) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const settingsUrl = `${frontendUrl}/settings`;
    const dashboardUrl = `${frontendUrl}/dashboard`;
    const isPro = user.plan !== "free";
    
    const escapeHtml = (str) => {
        if (!str) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };

    const lang = user.language || "en";
    const t = emailTranslations[lang] || emailTranslations.en;
    const isRTL = lang === "ar";
    const dir = isRTL ? "rtl" : "ltr";
    const fontFamily = isRTL
        ? "'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif"
        : "'Inter', 'Segoe UI', Roboto, sans-serif";
    
    let keywordTableHtml = "";
    
    if (isPro && keywordDetails.length > 0) {
        keywordTableHtml = `
            <div style="margin-top: 30px;">
                <h4 style="color: #374151; font-size: 16px; margin-bottom: 10px;">${t.keywordBreakdown}</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; text-align: ${isRTL ? 'right' : 'left'};">
                    <thead>
                        <tr style="background-color: #f3f4f6; color: #4b5563;">
                            <th style="padding: 10px; border-bottom: 2px solid #e5e7eb;">${t.keyword}</th>
                            <th style="padding: 10px; border-bottom: 2px solid #e5e7eb;">${t.rank}</th>
                            <th style="padding: 10px; border-bottom: 2px solid #e5e7eb;">${t.change}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${keywordDetails.map(k => `
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><bdi dir="auto">${escapeHtml(k.keyword)}</bdi> <span style="font-size: 11px; color: #9ca3af;">(${escapeHtml(k.country)})</span></td>
                                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${k.currentPosition || '-'}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: ${k.change > 0 ? '#10b981' : k.change < 0 ? '#ef4444' : '#6b7280'};">
                                    <span dir="ltr" style="display:inline-block;">${k.change > 0 ? '↑' : k.change < 0 ? '↓' : '-'} ${k.change !== 0 ? Math.abs(k.change) : ''}</span>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;
    } else if (!isPro) {
        keywordTableHtml = `
            <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #fef2f2; border: 1px dashed #fca5a5; border-radius: 8px;">
                <h4 style="color: #dc2626; margin-top: 0; margin-bottom: 10px;">${t.upgradeTitle}</h4>
                <p style="color: #7f1d1d; font-size: 14px; margin-bottom: 15px;">${t.upgradeDesc}</p>
                <a href="${dashboardUrl}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 14px;">${t.upgradeBtn}</a>
            </div>
        `;
    }

    const html = `
        <div style="font-family: ${fontFamily}; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;" dir="${dir}">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #6366f1; margin-bottom: 5px;">RankBoost</h2>
                <p style="color: #6b7280; margin-top: 0; font-size: 14px;">${user.reportFrequency === 'monthly' ? t.subtitleMonthly : t.subtitleWeekly}</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            
            <h3 style="color: #1f2937;">${t.greeting(escapeHtml(user.name))}</h3>
            <p style="color: #4b5563; line-height: 1.5;">${t.summaryText} <strong><bdi dir="auto">${escapeHtml(stats.periodName)}</bdi></strong>.</p>
            
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 25px;">
                <div style="flex: 1; min-width: 120px; background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #1f2937;">${stats.totalKeywords}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">${t.trackedKeywords}</div>
                </div>
                <div style="flex: 1; min-width: 120px; background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: ${stats.avgChange > 0 ? '#10b981' : stats.avgChange < 0 ? '#ef4444' : '#1f2937'};">
                        <span dir="ltr">${stats.avgChange > 0 ? '+' : ''}${stats.avgChange}</span>
                    </div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 5px;">${t.avgRankChange}</div>
                </div>
            </div>
            
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                <div style="flex: 1; min-width: 120px; background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: #059669;"><bdi dir="auto">${escapeHtml(stats.biggestGainKeyword || 'N/A')}</bdi></div>
                    <div style="font-size: 12px; color: #10b981; margin-top: 5px;">${t.biggestGain} (<span dir="ltr">+${stats.biggestGainValue || 0}</span>)</div>
                </div>
                <div style="flex: 1; min-width: 120px; background-color: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 16px; font-weight: bold; color: #b91c1c;"><bdi dir="auto">${escapeHtml(stats.biggestDropKeyword || 'N/A')}</bdi></div>
                    <div style="font-size: 12px; color: #ef4444; margin-top: 5px;">${t.biggestDrop} (<span dir="ltr">-${stats.biggestDropValue || 0}</span>)</div>
                </div>
            </div>

            ${keywordTableHtml}
            
            <div style="text-align: center; margin: 35px 0;">
                <a href="${dashboardUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px;">${t.viewDashboard}</a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 11px; text-align: center;">
                ${t.footerReason(user.reportFrequency)}<br/>
                <a href="${settingsUrl}" style="color: #6366f1; text-decoration: underline;">${t.managePreferences}</a>
            </p>
        </div>
    `;

    return sendEmail({
        to: user.email,
        subject: user.reportFrequency === 'monthly' ? t.subjectMonthly : t.subjectWeekly,
        text: t.plainText(user.name, stats.periodName, stats.totalKeywords, dashboardUrl),
        html
    });
};

/**
 * Send Magic Link for Registration
 */
export const sendMagicLinkEmail = async (email, token) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const magicUrl = \`\${frontendUrl}/register/complete?token=\${token}\`;

    const html = \`
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #6366f1; margin-bottom: 5px;">RankBoost</h2>
            </div>
            
            <h3 style="color: #1f2937;">Complete Your Registration</h3>
            <p style="color: #4b5563; line-height: 1.5;">You're almost there! Click the button below to verify your email and complete your RankBoost registration.</p>
            
            <div style="text-align: center; margin: 35px 0;">
                <a href="\${magicUrl}" style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">Verify & Complete Registration</a>
            </div>
            
            <p style="color: #6b7280; font-size: 13px;">This link is valid for 1 hour. If you didn't request this, you can safely ignore this email.</p>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 11px; text-align: center;">RankBoost - Track, Analyze, and Dominate SEO</p>
        </div>
    \`;

    return sendEmail({
        to: email,
        subject: "Complete your RankBoost Registration",
        text: \`Please verify your email and complete registration by visiting this link: \${magicUrl}\`,
        html
    });
};
