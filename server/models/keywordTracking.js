import mongoose from "mongoose";

const rankEntrySchema = new mongoose.Schema({
    position: { type: Number, required: true },
    page: { type: Number },
    url: { type: String },
    snippet: { type: String },
    date: { type: Date, default: Date.now }
},{_id:false});

const competitorSchema = new mongoose.Schema({
    domain: String,
    position: Number,
    url: String,
    snippet: String
}, { _id: false });

const keywordTrackingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    keyword: { type: String, required: true, trim: true, lowercase: true },
    url: { type: String, required: true, trim: true },
    country: { type: String, required: true },
    domain: { type: String, required: true },
    currentPosition: { type: Number, default: null },
    currentPage: { type: Number, default: null },
    bestPosition: { type: Number, default: null },
    positionChange: { type: Number, default: 0 },
    rankHistory: [rankEntrySchema],
    competitors: [competitorSchema],
    active: { type: Boolean, default: true },
    status: { type: String, enum: ["success", "failed", "pending"], default: "pending" }
}, { timestamps: true });

keywordTrackingSchema.index({ userId: 1, keyword: 1, domain: 1 }, { unique: true });

const KeywordTracking = mongoose.model("KeywordTracking", keywordTrackingSchema);

export default KeywordTracking;