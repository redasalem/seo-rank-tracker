import express from "express";
import { getCurrentUser, login, logout, register } from "../controllers/authControllers.js";
import auth from "../middleware/auth.js";

const authRouter = express.Router();


authRouter.post('/register',register);

authRouter.post('/login',login);

authRouter.post('/logout',logout);

authRouter.get('/getCurrentUser',auth,getCurrentUser);


export default authRouter;










