import User from "../models/User.js";
import KeywordTracking from "../models/keywordTracking.js";
import { sendInactivityEmail } from "../utils/emailTemplates.js";

/**
 * Daily job to check for paying users inactive for 7+ days with active keywords.
 * Runs every day at 10AM UTC via cron.
 */
export async function sendInactivityEmails() {
    console.log("⏰ [CRON] Starting inactivity reminder email job...");
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Find paying users (Pro or Max) who haven't logged in for 7+ days
        const inactiveUsers = await User.find({
            lastLoginAt: { $lt: sevenDaysAgo },
            plan: { $ne: "free" },
            isBanned: false
        });

        if (!inactiveUsers || inactiveUsers.length === 0) {
            console.log("📭 [CRON] No inactive paying users found.");
            return;
        }

        for (const user of inactiveUsers) {
            try {
                const keywordCount = await KeywordTracking.countDocuments({ userId: user._id, active: true });
                if (keywordCount === 0) continue;

                sendInactivityEmail(user, keywordCount).catch(err => {
                    console.error(`🚨 [CRON] Failed to send inactivity email to ${user.email}:`, err.message);
                });
            } catch (userErr) {
                console.error(`🚨 [CRON] Error checking inactivity for user ${user._id}:`, userErr.message);
            }
        }
        console.log("✅ [CRON] Inactivity reminder email job finished.");
    } catch (error) {
        console.error("🚨 [CRON] Failed to run inactivity email job:", error.message);
    }
}
