import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

const Settings = mongoose.model("Settings", settingsSchema);

// Default settings to seed if not present
Settings.seedDefaults = async () => {
    const defaults = [
        { key: "planLimits", value: { free: { analyses: 3, keywords: 5 }, pro: { analyses: 20, keywords: 50 }, max: { analyses: 60, keywords: 200 } } },
        { key: "maintenanceMode", value: false }
    ];
    for (const d of defaults) {
        await Settings.findOneAndUpdate({ key: d.key }, { $setOnInsert: d }, { upsert: true });
    }
};

export default Settings;
