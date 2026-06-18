import KeywordTracking from "../models/keywordTraking.js";
import { processSingleKeyword } from "../services/keywordTrakingService.js";

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

        // Create new tracking entry
        const newEntry = await KeywordTracking.create({
            userId,
            keyword,
            url,
            domain,
            country,
            status: "pending"
        });

        // 🔥 Wait for actual processing to finish before responding
        try {
            await processSingleKeyword(newEntry._id);
            // Fetch the updated entry to return it
            const updatedEntry = await KeywordTracking.findById(newEntry._id);
            res.status(201).json({
                message: "Keyword added and analyzed successfully",
                tracking: updatedEntry
            });
        } catch (err) {
            console.error(`⚠️ Keyword scan failed for: ${keyword}`, err);
            // Still return success for adding, but indicate analysis failed
            const failedEntry = await KeywordTracking.findById(newEntry._id);
            res.status(201).json({
                message: "Keyword added, but analysis failed. Try refreshing later.",
                tracking: failedEntry
            });
        }

    } catch (error) {
        console.error("Error adding keyword:", error);
        
        // Handle MongoDB unique index error fallback
        if (error.code === 11000) {
            return res.status(409).json({ message: "You are already tracking this keyword for this domain" });
        }

        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Get all tracked keywords for a user
export const getKeywords = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Fetch tracking entries for this user, sorted by newest first
        const trackingEntries = await KeywordTracking.find({ userId }).sort({ createdAt: -1 });
        
        res.status(200).json({
            count: trackingEntries.length,
            keywords: trackingEntries
        });

    } catch (error) {
        console.error("Error fetching keywords:", error);
        res.status(500).json({ message: "Server error", error: error.message });
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
        res.status(500).json({ message: "Server error", error: error.message });
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

        // تغيير الحالة فوراً حتى يعرف الفرونت أن التحديث جاري
        entry.status = "pending";
        await entry.save();

        // 🔥 Wait for actual processing to finish before responding
        try {
            await processSingleKeyword(entry._id);
            res.status(200).json({ message: "Keyword refreshed successfully" });
        } catch (err) {
            console.error(`⚠️ Keyword refresh failed for: ${entry.keyword}`, err);
            res.status(500).json({ message: "Keyword refresh failed" });
        }
        
    } catch (error) {
        console.error("Error refreshing keyword:", error);
        res.status(500).json({ message: "Server error", error: error.message });
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
        res.status(500).json({ message: "Server error", error: error.message });
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
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
