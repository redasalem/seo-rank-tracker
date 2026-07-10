import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Service for generating AI-powered SEO insights.
 */
class AIService {
    constructor() {
        // We will initialize it dynamically to catch runtime changes in .env
    }

    /**
     * Generate SEO recommendations based on the analysis data.
     * @param {Object} analysis - The full analysis object from DB.
     * @param {string} language - The preferred language (e.g., 'ar' or 'en').
     * @returns {Promise<string>} The markdown formatted AI response.
     */
    async generateSeoInsights(analysis, language = "en") {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not configured in environment variables.");
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);

        const systemInstruction = `
You are an expert SEO consultant. Your job is to analyze website SEO data and provide an actionable, easy-to-understand report for the website owner.
Format your response in Markdown. Use bullet points and bold text for readability.
The response MUST be in ${language === "ar" ? "Arabic" : "English"}.
Structure your response exactly like this:
1. 🎯 **Executive Summary** (A brief 2-sentence summary of the site's overall health).
2. ✅ **Strengths** (What the site is doing well based on the data).
3. ⚠️ **Areas for Improvement** (The most critical issues).
4. 🛠️ **Action Plan** (3-5 concrete, actionable steps the owner should take right now to improve their score).
Keep the tone professional, encouraging, and highly practical. Avoid technical jargon where possible, or explain it simply.
        `.trim();

        // Prepare the data payload to send to Gemini
        const dataPayload = {
            url: analysis.url,
            overallScore: analysis.overallScore,
            performance: {
                loadTime: analysis.loadTime,
                pageSize: analysis.pageSize,
                wordCount: analysis.wordCount,
            },
            categories: analysis.categories,
            issues: analysis.issues.map(i => ({
                severity: i.severity,
                category: i.category,
                message: i.message
            }))
        };

        const prompt = `
Please analyze the following SEO data and provide insights:
\`\`\`json
${JSON.stringify(dataPayload, null, 2)}
\`\`\`
        `.trim();

        try {
            // Using system instructions in Gemini 1.5/2.5
            const modelWithSystem = genAI.getGenerativeModel({ 
                model: "gemini-1.5-flash",
                systemInstruction 
            });

            const result = await modelWithSystem.generateContent(prompt);
            const response = result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini API Error:", error);
            throw new Error(`Gemini API Error: ${error.message}`);
        }
    }
}

export default new AIService();
