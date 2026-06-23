import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            key: { type: String, required: true },
            data: { type: mongoose.Schema.Types.Mixed, default: {} }
        },
        type: {
            type: String,
            enum: ["info", "success", "warning", "error"],
            default: "info",
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        link: {
            type: String,
        },
    },
    { timestamps: true }
);

// تصغير حجم الاستعلامات (Index) عشان نجلب أحدث الإشعارات للمستخدم بسرعة
notificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
