import Notification from "../models/Notification.js";

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50); // Get latest 50

        res.json({
            success: true,
            data: notifications,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        // Make sure it belongs to the user
        if (notification.user.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        notification.isRead = true;
        await notification.save();

        res.json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user.id, isRead: false },
            { isRead: true }
        );

        res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};
