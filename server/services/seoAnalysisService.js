import Analysis from "../models/analysisModel.js";
import https from "https";
import axios from "axios";
import * as cheerio from "cheerio";

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
function extractPageData($, url) {
    const getMeta = (name) => $(`meta[name="${name}"]`).attr("content") || $(`meta[property="${name}"]`).attr("content") || "";
    
    // 1. Meta Data
    const metaData = {
        title: $("title").text() || "",
        description: getMeta("description"),
        canonical: $('link[rel="canonical"]').attr("href") || "",
        robots: getMeta("robots"),
        ogTitle: getMeta("og:title"),
        ogDescription: getMeta("og:description"),
        ogImage: getMeta("og:image"),
        twitterCard: getMeta("twitter:card"),
        viewport: getMeta("viewport"),
        charset: $("meta[charset]").attr("charset") || ""
    };

    // 2. Headings
    const h1Texts = [];
    $("h1").each((_, el) => h1Texts.push($(el).text().trim()));
    
    const headings = {
        h1: $("h1").length,
        h2: $("h2").length,
        h3: $("h3").length,
        h4: $("h4").length,
        h5: $("h5").length,
        h6: $("h6").length,
        h1Texts
    };

    // 3. Links
    const allLinks = $("a[href]");
    let currentDomain = "";
    try {
        currentDomain = new URL(url).hostname;
    } catch(e) {}
    
    let internal = 0;
    let external = 0;

    allLinks.each((_, link) => {
        try {
            const href = $(link).attr("href");
            if (!href) return;
            const linkUrl = new URL(href, url);
            if (linkUrl.hostname === currentDomain) internal++;
            else external++;
        } catch (e) {
            // Ignore invalid links
        }
    });

    // 4. Images
    const allImages = $("img");
    let withAlt = 0;
    let missingAlt = 0;

    allImages.each((_, img) => {
        const alt = $(img).attr("alt");
        if (alt !== undefined && alt.trim() !== "") {
            withAlt++;
        } else {
            missingAlt++;
        }
    });

    // 5. Text content for Word Count
    const bodyText = $("body").text() || "";
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

    const schemaScripts = $('script[type="application/ld+json"]');
    const schemaTypes = [];
    
    const addType = (type) => {
        if (Array.isArray(type)) {
            type.forEach(t => { if (typeof t === 'string') schemaTypes.push(t) });
        } else if (typeof type === 'string') {
            schemaTypes.push(type);
        }
    };

    schemaScripts.each((_, script) => {
        try {
            const json = JSON.parse($(script).html() || "{}");
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

    try {
        // 1. Measure Performance & Fetch Page HTML
        const startTime = Date.now();
        
        // Fetch HTML
        const response = await axios.get(analysis.url, { 
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            },
            validateStatus: () => true, // resolve even on 4xx/5xx to analyze whatever is returned
            responseType: 'arraybuffer' // to accurately measure size in bytes
        });

        const loadTime = Date.now() - startTime;
        const pageSizeBytes = response.data.length;
        const html = response.data.toString('utf8');
        
        // Load HTML into Cheerio
        const $ = cheerio.load(html);

        // 2. Extract Data & Run External Checks in Parallel
        const [extractedData, sslInfo, filesInfo] = await Promise.all([
            Promise.resolve(extractPageData($, analysis.url)),
            checkSSL(analysis.url),
            checkFiles(analysis.url)
        ]);

        // 2.5 Extract Advanced SEO
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
    }
}
