import cron from "node-cron";
import KeywordTracking from "../models/keywordTracking.js";
import { processAllPendingKeywords } from "../services/keywordTrackingService.js";

// ─── تحديث يومي لجميع الكلمات المفتاحية ──────────────────────────────────
// يعمل كل يوم الساعة 3 الفجر (وقت قليل الضغط على السيرفر)
// الصيغة: دقيقة ساعة يوم شهر يوم_الأسبوع
// "0 3 * * *" = الساعة 3:00 صباحاً كل يوم

export function startCronJobs() {
    cron.schedule("0 3 * * *", async () => {
        console.log("⏰ [CRON] Daily rank update started...");

        try {
            // 1. تغيير حالة جميع الكلمات النشطة إلى "pending"
            const result = await KeywordTracking.updateMany(
                { active: true, status: "success" },
                { status: "pending" }
            );

            console.log(`📋 [CRON] ${result.modifiedCount} keyword(s) set to pending`);

            // 2. معالجة جميع الكلمات المعلقة
            await processAllPendingKeywords();

            console.log("✅ [CRON] Daily rank update completed!");
        } catch (error) {
            console.error("🚨 [CRON] Daily update failed:", error.message);
        }
    });

    console.log("🕐 Cron job scheduled: Daily rank update at 3:00 AM");
}
