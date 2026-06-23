import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";

const MAX_PAGES = 5;

// ─── إنشاء جلسة متصفح عبر Browserbase ────────────────────────────────────
export async function createBrowser() {
    const bb = new Browserbase({
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID
    });

    const session = await bb.sessions.create();
    console.log(`🌐 Browserbase session created: ${session.id}`);

    const browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0];
    const page = context.pages()[0];

    return { browser, page, sessionId: session.id };
}

// ─── إغلاق المتصفح ───────────────────────────────────────────────────────
export async function closeBrowser(browser, page) {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("🔒 Browser session closed.");
}

// ─── البحث في جوجل واستخراج النتائج الخام ─────────────────────────────────
export async function scrapeGoogle(page, keyword, country = "us") {
    // استخدم num=50 لجلب 50 نتيجة في صفحة واحدة لتجنب التنقل بين الصفحات وتوفير الوقت
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&gl=${country.toLowerCase()}&num=50`;

    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#search", { timeout: 10000 }).catch(() => null);

    // استخراج نتائج البحث العضوية من الصفحة
    const results = await page.evaluate(() => {
        const items = [];
        const searchResults = document.querySelectorAll("#search .g");

        searchResults.forEach((el) => {
            const linkEl = el.querySelector("a[href]");
            const snippetEl = el.querySelector("[data-sncf], .VwiC3b, .IsZvec");

            if (linkEl) {
                const url = linkEl.href;
                if (url && !url.includes("google.com/search") && url.startsWith("http")) {
                    items.push({
                        url,
                        snippet: snippetEl ? snippetEl.textContent.trim() : "",
                        page: Math.floor(items.length / 10) + 1, // محاكاة رقم الصفحة بناءً على الترتيب
                    });
                }
            }
        });

        return items;
    });

    // ترقيم النتائج
    return results.map((result, index) => ({
        ...result,
        position: index + 1,
    }));
}
