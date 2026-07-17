import express from "express";
import auth from '../middleware/auth.js';
import { validate, mongoIdSchema } from '../middleware/validations.js';
import { getNotifications, markAsRead, markAllAsRead } from "../controllers/notificationControllers.js";

const router = express.Router();

router.get("/", auth, getNotifications);
router.put("/read-all", auth, markAllAsRead);
router.put("/:id/read", auth, validate(mongoIdSchema, "params"), markAsRead);

export default router;
