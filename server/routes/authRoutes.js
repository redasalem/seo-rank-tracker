import express from "express";
import { getCurrentUser, register, login, logout, requestRegistration, completeRegistration, updateProfile, updatePassword, forgotPassword, resetPassword, refreshToken, deleteAccount, verifyEmail, resendVerification } from "../controllers/authControllers.js";
import auth from "../middleware/auth.js";
import { validate, registerSchema, requestRegistrationSchema, completeRegistrationSchema, loginSchema, updateProfileSchema, updatePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from "../middleware/validations.js";

const authRouter = express.Router();

authRouter.post('/register', validate(registerSchema), register);
authRouter.post('/request-registration', validate(requestRegistrationSchema), requestRegistration);
authRouter.post('/complete-registration', validate(completeRegistrationSchema), completeRegistration);

authRouter.post('/login', validate(loginSchema), login);

authRouter.post('/logout', logout);

authRouter.get('/verify-email/:token', verifyEmail);

authRouter.post('/resend-verification', resendVerification);

authRouter.get('/refresh', refreshToken);

authRouter.get('/getCurrentUser', auth, getCurrentUser);

authRouter.put('/profile', auth, validate(updateProfileSchema), updateProfile);

authRouter.put('/password', auth, validate(updatePasswordSchema), updatePassword);

authRouter.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);

authRouter.post('/reset-password/:token', validate(resetPasswordSchema), resetPassword);

authRouter.delete('/account', auth, deleteAccount);

export default authRouter;









