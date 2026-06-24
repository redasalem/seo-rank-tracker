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
    
    // Set realistic Desktop User-Agent when creating the page
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    return { browser, page, sessionId: session.id };
}

// ─── إغلاق المتصفح ───────────────────────────────────────────────────────
export async function closeBrowser(browser, page) {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    console.log("🔒 Browser session closed.");
}

// ─── التعامل مع صفحة موافقة Google (EU Cookie Consent) ─────────────────────
async function handleGoogleConsent(page) {
    try {
        // Check for the EU consent dialog and click "Accept all" / "Reject all"
        const consentButton = await page.$('button[id="L2AGLb"], button[id="W0wltc"], [aria-label="Accept all"], [aria-label="Reject all"], button:has-text("Accept all"), button:has-text("Reject all"), button:has-text("Alle akzeptieren"), button:has-text("Tout accepter"), button:has-text("Aceptar todo")');
        if (consentButton) {
            await consentButton.click();
            console.log("  🍪 Google consent dialog dismissed.");
            await page.waitForTimeout(1000);
        }
    } catch (err) {
        // Consent dialog might not appear, that's fine
        console.log("  ℹ️ No consent dialog found or already dismissed.");
    }
}

// ─── البحث في جوجل واستخراج النتائج الخام ─────────────────────────────────
export async function scrapeGoogle(page, keyword, country = "us") {
    // استخدم num=50 لجلب 50 نتيجة في صفحة واحدة
    // أضف hl=en لفرض اللغة الإنجليزية و consent=2 لتجنب صفحة الموافقة
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}&gl=${country.toLowerCase()}&num=50&hl=en&consent=2`;

    console.log(`  🔗 Navigating to: ${searchUrl}`);
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // التعامل مع صفحة موافقة الـ Cookie (EU Consent)
    await handleGoogleConsent(page);

    // Wait for search results with multiple fallback selectors
    const searchSelector = await Promise.race([
        page.waitForSelector("#search", { timeout: 15000 }).then(() => "#search"),
        page.waitForSelector("#rso", { timeout: 15000 }).then(() => "#rso"),
        page.waitForSelector("[data-async-context]", { timeout: 15000 }).then(() => "[data-async-context]"),
    ]).catch(() => null);

    if (!searchSelector) {
        // Log page content for debugging when no results container found
        const pageTitle = await page.title().catch(() => "Unknown");
        const pageUrl = page.url();
        console.log(`  ⚠️ No search results container found. Page title: "${pageTitle}", URL: ${pageUrl}`);
        
        // Check if we hit a CAPTCHA
        const hasCaptcha = await page.$('iframe[src*="recaptcha"], #captcha-form, form[action*="sorry"]').catch(() => null);
        if (hasCaptcha) {
            console.log("  🚫 Google CAPTCHA detected! The IP might be blocked.");
        }
        
        throw new Error("Google CAPTCHA or block detected");
    }

    console.log(`  ✅ Search results container found: ${searchSelector}`);

    // استخراج نتائج البحث العضوية من الصفحة - استخدام selectors متعددة
    const results = await page.evaluate(() => {
        const items = [];
        
        // 1. Check for Rich Snippets and Profile Cards
        const featuredSelectors = [
            ".kp-blk a[href]",
            ".xpdopen a[href]",
            "[data-attrid] a[href]",
            ".ULSxyf a[href]",
            "g-card a[href]"
        ];
        
        for (const selector of featuredSelectors) {
            const links = document.querySelectorAll(selector);
            links.forEach((linkEl) => {
                const url = linkEl.href;
                if (url && !url.includes("google.com/search") && !url.includes("google.com/url") && url.startsWith("http")) {
                    items.push({
                        url,
                        snippet: "Featured/Profile Card Result",
                        page: 1,
                        isFeatured: true
                    });
                }
            });
        }
        
        // Try multiple selectors for Google's organic results (Google changes HTML frequently)
        const selectors = [
            "#search .g",           // Traditional selector
            "#rso .g",              // Alternative container
            "#search [data-hveid] a[href]:not([href*='google.com'])",  // Data attribute based
            ".MjjYud .g",          // Newer Google layout
        ];
        
        let searchResults = null;
        for (const selector of selectors) {
            const found = document.querySelectorAll(selector);
            if (found.length > 0) {
                searchResults = found;
                break;
            }
        }
        
        if (!searchResults || searchResults.length === 0) {
            // Fallback: try to find any link within the main results area
            const allLinks = document.querySelectorAll("#search a[href], #rso a[href], #center_col a[href]");
            const seenUrls = new Set();
            
            allLinks.forEach((linkEl) => {
                const url = linkEl.href;
                if (url && 
                    !url.includes("google.com") && 
                    !url.includes("googleapis.com") &&
                    !url.includes("gstatic.com") &&
                    url.startsWith("http") &&
                    !seenUrls.has(url)) {
                    seenUrls.add(url);
                    // Try to find parent element for snippet
                    const parentG = linkEl.closest(".g, .MjjYud, [data-hveid]");
                    const snippetEl = parentG ? parentG.querySelector("[data-sncf], .VwiC3b, .IsZvec, .lEBKkf, span:not([class])") : null;
                    items.push({
                        url,
                        snippet: snippetEl ? snippetEl.textContent.trim() : "",
                        page: Math.floor(items.length / 10) + 1,
                    });
                }
            });
            
            return items;
        }

        searchResults.forEach((el) => {
            const linkEl = el.querySelector("a[href]");
            const snippetEl = el.querySelector("[data-sncf], .VwiC3b, .IsZvec, .lEBKkf");

            if (linkEl) {
                const url = linkEl.href;
                if (url && !url.includes("google.com/search") && !url.includes("google.com/url") && url.startsWith("http")) {
                    items.push({
                        url,
                        snippet: snippetEl ? snippetEl.textContent.trim() : "",
                        page: Math.floor(items.length / 10) + 1,
                    });
                }
            }
        });

        return items;
    });

    console.log(`  📊 Found ${results.length} organic results`);

    // ترقيم النتائج
    let organicPosition = 1;
    return results.map((result) => {
        if (result.isFeatured) {
            return { ...result, position: 1 };
        }
        return {
            ...result,
            position: organicPosition++,
        };
    });
}
