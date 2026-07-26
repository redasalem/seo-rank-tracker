import { sendEmail } from "./emailService.js";

const escapeHtml = (str) => {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};

/**
 * 1. RANK CHANGE ALERT EMAIL
 */
export const sendRankChangeEmail = async (user, keyword, oldPos, newPos, changeType) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const keywordUrl = `${frontendUrl}/rank/${keyword._id}`;
    const isImproved = changeType === "improved";
    
    const subject = isImproved 
        ? `🚀 Your keyword "${keyword.keyword}" moved up!` 
        : `⚠️ Keyword "${keyword.keyword}" dropped!`;

    const statusBadgeColor = isImproved ? "#10b981" : "#ef4444";
    const statusText = isImproved ? "Rank Improved 🚀" : "Rank Dropped 📉";
    const positionDiff = Math.abs(oldPos - newPos);

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #3b82f6; margin-bottom: 5px; font-size: 24px;">RankBoost</h2>
                <p style="color: #6b7280; margin-top: 0; font-size: 14px;">Rank Change Notification</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            
            <h3 style="color: #1f2937;">Hi ${escapeHtml(user.name)},</h3>
            <p style="color: #4b5563; line-height: 1.5;">We detected a significant rank movement for one of your tracked keywords on <strong>${escapeHtml(keyword.domain)}</strong>.</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
                <div style="display: inline-block; padding: 4px 12px; background-color: ${statusBadgeColor}; color: #ffffff; font-weight: bold; border-radius: 20px; font-size: 12px; margin-bottom: 15px;">
                    ${statusText}
                </div>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 15px; color: #4b5563;">
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Keyword</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #1f2937;">${escapeHtml(keyword.keyword)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Previous Position</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">#${oldPos || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>New Position</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: ${statusBadgeColor};">#${newPos}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0;"><strong>Change</strong></td>
                        <td style="padding: 10px 0; text-align: right; font-weight: bold; color: ${statusBadgeColor};">${isImproved ? '+' : '-'}${positionDiff} positions</td>
                    </tr>
                </table>
            </div>

            <div style="text-align: center; margin: 35px 0;">
                <a href="${keywordUrl}" style="background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">View Details</a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                You are receiving this automated alert because your keyword rank moved by 5 or more positions.<br/>
                RankBoost — Track, Analyze, and Dominate SEO
            </p>
        </div>
    `;

    const text = `Hi ${user.name},\n\nKeyword "${keyword.keyword}" on ${keyword.domain} ${isImproved ? 'moved up' : 'dropped'} from #${oldPos} to #${newPos} (${isImproved ? '+' : '-'}${positionDiff} positions).\n\nView details: ${keywordUrl}`;

    return sendEmail({
        to: user.email,
        subject,
        text,
        html
    });
};

/**
 * 2. WEEKLY SUMMARY EMAIL
 */
export const sendWeeklySummaryEmail = async (user, stats) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const dashboardUrl = `${frontendUrl}/dashboard`;

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #3b82f6; margin-bottom: 5px; font-size: 24px;">RankBoost</h2>
                <p style="color: #6b7280; margin-top: 0; font-size: 14px;">Weekly Performance Summary</p>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            
            <h3 style="color: #1f2937;">Hi ${escapeHtml(user.name)},</h3>
            <p style="color: #4b5563; line-height: 1.5;">Here is your weekly rank tracking summary for the past 7 days:</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
                <table style="width: 100%; border-collapse: collapse; font-size: 15px; color: #4b5563;">
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Total Keywords Tracked</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #1f2937;">${stats.totalKeywords}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Keywords Improved 🚀</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #10b981;">+${stats.improvedCount}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Keywords Dropped 📉</strong></td>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #ef4444;">-${stats.droppedCount}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0;"><strong>Best Performing Keyword</strong></td>
                        <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #3b82f6;">${escapeHtml(stats.bestKeyword || 'N/A')}</td>
                    </tr>
                </table>
            </div>

            <div style="text-align: center; margin: 35px 0;">
                <a href="${dashboardUrl}" style="background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">View Full Report</a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                You are receiving this email as part of your weekly RankBoost summary subscription.<br/>
                RankBoost — Track, Analyze, and Dominate SEO
            </p>
        </div>
    `;

    const text = `Hi ${user.name},\n\nYour Weekly RankBoost Summary:\n- Total Keywords: ${stats.totalKeywords}\n- Improved: ${stats.improvedCount}\n- Dropped: ${stats.droppedCount}\n- Best Keyword: ${stats.bestKeyword || 'N/A'}\n\nView Full Report: ${dashboardUrl}`;

    return sendEmail({
        to: user.email,
        subject: "📊 Your Weekly RankBoost Summary",
        text,
        html
    });
};

/**
 * 3. INACTIVITY REMINDER EMAIL
 */
export const sendInactivityEmail = async (user, keywordCount) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const dashboardUrl = `${frontendUrl}/dashboard`;

    const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="color: #3b82f6; margin-bottom: 5px; font-size: 24px;">RankBoost</h2>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            
            <h3 style="color: #1f2937;">Hi ${escapeHtml(user.name)},</h3>
            <p style="color: #4b5563; line-height: 1.5;">We noticed you haven't checked your SEO rankings in a while!</p>
            <p style="color: #4b5563; line-height: 1.5;">You currently have <strong>${keywordCount} keywords</strong> actively being tracked. Check out your dashboard to see how your positions have changed and review new AI recommendations.</p>
            
            <div style="text-align: center; margin: 35px 0;">
                <a href="${dashboardUrl}" style="background-color: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">See My Rankings</a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                RankBoost — Track, Analyze, and Dominate SEO
            </p>
        </div>
    `;

    const text = `Hi ${user.name},\n\nYou have ${keywordCount} keywords being tracked. Check your latest rankings at ${dashboardUrl}`;

    return sendEmail({
        to: user.email,
        subject: "👋 You have rank updates waiting",
        text,
        html
    });
};
