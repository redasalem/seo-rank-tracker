import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import User from "../models/User.js";

dotenv.config();

const MONGODB_URL = process.env.MONGODB_URL;
if (!MONGODB_URL) {
    console.error("❌ MONGODB_URL environment variable is missing.");
    process.exit(1);
}

async function run() {
    try {
        await mongoose.connect(MONGODB_URL);
        const email = `admin-temp-${Date.now()}@rankboost-test.com`;
        
        // Generate a random secure password
        const password = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '') + "1!aA";
        const hashedPassword = await bcrypt.hash(password, 12);

        await User.create({
            email,
            name: "Temp Admin",
            password: hashedPassword,
            role: "admin",
            plan: "max",
            isEmailVerified: true,
            isVerified: true
        });

        console.log("✅ Temporary admin account successfully created!");
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
        console.log("⚠️  Copy this password now — it is not stored in plaintext anywhere.");
    } catch (e) {
        console.error("❌ Failed to create admin:", e.message);
    } finally {
        await mongoose.disconnect();
    }
}
run();
