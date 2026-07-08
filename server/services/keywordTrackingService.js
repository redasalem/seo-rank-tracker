import KeywordTracking from "../models/keywordTracking.js";
import { createBrowser, closeBrowser, scrapeGoogle } from "./rankTrackerService.js";
import { createNotification } from "./notificationService.js";

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
async function processOneKeyword(page, tracking) {
    console.log(`🔍 Searching: "${tracking.keyword}" for ${tracking.domain}`);

    try {
        // 1. البحث في جوجل عبر الـ Scraper
        const results = await scrapeGoogle(page, tracking.keyword, tracking.country);
        console.log(`  📊 Scraper returned ${results.length} results for "${tracking.keyword}" (looking for: ${tracking.domain})`);

        if (results.length === 0) {
            throw new Error("No results returned - possible block");
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
    }
}

// ─── معالجة جميع الكلمات المعلقة ──────────────────────────────────────────
export async function processAllPendingKeywords() {
    console.log("⏰ Starting to process all pending keywords...");
    
    let processedCount = 0;
    let browser, page;
    let browserOpen = false;
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 45000; // 45 seconds max execution time for Vercel

    try {
        while (true) {
            // Check if we are approaching Vercel's timeout
            if (Date.now() - startTime >= MAX_EXECUTION_TIME) {
                console.log(`⏱️ Approaching Vercel execution limit. Stopping gracefully after processing ${processedCount} keywords.`);
                break;
            }

            const pendingKeywords = await KeywordTracking.find({
                status: "pending",
                active: true,
            }).limit(5); // Increased batch size since scraping is now faster

            if (pendingKeywords.length === 0) {
                console.log(`📭 No more pending keywords. Processed total: ${processedCount}`);
                break;
            }

            if (!browserOpen) {
                ({ browser, page } = await createBrowser());
                browserOpen = true;
            }

            for (const tracking of pendingKeywords) {
                // Double check inside the loop to avoid starting a slow keyword near the end
                if (Date.now() - startTime >= MAX_EXECUTION_TIME) {
                    console.log(`⏱️ Execution limit reached during batch processing.`);
                    break;
                }

                const SINGLE_KEYWORD_TIMEOUT = 45000; // 45 seconds
                await Promise.race([
                    processOneKeyword(page, tracking),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error("Keyword timeout")), SINGLE_KEYWORD_TIMEOUT)
                    )
                ]).catch(err => {
                    console.error(`🚨 Timeout for keyword ${tracking.keyword}:`, err.message);
                });
                processedCount++;
                // انتظار خفيف بين كل كلمة
                await page.waitForTimeout(1000 + Math.random() * 1000);
            }
        }
    } catch (error) {
        console.error("🚨 Session error:", error.message);
    } finally {
        if (browser && browserOpen) {
            await closeBrowser(browser, page);
        }
    }
}

// ─── معالجة كلمة مفتاحية واحدة بالـ ID (للتحديث اليدوي) ──────────────────
export async function processSingleKeyword(keywordId) {
    const tracking = await KeywordTracking.findById(keywordId);

    if (!tracking) {
        throw new Error("Keyword not found");
    }

    let browser, page;

    try {
        ({ browser, page } = await createBrowser());
        await processOneKeyword(page, tracking);
    } finally {
        if (browser) {
            await closeBrowser(browser, page);
        }
    }

    return tracking;
}
