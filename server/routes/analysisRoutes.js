import express from "express";
import { startAnalysis, getAnalysis } from "../controllers/analysisControllers.js";
import auth from "../middleware/auth.js";

const analysisRouter = express.Router();

// Apply auth middleware to all routes
analysisRouter.use(auth);

// Routes
analysisRouter.post("/start", startAnalysis);
analysisRouter.get("/:id", getAnalysis);

export default analysisRouter;
