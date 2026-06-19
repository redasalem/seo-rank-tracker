import User from "../models/User.js";
import Keyword from "../models/keywordTracking.js";

// ─── Get Dashboard Statistics ───────────────────────────────────────
export const getStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const proUsers = await User.countDocuments({ plan: "pro" });
        const freeUsers = totalUsers - proUsers;
        const totalKeywords = await Keyword.countDocuments();

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

        res.json({
            success: true,
            stats: {
                totalUsers,
                proUsers,
                freeUsers,
                totalKeywords,
                newUsersLast30Days,
                monthlyGrowth: monthlyGrowth.map(item => ({
                    month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
                    users: item.count
                }))
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
        const { search, plan, page = 1, limit = 20 } = req.query;
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

        const skip = (Number(page) - 1) * Number(limit);
        const total = await User.countDocuments(filter);
        const users = await User.find(filter)
            .select("-password -resetPasswordToken -emailVerificationToken")
            .sort({ createdAt: -1 })
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

// ─── Update User (Change Plan / Role) ───────────────────────────────
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { plan, role } = req.body;
        const updateFields = {};

        if (plan) updateFields.plan = plan;
        if (role) updateFields.role = role;

        const user = await User.findByIdAndUpdate(id, updateFields, { new: true })
            .select("-password -resetPasswordToken -emailVerificationToken");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error("Admin updateUser Error:", error.message);
        res.status(500).json({ message: "Failed to update user" });
    }
};
