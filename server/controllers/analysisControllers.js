import Analysis from "../models/analysisModel.js";
import User from "../models/User.js";
import { runFullSEOAnalysis } from "../services/seoAnalysisService.js";
import aiService from "../services/aiService.js";

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
        const planLimits = { free: 5, pro: 20, max: 60 };
        const limit = planLimits[user.plan] || 5;
        if (user.analysisCount >= limit) {
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
        }

        res.status(200).json({
            message: "Analysis completed successfully",
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
