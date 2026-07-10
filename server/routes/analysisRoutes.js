import express from "express";
import { startAnalysis, getAnalysis, getUserAnalyses, generateAiInsights } from "../controllers/analysisControllers.js";
import auth from "../middleware/auth.js";
import { validate, startAnalysisSchema, mongoIdSchema } from "../middleware/validations.js";

const analysisRouter = express.Router();

// Apply auth middleware to all routes
analysisRouter.use(auth);

// Routes
analysisRouter.get("/", getUserAnalyses);
analysisRouter.post("/start", validate(startAnalysisSchema), startAnalysis);
analysisRouter.get("/:id", validate(mongoIdSchema, "params"), getAnalysis);
analysisRouter.post("/:id/ai-insights", validate(mongoIdSchema, "params"), generateAiInsights);

export default analysisRouter;
