import express from "express";
import auth from "../middleware/auth.js";
import admin from "../middleware/admin.js";
import {
    getStats,
    getUsers,
    getUserDetail,
    updateUser,
    deleteUser,
    banUser,
    getAnalyses,
    deleteAnalysis,
    getKeywords,
    deleteKeyword,
    getAuditLog,
    getSettings,
    updateSettings,
    sendBulkNotification
} from "../controllers/adminControllers.js";

const adminRouter = express.Router();

// All admin routes require authentication + admin role
adminRouter.use(auth, admin);

// Dashboard
adminRouter.get("/stats", getStats);

// Users
adminRouter.get("/users", getUsers);
adminRouter.get("/users/:id", getUserDetail);
adminRouter.put("/users/:id", updateUser);
adminRouter.delete("/users/:id", deleteUser);
adminRouter.put("/users/:id/ban", banUser);

// Analyses
adminRouter.get("/analyses", getAnalyses);
adminRouter.delete("/analyses/:id", deleteAnalysis);

// Keywords
adminRouter.get("/keywords", getKeywords);
adminRouter.delete("/keywords/:id", deleteKeyword);

// Audit Log
adminRouter.get("/audit-log", getAuditLog);

// Settings
adminRouter.get("/settings", getSettings);
adminRouter.put("/settings", updateSettings);

// Notifications
adminRouter.post("/notifications/bulk", sendBulkNotification);

export default adminRouter;
