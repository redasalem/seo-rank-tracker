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

        // Check limits
        if (user.plan === "free" && user.analysisCount >= 3) {
            return res.status(403).json({ 
                message: "You have reached your daily limit of 3 analyses on the Free plan. Please upgrade to Pro."
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

// @desc    Generate AI Insights for an existing analysis
// @route   POST /api/analysis/:id/ai-insights
// @access  Private
export const generateAiInsights = async (req, res) => {
    try {
        const { id } = req.params;
        const { language } = req.body;

        const analysis = await Analysis.findById(id);
        if (!analysis) {
            return res.status(404).json({ message: "Analysis not found" });
        }

        // Check if user owns it
        if (analysis.userId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Not authorized" });
        }

        // Generate insights
        const insights = await aiService.generateSeoInsights(analysis, language || "en");

        // Save to DB
        analysis.aiInsights = insights;
        await analysis.save();

        res.status(200).json({ success: true, aiInsights: insights });
    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ success: false, message: error.message || "Failed to generate AI insights" });
    }
};
