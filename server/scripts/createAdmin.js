import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.js";

dotenv.config();

const ADMIN_EMAIL = "admin@rank2026.com";
const ADMIN_PASSWORD = "YMZgiet!Vso*kgtq&im$";

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("✅ Connected to MongoDB");

    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      console.log("⚠️ Admin already exists — no changes made");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    await User.create({
      email: ADMIN_EMAIL,
      name: "RankBoost Admin",
      password: hashedPassword,
      role: "admin",
      plan: "max",
      isEmailVerified: true,
      isVerified: true,
    });

    console.log("✅ Admin account created successfully!");
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
    console.log("⚠️  SAVE THIS PASSWORD — it will not be shown again!");

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();
