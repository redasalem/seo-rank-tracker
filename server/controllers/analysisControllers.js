import Analysis from "../models/analysisModel.js";
import User from "../models/User.js";
import { runFullSEOAnalysis } from "../services/seoAnalysisService.js";

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
        }

        // Check limits
        if (user.plan === "free" && user.analysisCount >= 10) {
            return res.status(403).json({ 
                message: "You have reached your daily limit of 10 analyses on the Free plan. Please upgrade to Pro."
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

        // Increment count and save
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

        // 🔥 Wait for actual analysis to finish
        try {
            await runFullSEOAnalysis(newAnalysis._id);
            res.status(201).json({
                message: "Analysis completed",
                analysisId: newAnalysis._id
            });
        } catch (err) {
            console.error(`⚠️ SEO scan failed for: ${url}`, err);
            res.status(500).json({ message: "Analysis failed to complete" });
        }

    } catch (error) {
        console.error("Error starting analysis:", error);
        res.status(500).json({ message: "Server error", error: error.message });
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
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
