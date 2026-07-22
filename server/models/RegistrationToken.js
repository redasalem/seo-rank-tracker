import mongoose from "mongoose";

const registrationTokenSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    token: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // expires in 1 hour
    }
});

export default mongoose.model("RegistrationToken", registrationTokenSchema);
