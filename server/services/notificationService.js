import Notification from "../models/Notification.js";

/**
 * دالة مركزية لإنشاء التنبيهات
 */
export async function createNotification({ userId, title, message, type = "info", link }) {
    try {
        const notification = await Notification.create({
            user: userId,
            title,
            message,
            type,
            link,
        });

        // Limit user notifications to last 50 to avoid massive DB bloat
        // Optional feature: we can run a background cleanup or do it here
        const count = await Notification.countDocuments({ user: userId });
        if (count > 50) {
            // Find the oldest ones and delete
            const oldest = await Notification.find({ user: userId })
                .sort({ createdAt: 1 })
                .limit(count - 50);
            const idsToDelete = oldest.map(n => n._id);
            await Notification.deleteMany({ _id: { $in: idsToDelete } });
        }

        return notification;
    } catch (error) {
        console.error("🚨 Failed to create notification:", error);
    }
}
