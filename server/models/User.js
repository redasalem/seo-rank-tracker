import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
    name: {type: String , required: true , trim: true},
    email: {type: String , required: true , trim: true , unique :true , lowercase: true},
    password: {type: String , required: true },
    plan: {type:String , enum: ["free" , "pro", "max"],default:"free"},
    role: {type: String, enum: ["user", "admin"], default: "user"},
    analysisCount: {type:Number,default:0},
    lastAnalysisDate: {type:Date , default:null},
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    isEmailVerified: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: null },

},{timestamps:true})

const User = mongoose.model("User", userSchema);

export default User;