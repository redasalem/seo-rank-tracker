import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import rankRouter from "./routes/rankRoutes.js";
import analysisRouter from "./routes/analysisRoutes.js";
import cronRouter from "./routes/cronRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import { startCronJobs } from "./jobs/scheduler.js";

if (process.env.NODE_ENV !== 'test') {
    await connectDB();
}

//init app
const app = express();

// Trust proxy for Vercel (needed for rate limiter to get correct IP)
app.set('trust proxy', 1);

// CORS Protection
app.use(cors({
    origin: [
        "http://localhost:5173", // Local frontend
        process.env.FRONTEND_URL || "https://seo-rank-tracer-client.vercel.app" // Production frontend
    ],
    credentials: true
}));

// Global Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per window
    message: { message: "Too many requests from this IP, please try again after 15 minutes" },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

// Apply rate limiting to all API requests
app.use("/api", limiter);

import subscriptionRouter from "./routes/subscriptionRoutes.js";
import { stripeWebhook } from "./controllers/subscriptionControllers.js";

// Stripe Webhook MUST be before express.json() to keep the raw body
app.post("/api/subscription/webhook", express.raw({ type: "application/json" }), stripeWebhook);

// middleware
app.use(express.json());
app.use(cookieParser());


app.get("/",(req,res)=>{
    res.send("server is running");
})

//auth endpoint

app.use("/api/auth",authRouter);
app.use("/api/rank", rankRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/cron", cronRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/subscription", subscriptionRouter);
app.use("/api/admin", adminRouter);


const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server Is running on port ${PORT}`);
        
        // Disable node-cron if running on Vercel (Vercel uses its own cron via /api/cron)
        if (!process.env.VERCEL) {
            startCronJobs();
        }
    });
}

// Export for Vercel serverless
export default app;
