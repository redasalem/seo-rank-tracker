import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendEmail } from "../utils/emailService.js";
import KeywordTracking from "../models/keywordTracking.js";
import Analysis from "../models/analysisModel.js";
import Notification from "../models/Notification.js";
// ─── Register ────────────────────────────────────────────────────────────────
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user (auto-verified, no email confirmation needed)
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            isEmailVerified: true,
            isVerified: true
        });

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

        res.status(201).json({
            success: true,
            message: "User registered successfully.",
            token: accessToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                plan: user.plan,
                role: user.role,
            },
        });
    } catch (error) {
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
        const { name, email } = req.body;
        const userId = req.user.id;

        if (!name || !email) {
            return res.status(400).json({ message: "Name and email are required" });
        }

        // Check if email is being changed and if it already exists
        const existingUser = await User.findOne({ email, _id: { $ne: userId } });
        if (existingUser) {
            return res.status(409).json({ message: "Email is already in use by another account" });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { name, email },
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
                analysisCount: user.analysisCount
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
