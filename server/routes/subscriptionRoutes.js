import express from "express";
import auth from "../middleware/auth.js";
import { createCheckoutSession, stripeWebhook, createPortalSession } from "../controllers/subscriptionControllers.js";

const router = express.Router();

// Private route
router.post("/create-checkout-session", auth, createCheckoutSession);
router.post("/create-portal-session", auth, createPortalSession);

// Webhook is public (Stripe sends data here)
// Note: webhook logic is handled in the controller and needs raw body
// We define it here without auth middleware
// app.post("/api/subscription/webhook") is defined in server.js directly

export default router;
