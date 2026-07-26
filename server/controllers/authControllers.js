import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import User from "../models/User.js";
import RegistrationToken from "../models/RegistrationToken.js";
import { sendEmail, sendVerificationEmail, sendMagicLinkEmail } from "../utils/emailService.js";
import KeywordTracking from "../models/keywordTracking.js";
import Analysis from "../models/analysisModel.js";
import Notification from "../models/Notification.js";
// Helper to check if SMTP is configured with real credentials
const isSmtpConfigured = () => {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) return false;
    if (smtpUser.includes("your_email") || smtpPass.includes("your_app_password")) return false;
    return true;
};

// ─── Direct Registration (1-Step Account Creation) ─────────────────────────
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email, and password are required" });
        }

        if (name.trim().length < 2) {
            return res.status(400).json({ message: "Name must be at least 2 characters long" });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]{3,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Please enter a valid email address." });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists with this email address" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const hasSmtp = isSmtpConfigured();

        // Create user (Auto-verify if SMTP is unconfigured so sign-up is not blocked)
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            isEmailVerified: !hasSmtp,
            isVerified: !hasSmtp
        });

        // Send verification email if SMTP is enabled
        if (hasSmtp) {
            const verificationToken = crypto.randomBytes(32).toString("hex");
            user.emailVerificationToken = verificationToken;
            await user.save();

            sendVerificationEmail(user.email, user.name, verificationToken).catch(err => {
                console.error("Failed to send verification email:", err.message);
            });

            return res.status(201).json({
                success: true,
                message: "Registration successful. Please check your email to verify your account.",
                notVerified: true
            });
        }

        // Auto login if SMTP is not configured
        const accessToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        const refreshToken = jwt.sign(
            { id: user._id },
            process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 15 * 60 * 1000
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(201).json({
            success: true,
            message: "Account created successfully",
            token: accessToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                role: user.role,
                analysisCount: user.analysisCount,
                reportFrequency: user.reportFrequency,
                language: user.language
            }
        });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ message: "Server error during registration" });
    }
};

// ─── Magic Link Registration ────────────────────────────────────────────────
export const requestRegistration = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]{3,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Please enter a valid and secure email address." });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Generate magic link token
        const token = crypto.randomBytes(32).toString("hex");

        // Save token to DB
        await RegistrationToken.findOneAndUpdate(
            { email },
            { token, createdAt: Date.now() },
            { upsert: true, new: true }
        );

        // Send Magic Link Email
        await sendMagicLinkEmail(email, token);

        res.status(200).json({
            success: true,
            message: "Registration link sent. Please check your email.",
        });
    } catch (error) {
        console.error("Error requesting registration:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export const completeRegistration = async (req, res) => {
    try {
        const { token, name, password } = req.body;

        if (!token || !name || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Strict Name Validation
        if (name.trim().length < 3) {
            return res.status(400).json({ message: "Name must be at least 3 characters long" });
        }

        // Strict Password Validation
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        // Find token record
        const tokenRecord = await RegistrationToken.findOne({ token });
        if (!tokenRecord) {
            return res.status(400).json({ message: "Invalid or expired registration link. Please try again." });
        }

        const email = tokenRecord.email;

        // Check again if user exists just in case
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            await RegistrationToken.deleteOne({ token });
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            isEmailVerified: true,
            isVerified: true
        });

        // Delete the used token
        await RegistrationToken.deleteOne({ token });

        // Auto login
        const authToken = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            success: true,
            message: "Registration complete",
            token: authToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                plan: user.plan
            }
        });
    } catch (error) {
        console.error("Error completing registration:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ─── Login ───────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Check if user is banned
        if (user.isBanned) {
            return res.status(403).json({ message: "Your account has been suspended. Contact support for assistance." });
<<<<<<< HEAD
=======
        }

        // Auto-verify if SMTP is unconfigured so users are never locked out
        if (!user.isEmailVerified && !isSmtpConfigured()) {
            user.isEmailVerified = true;
            user.isVerified = true;
            await user.save();
>>>>>>> a8b6a3d3df0a501c22c709569f853b29bff9b9b3
        }

        // Check if email is verified
        if (!user.isEmailVerified) {
            return res.status(403).json({ 
                message: "Please verify your email address to log in.",
                notVerified: true
            });
        }


        // Update last login timestamp
        user.lastLoginAt = new Date();
        await user.save();

        // Generate Access Token (short lived)
        const accessToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        // Generate Refresh Token (long lived)
        const refreshToken = jwt.sign(
            { id: user._id },
            process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Set Access Token in HttpOnly Cookie
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 15 * 60 * 1000 // 15 mins
        });

        // Set Refresh Token in HttpOnly Cookie
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(200).json({
            success: true,
            message: "Login successful",
            token: accessToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                role: user.role,
                analysisCount: user.analysisCount,
                reportFrequency: user.reportFrequency,
                language: user.language,
            },
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};


// ─── Get Current User ────────────────────────────────────────────────────────
export const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Reset count if it's a new day
        const today = new Date().toDateString();
        const lastAnalysisDate = user.lastAnalysisDate ? new Date(user.lastAnalysisDate).toDateString() : null;
        
        if (lastAnalysisDate !== today) {
            user.analysisCount = 0;
            await user.save();
        }

        res.status(200).json({ user });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};


// ─── Logout ──────────────────────────────────────────────────────────────────
export const logout = async (req, res) => {
    try {
        res.cookie("refreshToken", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            expires: new Date(0)
        });
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// ─── Update Profile ──────────────────────────────────────────────────────────
export const updateProfile = async (req, res) => {
    try {
        const { name, email, reportFrequency, language } = req.body;
        const userId = req.user.id;

        if (!name || !email) {
            return res.status(400).json({ message: "Name and email are required" });
        }

        // Strict Name Validation
        if (name.trim().length < 3) {
            return res.status(400).json({ message: "Name must be at least 3 characters long" });
        }

        // Strict Email Validation (Prevent r@gmail.com by requiring min prefix length)
        const emailRegex = /^[a-zA-Z0-9._%+-]{3,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Please enter a valid and secure email address." });
        }

        // Check if email is being changed and if it already exists
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
            return res.status(409).json({ message: "Email is already in use by another account" });
        }

        const currentUser = await User.findById(userId);
        if (!currentUser) {
            return res.status(404).json({ message: "User not found" });
        }

        let newFrequency = reportFrequency || currentUser.reportFrequency || "off";
        if (currentUser.plan === "free" && newFrequency === "monthly") {
            return res.status(400).json({ message: "Monthly reports are only available on Pro or Max plans." });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { name, email, reportFrequency: newFrequency, language: language || currentUser.language || "en" },
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "Profile updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                role: user.role,
                analysisCount: user.analysisCount,
                reportFrequency: user.reportFrequency,
                language: user.language,
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// ─── Update Password ─────────────────────────────────────────────────────────
export const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current and new passwords are required" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "New password must be at least 6 characters long" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect current password" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// ─── Forgot Password ────────────────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "Email is not registered" });
        }

        // Generate clean random token
        const token = crypto.randomBytes(32).toString("hex");

        // Save token & expiry to user schema
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour validity
        await user.save();

        // Prepare reset link
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const resetUrl = `${frontendUrl}/reset-password/${token}`;

        // Send Email
        const emailContent = {
            to: user.email,
            subject: "Password Reset Request - RankBoost",
            text: `You requested a password reset. Please click on the link below or paste it into your browser to reset your password:\n\n${resetUrl}\n\nThis link is valid for 1 hour. If you did not request this, please ignore this email.`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #1f2937;">Password Reset Request</h2>
                    <p style="color: #4b5563;">You requested a password reset for your RankBoost account. Click the button below to set a new password:</p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">This link is valid for 1 hour. If the button above doesn't work, copy and paste this URL into your browser:</p>
                    <p style="color: #2563eb; font-size: 14px; word-break: break-all;">${resetUrl}</p>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                    <p style="color: #9ca3af; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
                </div>
            `
        };

        const mailResult = await sendEmail(emailContent);

        // Return a response
        const responseData = {
            message: "If this email exists, a reset link has been sent."
        };

        res.status(200).json(responseData);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// ─── Reset Password ─────────────────────────────────────────────────────────
export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Password reset token is invalid or has expired" });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password and clear reset token fields
        user.password = hashedPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};


// ─── Refresh Token ──────────────────────────────────────────────────────────
export const refreshToken = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        if (!token) {
            return res.status(401).json({ message: "No refresh token provided" });
        }

        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET);
        
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        // Issue new access token
        const accessToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        res.status(200).json({
            message: "Token refreshed successfully",
            token: accessToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                role: user.role,
                analysisCount: user.analysisCount,
                reportFrequency: user.reportFrequency
            }
        });

    } catch (error) {
        return res.status(403).json({ message: "Invalid or expired refresh token", error: error.message });
    }
};


// ─── Delete Account ─────────────────────────────────────────────────────────
export const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user.id;

        if (!password) {
            return res.status(400).json({ message: "Password is required to delete account" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        // Cancel Stripe subscription if user has one
        if (user.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
            try {
                const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
                await stripe.subscriptions.cancel(user.stripeSubscriptionId);
                console.log(`✅ Stripe subscription cancelled for user ${userId}`);
            } catch (stripeErr) {
                console.error("Failed to cancel Stripe subscription:", stripeErr.message);
                // Continue with deletion even if Stripe cancellation fails
            }
        }

        // Delete all user data
        await Promise.all([
            User.findByIdAndDelete(userId),
            KeywordTracking.deleteMany({ userId }),
            Analysis.deleteMany({ userId }),
            Notification.deleteMany({ user: userId })
        ]);

        // Clear refresh token cookie
        res.cookie("refreshToken", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            expires: new Date(0)
        });

        res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// ─── Verify Email ────────────────────────────────────────────────────────────
export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        const user = await User.findOne({ emailVerificationToken: token });

        if (!user) {
            return res.status(400).json({ message: "Invalid or expired verification token." });
        }

        user.isEmailVerified = true;
        user.isVerified = true;
        user.emailVerificationToken = undefined;
        await user.save();

        res.status(200).json({ success: true, message: "Email verified successfully. You can now log in." });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

// ─── Resend Verification Email ────────────────────────────────────────────────
export const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required." });
        }

        const user = await User.findOne({ email });

        if (!user) {
            // Return success even if not found to prevent email enumeration
            return res.status(200).json({ success: true, message: "If an account exists with this email, a verification link has been sent." });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ message: "This email is already verified. Please log in." });
        }

        // Generate new token
        const verificationToken = crypto.randomBytes(32).toString("hex");
        user.emailVerificationToken = verificationToken;
        await user.save();

        // Send Email
        await sendVerificationEmail(user.email, user.name, verificationToken);

        res.status(200).json({ success: true, message: "Verification email resent. Please check your inbox." });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
