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
You are an expert SEO consultant assisting the user with their website. Keep your answers brief, fast, and highly actionable.
Reply strictly in ${language === "ar" ? "Arabic" : "English"}.
Context about the website being analyzed:
URL: ${analysis.url}
Overall Score: ${analysis.overallScore}
Performance: Load Time ${analysis.loadTime}ms, Page Size ${analysis.pageSize}KB
Issues count: ${analysis.issues.length}
Top Issues: ${JSON.stringify(analysis.issues.map(i => i.message).slice(0, 3))}
`.trim();

        try {
            const model = genAI.getGenerativeModel({ 
                model: "gemini-flash-latest",
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
