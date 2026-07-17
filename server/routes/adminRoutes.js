import express from "express";
import auth from "../middleware/auth.js";
import admin from "../middleware/admin.js";
import { validate, mongoIdSchema } from "../middleware/validations.js";
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
adminRouter.get("/users/:id", validate(mongoIdSchema, "params"), getUserDetail);
adminRouter.put("/users/:id", validate(mongoIdSchema, "params"), updateUser);
adminRouter.delete("/users/:id", validate(mongoIdSchema, "params"), deleteUser);
adminRouter.put("/users/:id/ban", validate(mongoIdSchema, "params"), banUser);

// Analyses
adminRouter.get("/analyses", getAnalyses);
adminRouter.delete("/analyses/:id", validate(mongoIdSchema, "params"), deleteAnalysis);

// Keywords
adminRouter.get("/keywords", getKeywords);
adminRouter.delete("/keywords/:id", validate(mongoIdSchema, "params"), deleteKeyword);

// Audit Log
adminRouter.get("/audit-log", getAuditLog);

// Settings
adminRouter.get("/settings", getSettings);
adminRouter.put("/settings", updateSettings);

// Notifications
adminRouter.post("/notifications/bulk", sendBulkNotification);

export default adminRouter;
