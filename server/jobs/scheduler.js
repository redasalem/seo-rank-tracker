import cron from "node-cron";
import KeywordTracking from "../models/keywordTracking.js";
import { processAllPendingKeywords } from "../services/keywordTrackingService.js";
import { sendDuePeriodicReports } from "../services/reportService.js";
import { sendWeeklyEmails } from "./weeklyEmailJob.js";
import { sendInactivityEmails } from "./inactivityJob.js";

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

    // ─── إرسال التقارير الدورية عبر البريد ──────────────────────────────────
    // يعمل كل يوم الساعة 8 صباحاً بتوقيت الخادم (UTC)
    cron.schedule("0 8 * * *", async () => {
        console.log("⏰ [CRON] Periodic email reports started...");
        await sendDuePeriodicReports();
        console.log("✅ [CRON] Periodic email reports completed!");
    });

    console.log("🕐 Cron job scheduled: Periodic email reports at 8:00 AM");

    // ─── إرسال الملخص الأسبوعي ──────────────────────────────────────────────
    // يعمل كل يوم أحد الساعة 8 صباحاً بتوقيت الخادم (UTC)
    cron.schedule("0 8 * * 0", async () => {
        console.log("⏰ [CRON] Weekly summary emails started...");
        await sendWeeklyEmails();
        console.log("✅ [CRON] Weekly summary emails completed!");
    });

    console.log("🕐 Cron job scheduled: Weekly summary emails at 8:00 AM on Sundays");

    // ─── فحص المستخدمين الخاملين ────────────────────────────────────────────
    // يعمل كل يوم الساعة 10 صباحاً بتوقيت الخادم (UTC)
    cron.schedule("0 10 * * *", async () => {
        console.log("⏰ [CRON] Inactivity check started...");
        await sendInactivityEmails();
        console.log("✅ [CRON] Inactivity check completed!");
    });

    console.log("🕐 Cron job scheduled: Inactivity check at 10:00 AM daily");
}
