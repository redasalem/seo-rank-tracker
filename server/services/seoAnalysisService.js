import { chromium } from "playwright-core";
import Browserbase from "@browserbasehq/sdk";
import Analysis from "../models/analysisModel.js";
import https from "https";
import axios from "axios";

// ─── فحص شهادة الأمان (SSL) ────────────────────────────────────────────────
async function checkSSL(url) {
    return new Promise((resolve) => {
        try {
            const urlObj = new URL(url);
            if (urlObj.protocol !== 'https:') {
                return resolve({ hasSSL: false, sslIssuer: "", sslValidTo: null });
            }

            const options = {
                hostname: urlObj.hostname,
                port: 443,
                method: 'GET',
                rejectUnauthorized: false
            };

            const req = https.request(options, (res) => {
                const cert = res.socket.getPeerCertificate();
                if (cert && Object.keys(cert).length > 0) {
                    const validTo = new Date(cert.valid_to);
                    const isValid = validTo > new Date() && !res.socket.authorizationError;
                    resolve({
                        hasSSL: isValid,
                        sslIssuer: cert.issuer?.O || cert.issuer?.CN || "Unknown",
                        sslValidTo: validTo
                    });
                } else {
                    resolve({ hasSSL: false, sslIssuer: "", sslValidTo: null });
                }
            });

            req.on('error', () => resolve({ hasSSL: false, sslIssuer: "", sslValidTo: null }));
            req.setTimeout(5000, () => {
                req.destroy();
                resolve({ hasSSL: false, sslIssuer: "", sslValidTo: null });
            });
            req.end();
        } catch (e) {
            resolve({ hasSSL: false, sslIssuer: "", sslValidTo: null });
        }
    });
}

// ─── فحص ملفات الزحف ───────────────────────────────────────────────────────
async function checkFiles(url) {
    const results = { hasRobotsTxt: false, hasSitemap: false };
    try {
        const urlObj = new URL(url);
        const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

        try {
            const robotsRes = await axios.head(`${baseUrl}/robots.txt`, { timeout: 5000, validateStatus: () => true });
            if (robotsRes.status === 200) results.hasRobotsTxt = true;
        } catch(e) {}

        try {
            const sitemapRes = await axios.head(`${baseUrl}/sitemap.xml`, { timeout: 5000, validateStatus: () => true });
            if (sitemapRes.status === 200) results.hasSitemap = true;
        } catch(e) {}
    } catch (e) {}
    
    return results;
}

// ─── استخراج البيانات الأساسية من الصفحة ─────────────────────────────────
async function extractPageData(page) {
    return await page.evaluate(() => {
        const getMeta = (name) => document.querySelector(`meta[name="${name}"]`)?.content || document.querySelector(`meta[property="${name}"]`)?.content || "";
        
        // 1. Meta Data
        const metaData = {
            title: document.title || "",
            description: getMeta("description"),
            canonical: document.querySelector('link[rel="canonical"]')?.href || "",
            robots: getMeta("robots"),
            ogTitle: getMeta("og:title"),
            ogDescription: getMeta("og:description"),
            ogImage: getMeta("og:image"),
            twitterCard: getMeta("twitter:card"),
            viewport: getMeta("viewport"),
            charset: document.characterSet || ""
        };

        // 2. Headings
        const headings = {
            h1: document.querySelectorAll("h1").length,
            h2: document.querySelectorAll("h2").length,
            h3: document.querySelectorAll("h3").length,
            h4: document.querySelectorAll("h4").length,
            h5: document.querySelectorAll("h5").length,
            h6: document.querySelectorAll("h6").length,
            h1Texts: Array.from(document.querySelectorAll("h1")).map(h => h.textContent.trim())
        };

        // 3. Links
        const allLinks = Array.from(document.querySelectorAll("a[href]"));
        const currentDomain = window.location.hostname;
        let internal = 0;
        let external = 0;

        allLinks.forEach(link => {
            try {
                const url = new URL(link.href);
                if (url.hostname === currentDomain) internal++;
                else external++;
            } catch (e) {
                // Ignore invalid links
            }
        });

        // 4. Images
        const allImages = Array.from(document.querySelectorAll("img"));
        let withAlt = 0;
        let missingAlt = 0;

        allImages.forEach(img => {
            if (img.hasAttribute("alt") && img.getAttribute("alt").trim() !== "") {
                withAlt++;
            } else {
                missingAlt++;
            }
        });

        // 5. Text content for Word Count
        const bodyText = document.body.innerText || "";
        const words = bodyText.split(/\s+/).filter(word => word.length > 2);
        const wordCount = words.length;

        // Basic Keyword Density (Top 10 words)
        const wordMap = {};
        words.forEach(w => {
            const word = w.toLowerCase().replace(/[^a-z0-9]/g, "");
            if (word.length > 3) {
                wordMap[word] = (wordMap[word] || 0) + 1;
            }
        });

        const keywords = Object.entries(wordMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([word, count]) => ({
                word,
                count,
                density: parseFloat(((count / Math.max(1, wordCount)) * 100).toFixed(2))
            }));

        const schemaScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        const schemaTypes = [];
        
        const addType = (type) => {
            if (Array.isArray(type)) {
                type.forEach(t => { if (typeof t === 'string') schemaTypes.push(t) });
            } else if (typeof type === 'string') {
                schemaTypes.push(type);
            }
        };

        schemaScripts.forEach(script => {
            try {
                const json = JSON.parse(script.textContent || "{}");
                if (Array.isArray(json)) {
                    json.forEach(item => { if (item['@type']) addType(item['@type']) });
                } else if (json['@type']) {
                    addType(json['@type']);
                } else if (json['@graph']) {
                    json['@graph'].forEach(item => { if (item['@type']) addType(item['@type']) });
                }
            } catch(e) {}
        });
        const uniqueSchemaTypes = [...new Set(schemaTypes)];

        return {
            metaData,
            headings,
            links: { total: allLinks.length, internal, external },
            images: { total: allImages.length, withAlt, missingAlt },
            wordCount,
            keywords,
            schemaTypes: uniqueSchemaTypes
        };
    });
}

// ─── تحليل البيانات واكتشاف الأخطاء (Rule-based Engine) ───────────────────
function analyzeData(data, loadTime, pageSize, advancedSEO) {
    const issues = [];
    const categories = { seo: 100, performance: 100, accessibility: 100, bestPractices: 100 };

    // --- SEO Rules ---
    if (!data.metaData.title) {
        issues.push({ severity: "critical", category: "SEO", message: "Missing title tag", recommendation: "Add a descriptive <title> tag to your page." });
        categories.seo -= 20;
    } else if (data.metaData.title.length < 30 || data.metaData.title.length > 60) {
        issues.push({ severity: "warning", category: "SEO", message: "Title length is not optimal", recommendation: "Keep title length between 30 and 60 characters." });
        categories.seo -= 5;
    }

    if (!data.metaData.description) {
        issues.push({ severity: "critical", category: "SEO", message: "Missing meta description", recommendation: "Add a <meta name='description'> tag." });
        categories.seo -= 15;
    }

    if (data.headings.h1 === 0) {
        issues.push({ severity: "critical", category: "SEO", message: "Missing H1 tag", recommendation: "Add exactly one <h1> tag to describe the page's main topic." });
        categories.seo -= 15;
    } else if (data.headings.h1 > 1) {
        issues.push({ severity: "warning", category: "SEO", message: "Multiple H1 tags found", recommendation: "Use only one <h1> tag per page for best SEO results." });
        categories.seo -= 5;
    }

    // --- Accessibility Rules ---
    if (data.images.missingAlt > 0) {
        issues.push({ severity: "critical", category: "Accessibility", message: `${data.images.missingAlt} images missing alt attributes`, recommendation: "Add descriptive 'alt' attributes to all images." });
        categories.accessibility -= Math.min(30, data.images.missingAlt * 5);
    }

    if (!data.metaData.viewport) {
        issues.push({ severity: "critical", category: "Accessibility", message: "Missing viewport meta tag", recommendation: "Add <meta name='viewport' content='width=device-width, initial-scale=1'>." });
        categories.accessibility -= 20;
    }

    // --- Performance Rules ---
    if (loadTime > 3000) {
        issues.push({ severity: "warning", category: "Performance", message: "Slow page load time", recommendation: "Optimize images, use caching, and minimize scripts to improve load time." });
        categories.performance -= 15;
    }
    if (loadTime > 6000) {
        categories.performance -= 15;
    }

    if (pageSize > 3000000) { // 3MB
        issues.push({ severity: "warning", category: "Performance", message: "Large page size", recommendation: "Reduce page size (currently >3MB) to improve loading speed." });
        categories.performance -= 10;
    }

    // --- Best Practices Rules ---
    if (!data.metaData.canonical) {
        issues.push({ severity: "info", category: "Best Practices", message: "Missing canonical tag", recommendation: "Specify a canonical URL to avoid duplicate content issues." });
        categories.bestPractices -= 10;
    }

    if (!data.metaData.ogTitle || !data.metaData.ogImage) {
        issues.push({ severity: "info", category: "Best Practices", message: "Incomplete OpenGraph tags", recommendation: "Add complete OpenGraph tags (og:title, og:image) for better social sharing." });
        categories.bestPractices -= 10;
    }

    // --- Advanced SEO Rules ---
    if (advancedSEO) {
        if (!advancedSEO.hasSSL) {
            issues.push({ severity: "critical", category: "Security", message: "Missing or invalid SSL Certificate", recommendation: "Install a valid SSL certificate (HTTPS) to secure your site and improve SEO rankings." });
            categories.seo -= 15;
            categories.bestPractices -= 20;
        }
        if (!advancedSEO.hasRobotsTxt) {
            issues.push({ severity: "warning", category: "SEO", message: "Missing robots.txt", recommendation: "Add a robots.txt file to guide search engine crawlers." });
            categories.seo -= 5;
        }
        if (!advancedSEO.hasSitemap) {
            issues.push({ severity: "info", category: "SEO", message: "Sitemap.xml not found at default location", recommendation: "Ensure you have a sitemap.xml and submit it to Google Search Console." });
            categories.seo -= 5;
        }
    }

    // Ensure scores are not negative
    Object.keys(categories).forEach(k => categories[k] = Math.max(0, categories[k]));

    const overallScore = Math.round(
        (categories.seo * 0.4) + 
        (categories.performance * 0.3) + 
        (categories.accessibility * 0.2) + 
        (categories.bestPractices * 0.1)
    );

    return { issues, categories, overallScore };
}

// ─── الدالة الرئيسية للتحليل ──────────────────────────────────────────────
export async function runFullSEOAnalysis(analysisId) {
    const analysis = await Analysis.findById(analysisId);
    if (!analysis) return;

    console.log(`🚀 Starting SEO Audit for: ${analysis.url}`);

    let session, browser, page;

    try {
        const bb = new Browserbase({ 
            apiKey: process.env.BROWSERBASE_API_KEY,
            projectId: process.env.BROWSERBASE_PROJECT_ID
        });
        session = await bb.sessions.create();
        browser = await chromium.connectOverCDP(session.connectUrl);
        const context = browser.contexts()[0];
        page = context.pages()[0];

        // 1. Measure Performance & Fetch Page
        const startTime = Date.now();
        let pageSizeBytes = 0;
        
        page.on('response', async (response) => {
            try {
                const buffer = await response.body();
                pageSizeBytes += buffer.length;
            } catch (e) {
                // Ignore failed responses
            }
        });

        await page.goto(analysis.url, { waitUntil: "networkidle", timeout: 45000 });
        const loadTime = Date.now() - startTime;

        // 2. Extract Data
        const extractedData = await extractPageData(page);

        // 2.5 Extract Advanced SEO
        const sslInfo = await checkSSL(analysis.url);
        const filesInfo = await checkFiles(analysis.url);
        const advancedSEO = {
            ...sslInfo,
            ...filesInfo,
            schemaTypes: extractedData.schemaTypes || []
        };
        // Remove schemaTypes from extractedData so it doesn't pollute the document root
        delete extractedData.schemaTypes;

        // 3. Analyze Data
        const { issues, categories, overallScore } = analyzeData(extractedData, loadTime, pageSizeBytes, advancedSEO);

        // 4. Update Database
        Object.assign(analysis, {
            ...extractedData,
            advancedSEO,
            loadTime,
            pageSize: pageSizeBytes,
            categories,
            overallScore,
            issues,
            status: "completed"
        });

        await analysis.save();
        console.log(`✅ SEO Audit completed for: ${analysis.url} - Score: ${overallScore}`);

    } catch (error) {
        console.error(`🚨 SEO Audit failed for ${analysis.url}:`, error.message);
        analysis.status = "failed";
        await analysis.save();
        throw error;
    } finally {
        if (browser) {
            await page.close().catch(() => {});
            await browser.close().catch(() => {});
        }
    }
}
