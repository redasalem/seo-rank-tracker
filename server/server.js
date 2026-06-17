import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import rankRouter from "./routes/rankRoutes.js";
import analysisRouter from "./routes/analysisRoutes.js";
import cronRouter from "./routes/cronRoutes.js";
import { startCronJobs } from "./jobs/scheduler.js";
await connectDB();

//init app
const app = express();

app.use(cors());

// middleware
app.use(express.json());


app.get("/",(req,res)=>{
    res.send("server is running");
})

//auth endpoint

app.use("/api/auth",authRouter);
app.use("/api/rank", rankRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/cron", cronRouter);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server Is running on port ${PORT}`);
    
    // Disable node-cron if running on Vercel (Vercel uses its own cron via /api/cron)
    if (!process.env.VERCEL) {
        startCronJobs();
    }
});

