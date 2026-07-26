import KeywordTracking from "../models/keywordTracking.js";
import User from "../models/User.js";
import { searchGoogle } from "./rankTrackerService.js";
import { createNotification } from "./notificationService.js";
import { sendRankChangeEmail } from "../utils/emailTemplates.js";

// ─── تحليل النتائج: إيجاد موقع المستخدم + المنافسين ──────────────────────
function analyzeResults(results, targetDomain) {
    const cleanDomain = targetDomain.replace(/^www\./, "").toLowerCase();

    // البحث عن موقع المستخدم في النتائج
    const found = results.find((r) => {
        try {
            const resultDomain = new URL(r.url).hostname.replace(/^www\./, "").toLowerCase();
            return resultDomain === cleanDomain;
        } catch {
            return false;
        }
    });

    // جمع أول 10 منافسين (بدون موقع المستخدم)
    const competitors = results
        .filter((r) => {
            try {
                const resultDomain = new URL(r.url).hostname.replace(/^www\./, "").toLowerCase();
                return resultDomain !== cleanDomain;
            } catch {
                return false;
            }
        })
        .slice(0, 10)
        .map((r) => ({
            domain: new URL(r.url).hostname.replace(/^www\./, ""),
            position: r.position,
            url: r.url,
            snippet: r.snippet,
        }));

    return { found, competitors };
}

// ─── تحديث بيانات كلمة مفتاحية واحدة في الداتابيز ────────────────────────
function updateKeywordData(tracking, found, competitors) {
    const oldPosition = tracking.currentPosition;
    let rankAlert = null;

    if (found) {
        tracking.currentPosition = found.position;
        tracking.currentPage = found.page;
        tracking.positionChange = oldPosition ? oldPosition - found.position : 0;

        if (oldPosition && tracking.positionChange > 0) {
            rankAlert = { type: "success", change: tracking.positionChange, newPos: found.position };
        } else if (oldPosition && tracking.positionChange < 0) {
            rankAlert = { type: "warning", change: tracking.positionChange, newPos: found.position };
        } else if (!oldPosition && found.position) {
            rankAlert = { type: "info", isNew: true, newPos: found.position };
        }

        // تحديث أفضل ترتيب
        if (!tracking.bestPosition || found.position < tracking.bestPosition) {
            tracking.bestPosition = found.position;
        }

        // إضافة سجل جديد للتاريخ
        tracking.rankHistory.push({
            position: found.position,
            page: found.page,
            url: found.url,
            snippet: found.snippet,
        });

        // Cap rankHistory to last 90 entries to prevent document bloat
        if (tracking.rankHistory.length > 90) {
            tracking.rankHistory = tracking.rankHistory.slice(-90);
        }
    } else {
        tracking.currentPosition = null;
        tracking.currentPage = null;
        tracking.positionChange = oldPosition ? -oldPosition : 0;

        if (oldPosition) {
            rankAlert = { type: "warning", isDropped: true, oldPos: oldPosition };
        }
    }

    tracking.competitors = competitors;
    tracking.status = "success";
    return rankAlert;
}

// ─── معالجة كلمة مفتاحية واحدة ────────────────────────────────────────────
async function processOneKeyword(tracking) {
    console.log(`🔍 Searching: "${tracking.keyword}" for ${tracking.domain}`);

    try {
        // 1. البحث في جوجل عبر SerpApi
        const results = await searchGoogle(tracking.keyword, tracking.country);
        console.log(`  📊 SerpApi returned ${results.length} results for "${tracking.keyword}" (looking for: ${tracking.domain})`);

        if (results.length === 0) {
            throw new Error("No results returned from SerpApi");
        }

        // 2. تحليل النتائج
        const { found, competitors } = analyzeResults(results, tracking.domain);

        // 3. تحديث البيانات وإرسال التنبيه
        const rankAlert = updateKeywordData(tracking, found, competitors);
        await tracking.save();

        if (rankAlert && tracking.userId) {
            let title = "";
            let messageKey = "";
            let messageData = {};
            
            if (rankAlert.isNew) {
                title = "New Ranking!";
                messageKey = "notifications.rank_new";
                messageData = { keyword: tracking.keyword, domain: tracking.domain, newPos: rankAlert.newPos };
            } else if (rankAlert.isDropped) {
                title = "Rank Dropped Out! 📉";
                messageKey = "notifications.rank_dropped_out";
                messageData = { keyword: tracking.keyword, domain: tracking.domain, oldPos: rankAlert.oldPos };
            } else if (rankAlert.type === "success") {
                title = "Rank Improved! 🚀";
                messageKey = "notifications.rank_improved";
                messageData = { keyword: tracking.keyword, change: rankAlert.change, newPos: rankAlert.newPos };
            } else {
                title = "Rank Dropped 📉";
                messageKey = "notifications.rank_dropped";
                messageData = { keyword: tracking.keyword, change: Math.abs(rankAlert.change), newPos: rankAlert.newPos };
            }

            await createNotification({ 
                userId: tracking.userId, 
                title, 
                message: { key: messageKey, data: messageData },
                type: rankAlert.type,
                link: `/rank/${tracking._id}` 
            });

            // Trigger rank change email if keyword moved 5+ positions
            const changeAmount = tracking.positionChange;
            if (changeAmount >= 5 || changeAmount <= -5) {
                const changeType = changeAmount >= 5 ? "improved" : "dropped";
                const oldPos = rankAlert.oldPos || (found ? found.position + changeAmount : Math.abs(changeAmount));
                const newPos = found ? found.position : 0;

                User.findById(tracking.userId).then(user => {
                    if (user && user.email) {
                        sendRankChangeEmail(user, tracking, oldPos, newPos, changeType).catch(err => {
                            console.error("Failed to send rank change email:", err.message);
                        });
                    }
                }).catch(err => console.error("Error fetching user for rank change email:", err.message));
            }
        }

        if (found) {
            console.log(`  ✅ Found "${tracking.domain}" at #${found.position} (page ${found.page})`);
        } else {
            console.log(`  ❌ "${tracking.domain}" not found in top ${results.length} results`);
            if (results.length > 0) {
                console.log(`  📋 Top 3 results: ${results.slice(0, 3).map(r => r.url).join(", ")}`);
            }
        }
    } catch (error) {
        console.error(`  ⚠️ Error: "${tracking.keyword}":`, error.message);
        tracking.status = "failed";
        await tracking.save();
        throw error;
    }
}

// ─── معالجة جميع الكلمات المعلقة ──────────────────────────────────────────
export async function processAllPendingKeywords() {
    console.log("⏰ Starting to process all pending keywords...");
    
    let processedCount = 0;
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 50000; // 50 seconds (SerpApi is much faster, no browser overhead)

    try {
        while (true) {
            // Check if we are approaching Vercel's timeout
            if (Date.now() - startTime >= MAX_EXECUTION_TIME) {
                console.log(`⏱️ Approaching execution limit. Stopping gracefully after processing ${processedCount} keywords.`);
                break;
            }

            const pendingKeywords = await KeywordTracking.find({
                status: "pending",
                active: true,
            }).limit(10); // Larger batch since SerpApi is fast

            if (pendingKeywords.length === 0) {
                console.log(`📭 No more pending keywords. Processed total: ${processedCount}`);
                break;
            }

            for (const tracking of pendingKeywords) {
                if (Date.now() - startTime >= MAX_EXECUTION_TIME) {
                    console.log(`⏱️ Execution limit reached during batch processing.`);
                    break;
                }

                const SINGLE_KEYWORD_TIMEOUT = 30000; // 30 seconds per keyword
                await Promise.race([
                    processOneKeyword(tracking),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("Keyword timeout")), SINGLE_KEYWORD_TIMEOUT)
                    )
                ]).catch(err => {
                    console.error(`🚨 Failed for keyword ${tracking.keyword}:`, err.message);
                });
                processedCount++;

                // Small delay between API calls to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    } catch (error) {
        console.error("🚨 Processing error:", error.message);
    }
}

// ─── معالجة كلمة مفتاحية واحدة بالـ ID (للتحديث اليدوي) ──────────────────
export async function processSingleKeyword(keywordId) {
    const tracking = await KeywordTracking.findById(keywordId);

    if (!tracking) {
        throw new Error("Keyword not found");
    }

    await processOneKeyword(tracking);

    return tracking;
}
