import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Service for generating AI-powered SEO insights.
 */
class AIService {
    constructor() {
        // We will initialize it dynamically to catch runtime changes in .env
    }

    /**
     * Send a chat message to the AI consultant.
     * @param {Object} analysis - The full analysis object from DB.
     * @param {string} message - The user's message.
     * @param {Array} history - The chat history array.
     * @param {string} language - The preferred language (e.g., 'ar' or 'en').
     * @returns {Promise<string>} The markdown formatted AI response.
     */
    async sendChatMessage(analysis, message, history = [], language = "en") {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not configured in environment variables.");
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);

        const systemInstruction = `
You are a helpful AI SEO Consultant. Your goal is to answer the user's questions about their website's SEO.
Keep your answers brief, conversational, and highly actionable.
IMPORTANT: Always respond in the SAME language the user uses to ask the question (e.g., if they ask in Arabic, reply in Arabic).
IMPORTANT: Do NOT dump a full SEO report or list all issues unless the user explicitly asks for it. Wait for their specific questions. Just say hello if they just say hello.

Context about the user's website:
- URL: ${analysis.url}
- Overall Score: ${analysis.overallScore}/100
- Performance: Load Time ${analysis.loadTime}ms, Page Size ${analysis.pageSize}KB
${analysis.lighthouse ? `- Lighthouse Scores: Performance ${analysis.lighthouse.performance}, Accessibility ${analysis.lighthouse.accessibility}, Best Practices ${analysis.lighthouse.bestPractices}, SEO ${analysis.lighthouse.seo}
- Core Web Vitals: FCP ${analysis.lighthouse.metrics?.fcp}ms, LCP ${analysis.lighthouse.metrics?.lcp}ms, CLS ${analysis.lighthouse.metrics?.cls}` : ''}
- Total Issues: ${analysis.issues.length}
- Top Issues: ${JSON.stringify(analysis.issues.map(i => i.message).slice(0, 3))}
`.trim();

        try {
            const model = genAI.getGenerativeModel({ 
                model: "gemini-3.5-flash",
                systemInstruction
            });

            // Format history for Gemini SDK
            const formattedHistory = history.map(msg => ({
                role: msg.role === "ai" ? "model" : "user",
                parts: [{ text: msg.content }]
            }));

            const chat = model.startChat({
                history: formattedHistory,
            });

            const result = await chat.sendMessage(message);
            const response = result.response;
            return response.text();
        } catch (error) {
            console.error("Gemini API Error:", error);
            throw new Error(`Gemini API Error: ${error.message}`);
        }
    }
}

export default new AIService();
