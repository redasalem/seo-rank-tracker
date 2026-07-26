import User from "../models/User.js";
import KeywordTracking from "../models/keywordTracking.js";
import { sendWeeklySummaryEmail } from "../utils/emailTemplates.js";

/**
 * Weekly job to send rank performance summary emails to users with active keywords.
 * Runs every Sunday at 8AM UTC via cron.
 */
export async function sendWeeklyEmails() {
    console.log("⏰ [CRON] Starting weekly summary email job...");
    try {
        const activeUserIds = await KeywordTracking.distinct("userId", { active: true });

        if (!activeUserIds || activeUserIds.length === 0) {
            console.log("📭 [CRON] No active users with tracked keywords for weekly email.");
            return;
        }

        for (const userId of activeUserIds) {
            try {
                const user = await User.findById(userId);
                if (!user || !user.email || user.isBanned) continue;

                const keywords = await KeywordTracking.find({ userId, active: true });
                if (keywords.length === 0) continue;

                let improvedCount = 0;
                let droppedCount = 0;
                let bestKeyword = null;
                let bestPos = Infinity;

                for (const k of keywords) {
                    if (k.positionChange > 0) improvedCount++;
                    else if (k.positionChange < 0) droppedCount++;

                    if (k.currentPosition && k.currentPosition < bestPos) {
                        bestPos = k.currentPosition;
                        bestKeyword = `${k.keyword} (#${k.currentPosition})`;
                    }
                }

                const stats = {
                    totalKeywords: keywords.length,
                    improvedCount,
                    droppedCount,
                    bestKeyword: bestKeyword || "N/A"
                };

                sendWeeklySummaryEmail(user, stats).catch(err => {
                    console.error(`🚨 [CRON] Failed to send weekly email to ${user.email}:`, err.message);
                });
            } catch (userErr) {
                console.error(`🚨 [CRON] Error processing weekly email for user ${userId}:`, userErr.message);
            }
        }
        console.log("✅ [CRON] Weekly summary email job finished.");
    } catch (error) {
        console.error("🚨 [CRON] Failed to run weekly email job:", error.message);
    }
}
