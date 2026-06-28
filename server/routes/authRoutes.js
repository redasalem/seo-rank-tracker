import express from "express";
import { getCurrentUser, login, logout, register, updateProfile, updatePassword, forgotPassword, resetPassword, refreshToken, deleteAccount } from "../controllers/authControllers.js";
import auth from "../middleware/auth.js";
import { validate, registerSchema, loginSchema, updateProfileSchema, updatePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from "../middleware/validations.js";

const authRouter = express.Router();


authRouter.post('/register', validate(registerSchema), register);

authRouter.post('/login', validate(loginSchema), login);

authRouter.post('/logout', logout);

authRouter.get('/refresh', refreshToken);

authRouter.get('/getCurrentUser', auth, getCurrentUser);

authRouter.put('/profile', auth, validate(updateProfileSchema), updateProfile);

authRouter.put('/password', auth, validate(updatePasswordSchema), updatePassword);

authRouter.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);

authRouter.post('/reset-password/:token', validate(resetPasswordSchema), resetPassword);

authRouter.delete('/account', auth, deleteAccount);

export default authRouter;









