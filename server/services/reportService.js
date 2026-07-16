import User from "../models/User.js";
import KeywordTracking from "../models/keywordTracking.js";
import { sendPeriodicReportEmail } from "../utils/emailService.js";

/**
 * Runs the periodic report generator for all due users.
 */
export const sendDuePeriodicReports = async () => {
    console.log("📊 [REPORTS] Checking for due periodic reports...");
    try {
        const now = new Date();
        const users = await User.find({
            reportFrequency: { $in: ["weekly", "monthly"] },
            isVerified: true
        });

        let sentCount = 0;

        for (const user of users) {
            try {
                let frequency = user.reportFrequency;
                
                // Enforce plan limits: Free users cannot have monthly reports.
                // If they downgraded, automatically reset them to weekly.
                if (user.plan === "free" && frequency === "monthly") {
                    frequency = "weekly";
                    user.reportFrequency = "weekly";
                    await user.save();
                }

                const lastSent = user.lastReportSentDate;

                let isDue = false;
                let daysLimit = frequency === "monthly" ? 30 : 7;
                let periodName = "";

                if (!lastSent) {
                    isDue = true;
                } else {
                    const diffTime = Math.abs(now - new Date(lastSent));
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays >= daysLimit) {
                        isDue = true;
                    }
                }

                if (isDue) {
                    // Formatting period name nicely
                    const pastDate = new Date(now);
                    pastDate.setDate(now.getDate() - daysLimit);
                    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    periodName = `${formatter.format(pastDate)} - ${formatter.format(now)}`;

                    await generateAndSendUserReport(user, periodName, daysLimit);
                    
                    user.lastReportSentDate = now;
                    await user.save();
                    sentCount++;
                }
            } catch (userError) {
                console.error(`🚨 [REPORTS] Failed to generate/send report for user ${user._id} (${user.email}):`, userError);
            }
        }
        
        console.log(`✅ [REPORTS] Processed and sent ${sentCount} periodic reports.`);
    } catch (error) {
        console.error("🚨 [REPORTS] Critical error checking periodic reports:", error);
    }
};

const generateAndSendUserReport = async (user, periodName, daysLimit) => {
    const keywords = await KeywordTracking.find({ userId: user._id, active: true });
    
    if (keywords.length === 0) return; // No active keywords, nothing to report

    let totalKeywords = keywords.length;
    let totalChange = 0;
    let biggestGainValue = 0;
    let biggestGainKeyword = null;
    let biggestDropValue = 0;
    let biggestDropKeyword = null;

    const keywordDetails = [];
    const pastDateThreshold = new Date();
    pastDateThreshold.setDate(pastDateThreshold.getDate() - daysLimit);

    for (const kw of keywords) {
        let pastPosition = null;

        // Sort history by date descending just to be sure
        const history = [...kw.rankHistory].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Find the closest entry on or before the threshold
        for (const entry of history) {
            if (new Date(entry.date) <= pastDateThreshold) {
                pastPosition = entry.position;
                break;
            }
        }

        // If no entry found past the threshold, use the oldest available entry
        if (!pastPosition && history.length > 0) {
            pastPosition = history[history.length - 1].position;
        }

        // If still no history or current position, skip change calculation
        const currentPosition = kw.currentPosition;
        let change = 0;
        
        if (currentPosition && pastPosition) {
            change = pastPosition - currentPosition; // Positive means rank improved (smaller number)
            totalChange += change;

            if (change > biggestGainValue) {
                biggestGainValue = change;
                biggestGainKeyword = kw.keyword;
            }
            if (change < biggestDropValue) { // Negative change means rank dropped (larger number)
                biggestDropValue = change;
                biggestDropKeyword = kw.keyword;
            }
        }

        keywordDetails.push({
            keyword: kw.keyword,
            country: kw.country,
            currentPosition: currentPosition,
            change: change
        });
    }

    const avgChange = totalKeywords > 0 ? Math.round(totalChange / totalKeywords) : 0;

    const stats = {
        periodName,
        totalKeywords,
        avgChange,
        biggestGainKeyword,
        biggestGainValue,
        biggestDropKeyword,
        biggestDropValue: Math.abs(biggestDropValue)
    };

    await sendPeriodicReportEmail(user, stats, keywordDetails);
};
