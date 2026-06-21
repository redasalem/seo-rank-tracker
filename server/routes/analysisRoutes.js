import express from "express";
import { startAnalysis, getAnalysis, getUserAnalyses } from "../controllers/analysisControllers.js";
import auth from "../middleware/auth.js";
import { validate, startAnalysisSchema, mongoIdSchema } from "../middleware/validations.js";

const analysisRouter = express.Router();

// Apply auth middleware to all routes
analysisRouter.use(auth);

// Routes
analysisRouter.get("/", getUserAnalyses);
analysisRouter.post("/start", validate(startAnalysisSchema), startAnalysis);
analysisRouter.get("/:id", validate(mongoIdSchema, "params"), getAnalysis);

export default analysisRouter;
