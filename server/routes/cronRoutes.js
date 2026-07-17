import express from "express";
import KeywordTracking from "../models/keywordTracking.js";
import { processAllPendingKeywords } from "../services/keywordTrackingService.js";
import { sendDuePeriodicReports } from "../services/reportService.js";

const cronRouter = express.Router();

// @desc    Daily Cron Job to update keywords (Triggered by Vercel)
// @route   GET /api/cron/daily
// @access  Public (But protected by Vercel Cron Secret in production)
cronRouter.get("/daily", async (req, res) => {
    // Vercel sends an authorization header with the cron secret
    const authHeader = req.headers.authorization;
    
    // Check if it's running on Vercel and verify the secret
    if (process.env.VERCEL && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ message: "Unauthorized: Invalid Cron Secret" });
    }

    console.log("⏰ [VERCEL CRON] Daily rank update started...");

    try {
        // 1. Change all active keywords to pending
        const result = await KeywordTracking.updateMany(
            { active: true },
            { status: "pending" }
        );
        console.log(`📋 [VERCEL CRON] ${result.modifiedCount} keyword(s) set to pending`);

        // Return 202 Accepted immediately
        res.status(202).json({ 
            message: "Cron job triggered and queued successfully", 
            keywordsMarkedPending: result.modifiedCount 
        });

        // Run in background without await
        processAllPendingKeywords().then(() => {
            console.log("✅ [VERCEL CRON] Background periodic rank update completed!");
        }).catch(err => {
            console.error("🚨 [VERCEL CRON] Background task failed:", err);
        });

    } catch (error) {
        console.error("🚨 [VERCEL CRON] Failed:", error.message);
        // If response wasn't sent yet
        if (!res.headersSent) {
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
});

// @desc    Daily Cron Job to send periodic email reports (Triggered by Vercel)
// @route   GET /api/cron/periodic-reports
// @access  Public (But protected by Vercel Cron Secret in production)
cronRouter.get("/periodic-reports", async (req, res) => {
    const authHeader = req.headers.authorization;
    
    // Check if it's running on Vercel and verify the secret
    if (process.env.VERCEL && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ message: "Unauthorized: Invalid Cron Secret" });
    }

    console.log("⏰ [VERCEL CRON] Periodic email reports started...");

    try {
        // Return 202 Accepted immediately to avoid serverless timeout
        res.status(202).json({ 
            message: "Periodic email reports cron triggered and queued successfully"
        });

        // Run in background without await
        sendDuePeriodicReports().then(() => {
            console.log("✅ [VERCEL CRON] Background periodic email reports completed!");
        }).catch(err => {
            console.error("🚨 [VERCEL CRON] Background reports task failed:", err);
        });

    } catch (error) {
        console.error("🚨 [VERCEL CRON] Failed to trigger periodic reports:", error.message);
        if (!res.headersSent) {
            res.status(500).json({ message: "Server error", error: error.message });
        }
    }
});

export default cronRouter;
