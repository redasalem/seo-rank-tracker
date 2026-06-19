import express from "express";
import auth from "../middleware/auth.js";
import { createCheckoutSession, stripeWebhook } from "../controllers/subscriptionControllers.js";

const router = express.Router();

// Private route
router.post("/create-checkout-session", auth, createCheckoutSession);

// Webhook is public (Stripe sends data here)
// Note: webhook logic is handled in the controller and needs raw body
// We define it here without auth middleware
// app.post("/api/subscription/webhook") is defined in server.js directly

export default router;
