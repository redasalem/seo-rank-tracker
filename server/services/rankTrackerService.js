import axios from "axios";

// ─── البحث في جوجل عبر SerpApi واستخراج النتائج ─────────────────────────────
export async function searchGoogle(keyword, country = "us") {
    const apiKey = process.env.SERPAPI_API_KEY;

    if (!apiKey) {
        throw new Error("SERPAPI_API_KEY is not configured. Please add it to your environment variables.");
    }

    console.log(`  🔗 SerpApi search: "${keyword}" (country: ${country})`);

    const response = await axios.get("https://serpapi.com/search.json", {
        params: {
            q: keyword,
            gl: country.toLowerCase(),
            hl: "en",
            num: 50,
            engine: "google",
            api_key: apiKey,
        },
        timeout: 30000,
    });

    const data = response.data;

    // Check for SerpApi-level errors
    if (data.error) {
        throw new Error(`SerpApi error: ${data.error}`);
    }

    const organicResults = data.organic_results || [];
    console.log(`  📊 SerpApi returned ${organicResults.length} organic results`);

    // Map SerpApi results to the same shape our codebase expects
    const results = organicResults.map((item, index) => ({
        url: item.link,
        snippet: item.snippet || "",
        position: item.position || index + 1,
        page: Math.floor(index / 10) + 1,
    }));

    return results;
}
