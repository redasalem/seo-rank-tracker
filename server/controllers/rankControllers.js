import mongoose from "mongoose";
import KeywordTracking from "../models/keywordTracking.js";
import User from "../models/User.js";
import Analysis from "../models/analysisModel.js";
import { processSingleKeyword } from "../services/keywordTrackingService.js";

// Add a new keyword for tracking
export const addKeyword = async (req, res) => {
    try {
        let { keyword, url, country, domain } = req.body;
        const userId = req.user.id;

        // Validation
        if (!keyword || !url || !country) {
            return res.status(400).json({ message: "Fields (keyword, url, country) are required" });
        }

        // URL format validation and Domain extraction
        try {
            // Add https:// automatically if missing
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }
            
            const urlObject = new URL(url);
            
            // If domain is not provided by frontend, extract it automatically (remove www.)
            if (!domain) {
                domain = urlObject.hostname.replace(/^www\./, '');
            }
        } catch (err) {
            return res.status(400).json({ message: "Invalid URL format. Please provide a valid link." });
        }

        // Check if tracking already exists for this user, keyword, and domain
        const existingTracking = await KeywordTracking.findOne({ userId, keyword, domain });
        if (existingTracking) {
            return res.status(409).json({ message: "You are already tracking this keyword for this domain" });
        }

        // Limit Check based on plan
        const user = await User.findById(userId);
        if (user) {
            const count = await KeywordTracking.countDocuments({ userId });
            const limits = { free: 5, pro: 50, max: 200 };
            const limit = limits[user.plan] || 5;
            
            if (count >= limit) {
                const nextPlan = user.plan === "free" ? "Pro" : "Max";
                const message = user.plan === "max" 
                    ? "You have reached the maximum limit of 200 keywords on the Max plan."
                    : `You have reached your limit of ${limit} keywords on the ${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} plan. Please upgrade to ${nextPlan}.`;
                
                return res.status(403).json({ message });
            }
        }

        // Create new tracking entry
        const newEntry = await KeywordTracking.create({
            userId,
            keyword,
            url,
            domain,
            country,
            status: "pending"
        });


        // Run task before sending response because Serverless kills background tasks
        let scanErrorMsg = null;
        try {
            await processSingleKeyword(newEntry._id);
        } catch (scanErr) {
            console.error(`🚨 Keyword scan failed for: ${keyword}`, scanErr);
            scanErrorMsg = scanErr.message;
            await KeywordTracking.findByIdAndUpdate(newEntry._id, { status: "failed" });
        }

        const updatedEntry = await KeywordTracking.findById(newEntry._id);

        if (updatedEntry.status === "failed") {
            res.status(201).json({
                message: "Keyword added but scanning failed.",
                errorDetails: scanErrorMsg || "Unknown error",
                tracking: updatedEntry
            });
        } else {
            res.status(201).json({
                message: "Keyword added and ranked successfully",
                tracking: updatedEntry
            });
        }

    } catch (error) {
        console.error("Error adding keyword:", error);
        
        // Handle MongoDB unique index error fallback
        if (error.code === 11000) {
            return res.status(409).json({ message: "You are already tracking this keyword for this domain" });
        }

        res.status(500).json({ message: "Server error" });
    }
};

// Get tracked keywords for a user with pagination, search, and filtering
export const getKeywords = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || "";
        const status = req.query.status || "all"; // all, active, paused
        const sortBy = req.query.sortBy || "newest"; // newest, rank_asc, rank_desc, change

        const skip = (page - 1) * limit;
        
        // Build query
        const query = { userId };
        
        if (search) {
            query.$or = [
                { keyword: { $regex: search, $options: "i" } },
                { domain: { $regex: search, $options: "i" } }
            ];
        }
        
        if (status === "active") query.active = true;
        else if (status === "paused") query.active = false;
        
        // Build sort object
        let sortObj = { createdAt: -1 };
        if (sortBy === "rank_asc") sortObj = { currentPosition: 1 };
        else if (sortBy === "rank_desc") sortObj = { currentPosition: -1 };
        else if (sortBy === "change") sortObj = { positionChange: -1 };
        
        const trackingEntries = await KeywordTracking.find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(limit);
            
        const total = await KeywordTracking.countDocuments(query);
        
        res.status(200).json({
            count: trackingEntries.length,
            total,
            page,
            totalPages: Math.ceil(total / limit) || 1,
            keywords: trackingEntries
        });

    } catch (error) {
        console.error("Error fetching keywords:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get aggregated Dashboard stats
export const getDashboardStats = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        
        // Use aggregation to calculate all stats efficiently
        const stats = await KeywordTracking.aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id: null,
                    totalKeywords: { $sum: 1 },
                    inTop10: {
                        $sum: { $cond: [{ $and: [{ $ne: ["$currentPosition", null] }, { $lte: ["$currentPosition", 10] }] }, 1, 0] }
                    },
                    inTop3: {
                        $sum: { $cond: [{ $and: [{ $ne: ["$currentPosition", null] }, { $lte: ["$currentPosition", 3] }] }, 1, 0] }
                    },
                    inTop50: {
                        $sum: { $cond: [{ $and: [{ $ne: ["$currentPosition", null] }, { $lte: ["$currentPosition", 50] }, { $gt: ["$currentPosition", 10] }] }, 1, 0] }
                    },
                    unranked: {
                        $sum: { $cond: [{ $or: [{ $eq: ["$currentPosition", null] }, { $gt: ["$currentPosition", 50] }] }, 1, 0] }
                    },
                    bestPosition: { $min: "$currentPosition" },
                    sumRank: { $sum: "$currentPosition" },
                    rankedCount: { $sum: { $cond: [{ $ne: ["$currentPosition", null] }, 1, 0] } }
                }
            }
        ]);
        
        const result = stats[0] || {
            totalKeywords: 0,
            inTop10: 0,
            inTop3: 0,
            inTop50: 0,
            unranked: 0,
            bestPosition: null,
            sumRank: 0,
            rankedCount: 0
        };
        
        const averageRank = result.rankedCount > 0 ? Math.round(result.sumRank / result.rankedCount) : null;
        
        // Find biggest improver
        const biggestImprover = await KeywordTracking.findOne({ userId })
            .sort({ positionChange: -1 })
            .limit(1)
            .select("keyword positionChange");
            
        // Get recent keywords for dashboard list
        const recentKeywords = await KeywordTracking.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .select("keyword domain currentPosition positionChange status");
            
        // Build line chart data from history
        const historyDataPipeline = await KeywordTracking.aggregate([
            { $match: { userId } },
            { $unwind: "$rankHistory" },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$rankHistory.date" } },
                    totalRank: { $sum: "$rankHistory.position" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: -1 } },
            { $limit: 7 },
            { $sort: { _id: 1 } }
        ]);
        
        const historyData = historyDataPipeline.map(item => {
            const dateObj = new Date(item._id);
            // Re-adjust for local time zone shift so it doesn't show previous day
            dateObj.setMinutes(dateObj.getMinutes() + dateObj.getTimezoneOffset());
            return {
                date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                averageRank: Math.round(item.totalRank / item.count)
            };
        });
        
        // Include today's data in the history chart
        if (result.rankedCount > 0) {
            const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const existingToday = historyData.find(h => h.date === todayStr);
            if (!existingToday) {
                historyData.push({
                    date: todayStr,
                    averageRank: averageRank
                });
            } else {
                existingToday.averageRank = averageRank;
            }
        }
        
        // Get recent analyses for dashboard
        const recentAnalyses = await Analysis.find({ userId })
            .sort({ createdAt: -1 })
            .limit(3)
            .select("url domain overallScore status createdAt categories");
            
        // Get user for limits
        const user = await User.findById(userId);

        // Use user.analysisCount directly to match limit enforcement
        const todayAnalysisCount = user ? user.analysisCount || 0 : 0;

        res.status(200).json({
            stats: {
                totalKeywords: result.totalKeywords,
                inTop10: result.inTop10,
                bestPosition: result.bestPosition,
                averageRank: averageRank,
                biggestImprover: biggestImprover ? {
                    keyword: biggestImprover.keyword,
                    positionChange: biggestImprover.positionChange
                } : null,
                rankDistribution: [
                    { name: 'Top 3', value: result.inTop3, color: '#10b981' },
                    { name: 'Pos 4-10', value: result.inTop10 - result.inTop3, color: '#3b82f6' },
                    { name: 'Pos 11-50', value: result.inTop50, color: '#f59e0b' },
                    { name: 'Unranked', value: result.unranked, color: '#6b7280' },
                ].filter(d => d.value > 0),
                historyData: historyData,
                recentKeywords: recentKeywords,
                recentAnalyses: recentAnalyses,
                analysisLimit: user ? {
                    plan: user.plan,
                    used: todayAnalysisCount,
                    max: user.plan === 'free' ? 5 : user.plan === 'pro' ? 20 : 60
                } : null
            }
        });
        
    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get single keyword with full history
export const getKeyword = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const keyword = await KeywordTracking.findOne({ _id: id, userId });

        if (!keyword) {
            return res.status(404).json({ message: "Keyword tracking not found" });
        }

        res.status(200).json({ keyword });

    } catch (error) {
        console.error("Error fetching single keyword:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Manually refresh a keyword ranking
export const refreshKeyword = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const entry = await KeywordTracking.findOne({ _id: id, userId });

        if (!entry) {
            return res.status(404).json({ message: "Keyword tracking not found" });
        }

        // Mark as pending and save
        entry.status = "pending";
        await entry.save();

        // Run task before sending response because Serverless kills background tasks
        let refreshErrorMsg = null;
        try {
            await processSingleKeyword(entry._id);
        } catch (err) {
            console.error(`🚨 Keyword refresh failed for: ${entry.keyword}`, err);
            refreshErrorMsg = err.message;
            entry.status = "failed";
            await entry.save();
        }

        const updatedEntry = await KeywordTracking.findById(entry._id);

        if (updatedEntry.status === "failed") {
            res.status(200).json({ 
                message: "Keyword refresh failed",
                errorDetails: refreshErrorMsg || "Unknown error",
                keyword: updatedEntry
            });
        } else {
            res.status(200).json({ 
                message: "Keyword refreshed successfully",
                keyword: updatedEntry
            });
        }
        
    } catch (error) {
        console.error("Error refreshing keyword:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete keyword tracking
export const deleteKeyword = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const deletedKeyword = await KeywordTracking.findOneAndDelete({ _id: id, userId });

        if (!deletedKeyword) {
            return res.status(404).json({ message: "Keyword tracking not found or you don't have permission to delete it" });
        }

        res.status(200).json({ message: "Keyword tracking deleted successfully" });

    } catch (error) {
        console.error("Error deleting keyword:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Toggle tracking active/inactive
export const toggleTracking = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const keyword = await KeywordTracking.findOne({ _id: id, userId });

        if (!keyword) {
            return res.status(404).json({ message: "Keyword tracking not found" });
        }

        keyword.active = !keyword.active;
        await keyword.save();

        res.status(200).json({ 
            message: `Tracking is now ${keyword.active ? 'active' : 'inactive'}`,
            active: keyword.active 
        });

    } catch (error) {
        console.error("Error toggling keyword tracking:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get Global Competitors (Aggregation)
export const getGlobalCompetitors = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        
        // MongoDB Aggregation Pipeline
        const competitors = await KeywordTracking.aggregate([
            { $match: { userId } },
            // Unwind the competitors array so each competitor is a document
            { $unwind: "$competitors" },
            // Group by the competitor's domain
            {
                $group: {
                    _id: "$competitors.domain",
                    keywordCount: { $sum: 1 }, // How many of user's tracked keywords they rank for
                    avgPosition: { $avg: "$competitors.position" },
                    bestPosition: { $min: "$competitors.position" },
                    keywords: { $push: { keyword: "$keyword", position: "$competitors.position", url: "$competitors.url" } }
                }
            },
            // Sort by keywordCount (most frequent competitor first) and then by avgPosition
            { $sort: { keywordCount: -1, avgPosition: 1 } },
            // limit to top 100 global competitors
            { $limit: 100 },
            // Project nicely
            {
                $project: {
                    _id: 0,
                    domain: "$_id",
                    keywordCount: 1,
                    avgPosition: { $round: ["$avgPosition", 1] },
                    bestPosition: 1,
                    // keep top 5 keywords in the array to show in preview
                    topKeywords: { $slice: ["$keywords", 5] }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            competitors
        });
    } catch (error) {
        console.error("Error fetching global competitors:", error);
        res.status(500).json({ message: "Server error" });
    }
};
