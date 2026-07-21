import axios from "axios";

const PAGESPEED_API_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

/**
 * Run Google PageSpeed Insights (Lighthouse) analysis on a URL.
 * Returns scores, Core Web Vitals metrics, and detailed audits.
 * 
 * @param {string} url - The URL to analyze
 * @param {string} strategy - "mobile" or "desktop" (default: "mobile")
 * @returns {object} Lighthouse results
 */
export async function runPageSpeedAnalysis(url, strategy = "mobile") {
    const apiKey = process.env.PAGESPEED_API_KEY;

    if (!apiKey) {
        console.warn("⚠️ PAGESPEED_API_KEY not set. Skipping Lighthouse analysis.");
        return null;
    }

    try {
        console.log(`🔍 Running PageSpeed Insights for: ${url} (${strategy})`);

        const response = await axios.get(PAGESPEED_API_URL, {
            params: {
                url,
                key: apiKey,
                strategy,
                category: ["performance", "accessibility", "best-practices", "seo"],
            },
            paramsSerializer: (params) => {
                const searchParams = new URLSearchParams();
                for (const [key, value] of Object.entries(params)) {
                    if (Array.isArray(value)) {
                        value.forEach(v => searchParams.append(key, v));
                    } else {
                        searchParams.append(key, value);
                    }
                }
                return searchParams.toString();
            },
            timeout: 120000, // 2 minutes timeout (Lighthouse can be slow)
        });

        const { lighthouseResult } = response.data;

        if (!lighthouseResult) {
            console.warn("⚠️ No lighthouseResult in PageSpeed API response");
            return null;
        }

        // Extract category scores (0-100)
        const categories = lighthouseResult.categories || {};
        const scores = {
            performance: categories.performance ? Math.round(categories.performance.score * 100) : null,
            accessibility: categories.accessibility ? Math.round(categories.accessibility.score * 100) : null,
            bestPractices: categories["best-practices"] ? Math.round(categories["best-practices"].score * 100) : null,
            seo: categories.seo ? Math.round(categories.seo.score * 100) : null,
        };

        // Extract Core Web Vitals metrics
        const audits = lighthouseResult.audits || {};
        const metrics = {
            fcp: audits["first-contentful-paint"]?.numericValue || null,
            lcp: audits["largest-contentful-paint"]?.numericValue || null,
            tbt: audits["total-blocking-time"]?.numericValue || null,
            cls: audits["cumulative-layout-shift"]?.numericValue || null,
            si: audits["speed-index"]?.numericValue || null,
            tti: audits["interactive"]?.numericValue || null,
        };

        // Extract detailed audits (passed, failed, manual)
        const detailedAudits = [];
        const auditRefs = [];

        // Collect all audit refs from all categories
        for (const cat of Object.values(categories)) {
            if (cat.auditRefs) {
                for (const ref of cat.auditRefs) {
                    auditRefs.push({
                        id: ref.id,
                        category: cat.id === "best-practices" ? "bestPractices" : cat.id,
                    });
                }
            }
        }

        // Deduplicate and map audits
        const seenAudits = new Set();
        for (const ref of auditRefs) {
            if (seenAudits.has(ref.id)) continue;
            seenAudits.add(ref.id);

            const audit = audits[ref.id];
            if (!audit) continue;

            // Skip audits that are not applicable or informative without score
            if (audit.scoreDisplayMode === "notApplicable") continue;

            detailedAudits.push({
                id: audit.id,
                title: audit.title || "",
                description: (audit.description || "").substring(0, 500), // Limit description length
                score: audit.score,
                scoreDisplayMode: audit.scoreDisplayMode || "binary",
                displayValue: audit.displayValue || "",
                category: ref.category,
            });
        }

        // Sort: failed first, then warnings, then passed
        detailedAudits.sort((a, b) => {
            if (a.score === null && b.score === null) return 0;
            if (a.score === null) return 1;
            if (b.score === null) return -1;
            return a.score - b.score;
        });

        console.log(`✅ PageSpeed Insights completed: P=${scores.performance} A=${scores.accessibility} BP=${scores.bestPractices} SEO=${scores.seo}`);

        return {
            ...scores,
            metrics,
            audits: detailedAudits,
        };

    } catch (error) {
        if (error.response) {
            console.error(`🚨 PageSpeed API Error (${error.response.status}):`, error.response.data?.error?.message || error.message);
        } else {
            console.error("🚨 PageSpeed API Error:", error.message);
        }
        return null;
    }
}
