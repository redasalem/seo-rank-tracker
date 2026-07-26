import Analysis from "../models/analysisModel.js";
import User from "../models/User.js";
import Settings from "../models/Settings.js";
import { runFullSEOAnalysis } from "../services/seoAnalysisService.js";
import aiService from "../services/aiService.js";
import { generateAnalysisPdf } from "../services/pdfService.js";

// @desc    Start a new SEO analysis
// @route   POST /api/analysis/start
// @access  Private
export const startAnalysis = async (req, res) => {
    try {
        let { url } = req.body;
        const userId = req.user.id;

        if (!url) {
            return res.status(400).json({ message: "URL is required" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Reset count if it's a new day
        const today = new Date().toDateString();
        const lastAnalysisDate = user.lastAnalysisDate ? new Date(user.lastAnalysisDate).toDateString() : null;
        
        if (lastAnalysisDate !== today) {
            user.analysisCount = 0;
            await user.save();
        }

        // Check limits based on plan
        let limit = user.plan === "free" ? 3 : user.plan === "pro" ? 20 : 60;
        try {
            const planLimitsDoc = await Settings.findOne({ key: "planLimits" });
            if (planLimitsDoc && planLimitsDoc.value && planLimitsDoc.value[user.plan]) {
                const dbLimit = planLimitsDoc.value[user.plan].analyses;
                if (dbLimit !== undefined && dbLimit !== null) {
                    limit = dbLimit;
                }
            }
        } catch (err) {
            console.error("Failed to fetch planLimits setting:", err.message);
        }

        if (limit !== -1 && user.analysisCount >= limit) {
            return res.status(403).json({ 
                message: `You have reached your daily limit of ${limit} analyses on the ${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} plan. Please upgrade for more.`
            });
        }

        // Validate and format URL
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        let domain = "";
        try {
            const urlObj = new URL(url);
            domain = urlObj.hostname.replace(/^www\./, '');
        } catch (error) {
            return res.status(400).json({ message: "Invalid URL format" });
        }

        // Increment count BEFORE starting analysis so limit is enforced on next request
        user.analysisCount += 1;
        user.lastAnalysisDate = new Date();
        await user.save();

        // Create a new analysis record in 'processing' state
        const newAnalysis = await Analysis.create({
            userId,
            url,
            domain,
            status: "processing"
        });

        // Run task before sending response because Serverless kills background tasks
        try {
            await runFullSEOAnalysis(newAnalysis._id);
        } catch (err) {
            console.error(`🚨 Background SEO scan failed for: ${url}`, err);
            // Refund the user's analysis count since it failed
            if (user.analysisCount > 0) {
                user.analysisCount -= 1;
                await user.save();
            }
        }

        res.status(200).json({
            message: "Analysis processing completed",
            analysisId: newAnalysis._id
        });

    } catch (error) {
        console.error("Error starting analysis:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// @desc    Get analysis report by ID
// @route   GET /api/analysis/:id
// @access  Private
export const getAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const analysis = await Analysis.findOne({ _id: id, userId });

        if (!analysis) {
            return res.status(404).json({ message: "Analysis report not found" });
        }

        res.status(200).json({ analysis });
    } catch (error) {
        console.error("Error fetching analysis:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// @desc    Get all analyses for the logged-in user (history)
// @route   GET /api/analysis
// @access  Private
export const getUserAnalyses = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const analyses = await Analysis.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select("url domain overallScore status categories createdAt loadTime pageSize");

        const total = await Analysis.countDocuments({ userId });

        res.status(200).json({
            analyses,
            total,
            page,
            totalPages: Math.ceil(total / limit) || 1
        });
    } catch (error) {
        console.error("Error fetching user analyses:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// @desc    Send a chat message to AI Consultant
// @route   POST /api/analysis/:id/ai-chat
// @access  Private
export const generateAiInsights = async (req, res) => {
    try {
        const { id } = req.params;
        const { message, history, language } = req.body;

        if (!message || typeof message !== "string") {
            return res.status(400).json({ message: "Message is required" });
        }
        if (message.length > 1000) {
            return res.status(400).json({ message: "Message too long. Maximum 1000 characters." });
        }
        if (history && history.length > 20) {
            return res.status(400).json({ message: "Chat history too long. Please start a new conversation." });
        }

        const analysis = await Analysis.findById(id);
        if (!analysis) {
            return res.status(404).json({ message: "Analysis not found" });
        }

        // Check if user owns it
        if (analysis.userId.toString() !== req.user.id) {
            return res.status(401).json({ message: "Not authorized" });
        }

        // Generate response
        const reply = await aiService.sendChatMessage(analysis, message, history, language || "en");

        // Save chat history to DB
        analysis.chatHistory.push({ role: "user", content: message });
        analysis.chatHistory.push({ role: "ai", content: reply });
        await analysis.save();

        res.status(200).json({ success: true, reply });
    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to generate AI reply" });
    }
};

// @desc    Export analysis report as PDF
// @route   GET /api/analysis/:id/export-pdf
// @access  Private
export const exportAnalysisPdf = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const language = req.query.lang || "en";

        // 1. Find analysis & verify ownership
        const analysis = await Analysis.findOne({ _id: id, userId });
        if (!analysis) {
            return res.status(404).json({ message: "Analysis report not found" });
        }

        // 2. Must be completed
        if (analysis.status !== "completed") {
            return res.status(400).json({ message: "Analysis is not completed yet. Please wait until it finishes." });
        }

        // 3. Check user plan for watermark
        const user = await User.findById(userId);
        const isFreePlan = !user || user.plan === "free";

        // 4. Generate PDF
        const pdfBuffer = await generateAnalysisPdf(analysis, {
            language: ["en", "ar"].includes(language) ? language : "en",
            isFreePlan,
        });

        // 5. Build filename
        let domain = "report";
        try { domain = new URL(analysis.url).hostname.replace(/[^a-zA-Z0-9.-]/g, "_"); } catch {}

        // 6. Stream PDF
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="RankBoost_Report_${domain}.pdf"`,
            "Content-Length": pdfBuffer.length,
        });

        return res.send(pdfBuffer);
    } catch (error) {
        console.error("PDF Export Error:", error);

        if (error.message?.includes("timeout") || error.message?.includes("Timeout")) {
            return res.status(504).json({ message: "PDF generation timed out. Please try again." });
        }

        res.status(500).json({ message: "Failed to generate PDF report" });
    }
};
