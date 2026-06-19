import express from "express";
import auth from '../middleware/auth.js';
import { getNotifications, markAsRead, markAllAsRead } from "../controllers/notificationControllers.js";

const router = express.Router();

router.get("/", auth, getNotifications);
router.put("/read-all", auth, markAllAsRead);
router.put("/:id/read", auth, markAsRead);

export default router;
