import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const mongoUrl = process.env.MONGODB_URL;
        if (!mongoUrl) {
            throw new Error("MONGODB_URL is not defined in .env");
        }

        mongoose.connection.on("connected", () => {
            console.log("mongoDB connected !");
        });

        mongoose.connection.on("error", (err) => {
            console.error("MongoDB connection error:", err);
        });

        await mongoose.connect(mongoUrl);
    } catch (error) {
        console.error("Failed to connect to MongoDB:", error);
        process.exit(1);
    }
};

export default connectDB;
