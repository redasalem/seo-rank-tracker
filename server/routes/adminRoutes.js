import express from "express";
import auth from "../middleware/auth.js";
import admin from "../middleware/admin.js";
import { getStats, getUsers, updateUser } from "../controllers/adminControllers.js";

const adminRouter = express.Router();

// All admin routes require authentication + admin role
adminRouter.use(auth, admin);

adminRouter.get("/stats", getStats);
adminRouter.get("/users", getUsers);
adminRouter.put("/users/:id", updateUser);

export default adminRouter;
