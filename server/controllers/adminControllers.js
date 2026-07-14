import User from "../models/User.js";
import Keyword from "../models/keywordTracking.js";
import Analysis from "../models/analysisModel.js";
import Notification from "../models/Notification.js";
import AuditLog from "../models/AuditLog.js";
import Settings from "../models/Settings.js";

// ─── Helper: Log Admin Action ───────────────────────────────────────
const logAction = async (adminId, action, target, targetId, details, ip) => {
    try {
        await AuditLog.create({ admin: adminId, action, target, targetId, details, ip: ip || "" });
    } catch (e) {
        console.error("AuditLog write failed:", e.message);
    }
};

// ─── Get Dashboard Statistics ───────────────────────────────────────
export const getStats = async (req, res) => {
    try {
        const [totalUsers, proUsers, maxUsers, totalKeywords, totalAnalyses] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ plan: "pro" }),
            User.countDocuments({ plan: "max" }),
            Keyword.countDocuments(),
            Analysis.countDocuments()
        ]);

        const freeUsers = totalUsers - proUsers - maxUsers;
        const bannedUsers = await User.countDocuments({ isBanned: true });

        // Users registered in the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const newUsersLast30Days = await User.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        // Monthly growth data (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyGrowth = await User.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        // Plan distribution for chart
        const planDistribution = [
            { name: "Free", value: freeUsers, color: "#10b981" },
            { name: "Pro", value: proUsers, color: "#f59e0b" },
            { name: "Max", value: maxUsers, color: "#8b5cf6" }
        ];

        // Recent signups (last 5)
        const recentSignups = await User.find()
            .select("name email plan role createdAt isBanned")
            .sort({ createdAt: -1 })
            .limit(5);

        // Recent analyses (last 5)
        const recentAnalyses = await Analysis.find()
            .select("url domain overallScore status createdAt userId")
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("userId", "name email");

        res.json({
            success: true,
            stats: {
                totalUsers,
                proUsers,
                maxUsers,
                freeUsers,
                bannedUsers,
                totalKeywords,
                totalAnalyses,
                newUsersLast30Days,
                monthlyGrowth: monthlyGrowth.map(item => ({
                    month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
                    users: item.count
                })),
                planDistribution,
                recentSignups,
                recentAnalyses
            }
        });
    } catch (error) {
        console.error("Admin getStats Error:", error.message);
        res.status(500).json({ message: "Failed to fetch stats" });
    }
};

// ─── Get All Users ──────────────────────────────────────────────────
export const getUsers = async (req, res) => {
    try {
        const { search, plan, role, page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }
        if (plan && plan !== "all") {
            filter.plan = plan;
        }
        if (role && role !== "all") {
            filter.role = role;
        }

        const sortObj = {};
        sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;

        const skip = (Number(page) - 1) * Number(limit);
        const total = await User.countDocuments(filter);
        const users = await User.find(filter)
            .select("-password -resetPasswordToken -emailVerificationToken -resetPasswordExpires")
            .sort(sortObj)
            .skip(skip)
            .limit(Number(limit));

        res.json({
            success: true,
            users,
            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        console.error("Admin getUsers Error:", error.message);
        res.status(500).json({ message: "Failed to fetch users" });
    }
};

// ─── Get Single User Detail ────────────────────────────────────────
export const getUserDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id)
            .select("-password -resetPasswordToken -emailVerificationToken -resetPasswordExpires");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const [keywords, analyses, keywordCount, analysisCount] = await Promise.all([
            Keyword.find({ userId: id }).sort({ createdAt: -1 }).limit(20),
            Analysis.find({ userId: id }).select("url domain overallScore status createdAt").sort({ createdAt: -1 }).limit(20),
            Keyword.countDocuments({ userId: id }),
            Analysis.countDocuments({ userId: id })
        ]);

        res.json({
            success: true,
            user,
            keywords,
            analyses,
            counts: { keywords: keywordCount, analyses: analysisCount }
        });
    } catch (error) {
        console.error("Admin getUserDetail Error:", error.message);
        res.status(500).json({ message: "Failed to fetch user detail" });
    }
};

// ─── Update User (Change Plan / Role) ───────────────────────────────
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { plan, role } = req.body;
        const updateFields = {};

        const validPlans = ["free", "pro", "max"];
        const validRoles = ["user", "admin"];

        if (plan) {
            if (!validPlans.includes(plan)) {
                return res.status(400).json({ message: `Invalid plan. Must be one of: ${validPlans.join(", ")}` });
            }
            updateFields.plan = plan;
        }
        if (role) {
            if (!validRoles.includes(role)) {
                return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
            }
            // Prevent self-demotion
            if (id === req.user.id && role !== "admin") {
                return res.status(400).json({ message: "You cannot demote your own account" });
            }
            updateFields.role = role;
        }

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: "No valid fields to update" });
        }

        const user = await User.findByIdAndUpdate(id, updateFields, { new: true })
            .select("-password -resetPasswordToken -emailVerificationToken");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await logAction(req.user.id, "UPDATE_USER", "User", id, updateFields, req.ip);

        res.json({ success: true, user });
    } catch (error) {
        console.error("Admin updateUser Error:", error.message);
        res.status(500).json({ message: "Failed to update user" });
    }
};

// ─── Delete User (Cascade) ─────────────────────────────────────────
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent self-deletion
        if (id === req.user.id) {
            return res.status(400).json({ message: "You cannot delete your own account from admin panel" });
        }

        const user = await User.findById(id).select("name email");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Cascade delete all user data
        await Promise.all([
            Keyword.deleteMany({ userId: id }),
            Analysis.deleteMany({ userId: id }),
            Notification.deleteMany({ user: id }),
            User.findByIdAndDelete(id)
        ]);

        await logAction(req.user.id, "DELETE_USER", "User", id, { name: user.name, email: user.email }, req.ip);

        res.json({ success: true, message: "User and all associated data deleted" });
    } catch (error) {
        console.error("Admin deleteUser Error:", error.message);
        res.status(500).json({ message: "Failed to delete user" });
    }
};

// ─── Ban / Unban User ───────────────────────────────────────────────
export const banUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent self-ban
        if (id === req.user.id) {
            return res.status(400).json({ message: "You cannot ban your own account" });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.isBanned = !user.isBanned;
        await user.save();

        const action = user.isBanned ? "BAN_USER" : "UNBAN_USER";
        await logAction(req.user.id, action, "User", id, { name: user.name, email: user.email }, req.ip);

        res.json({ success: true, isBanned: user.isBanned, message: user.isBanned ? "User banned" : "User unbanned" });
    } catch (error) {
        console.error("Admin banUser Error:", error.message);
        res.status(500).json({ message: "Failed to update ban status" });
    }
};

// ─── Get All Analyses (Platform-wide) ───────────────────────────────
export const getAnalyses = async (req, res) => {
    try {
        const { search, status, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { url: { $regex: search, $options: "i" } },
                { domain: { $regex: search, $options: "i" } }
            ];
        }
        if (status && status !== "all") {
            filter.status = status;
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await Analysis.countDocuments(filter);
        const analyses = await Analysis.find(filter)
            .select("url domain overallScore status createdAt userId categories")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate("userId", "name email");

        res.json({
            success: true,
            analyses,
            pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) }
        });
    } catch (error) {
        console.error("Admin getAnalyses Error:", error.message);
        res.status(500).json({ message: "Failed to fetch analyses" });
    }
};

// ─── Delete Analysis ────────────────────────────────────────────────
export const deleteAnalysis = async (req, res) => {
    try {
        const { id } = req.params;
        const analysis = await Analysis.findById(id).select("url domain");
        if (!analysis) {
            return res.status(404).json({ message: "Analysis not found" });
        }

        await Analysis.findByIdAndDelete(id);
        await logAction(req.user.id, "DELETE_ANALYSIS", "Analysis", id, { url: analysis.url, domain: analysis.domain }, req.ip);

        res.json({ success: true, message: "Analysis deleted" });
    } catch (error) {
        console.error("Admin deleteAnalysis Error:", error.message);
        res.status(500).json({ message: "Failed to delete analysis" });
    }
};

// ─── Get All Keywords (Platform-wide) ───────────────────────────────
export const getKeywords = async (req, res) => {
    try {
        const { search, status, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { keyword: { $regex: search, $options: "i" } },
                { domain: { $regex: search, $options: "i" } }
            ];
        }
        if (status && status !== "all") {
            filter.status = status;
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await Keyword.countDocuments(filter);
        const keywords = await Keyword.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate("userId", "name email");

        res.json({
            success: true,
            keywords,
            pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) }
        });
    } catch (error) {
        console.error("Admin getKeywords Error:", error.message);
        res.status(500).json({ message: "Failed to fetch keywords" });
    }
};

// ─── Delete Keyword ─────────────────────────────────────────────────
export const deleteKeyword = async (req, res) => {
    try {
        const { id } = req.params;
        const keyword = await Keyword.findById(id).select("keyword domain");
        if (!keyword) {
            return res.status(404).json({ message: "Keyword not found" });
        }

        await Keyword.findByIdAndDelete(id);
        await logAction(req.user.id, "DELETE_KEYWORD", "Keyword", id, { keyword: keyword.keyword, domain: keyword.domain }, req.ip);

        res.json({ success: true, message: "Keyword deleted" });
    } catch (error) {
        console.error("Admin deleteKeyword Error:", error.message);
        res.status(500).json({ message: "Failed to delete keyword" });
    }
};

// ─── Get Audit Log ──────────────────────────────────────────────────
export const getAuditLog = async (req, res) => {
    try {
        const { search, action, page = 1, limit = 30 } = req.query;
        const filter = {};

        if (search) {
            filter.$or = [
                { action: { $regex: search, $options: "i" } },
                { target: { $regex: search, $options: "i" } }
            ];
        }
        if (action && action !== "all") {
            filter.action = action;
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await AuditLog.countDocuments(filter);
        const logs = await AuditLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate("admin", "name email");

        res.json({
            success: true,
            logs,
            pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) }
        });
    } catch (error) {
        console.error("Admin getAuditLog Error:", error.message);
        res.status(500).json({ message: "Failed to fetch audit log" });
    }
};

// ─── Get Settings ───────────────────────────────────────────────────
export const getSettings = async (req, res) => {
    try {
        await Settings.seedDefaults();
        const settings = await Settings.find();
        const settingsObj = {};
        settings.forEach(s => { settingsObj[s.key] = s.value; });

        res.json({ success: true, settings: settingsObj });
    } catch (error) {
        console.error("Admin getSettings Error:", error.message);
        res.status(500).json({ message: "Failed to fetch settings" });
    }
};

// ─── Update Settings ────────────────────────────────────────────────
export const updateSettings = async (req, res) => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== "object") {
            return res.status(400).json({ message: "Invalid settings data" });
        }

        for (const [key, value] of Object.entries(settings)) {
            await Settings.findOneAndUpdate({ key }, { value }, { upsert: true });
        }

        await logAction(req.user.id, "UPDATE_SETTINGS", "Settings", null, settings, req.ip);

        res.json({ success: true, message: "Settings updated" });
    } catch (error) {
        console.error("Admin updateSettings Error:", error.message);
        res.status(500).json({ message: "Failed to update settings" });
    }
};

// ─── Send Bulk Notification ─────────────────────────────────────────
export const sendBulkNotification = async (req, res) => {
    try {
        const { title, messageKey, type = "info", audience = "all" } = req.body;

        if (!title || !messageKey) {
            return res.status(400).json({ message: "Title and message are required" });
        }

        let userFilter = {};
        if (audience === "pro") userFilter.plan = "pro";
        else if (audience === "max") userFilter.plan = "max";
        else if (audience === "free") userFilter.plan = "free";

        const users = await User.find(userFilter).select("_id");

        const notifications = users.map(u => ({
            user: u._id,
            title,
            message: { key: messageKey, data: {} },
            type,
            isRead: false
        }));

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }

        await logAction(req.user.id, "BULK_NOTIFICATION", "Notification", null, { title, audience, recipientCount: notifications.length }, req.ip);

        res.json({ success: true, message: `Notification sent to ${notifications.length} users` });
    } catch (error) {
        console.error("Admin sendBulkNotification Error:", error.message);
        res.status(500).json({ message: "Failed to send notifications" });
    }
};
