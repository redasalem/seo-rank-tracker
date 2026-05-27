import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./config/db.js";

await connectDB();

//init app
const app = express();

app.use(cors());

// middleware
app.use(express.json());

app.get("/",(req,res)=>{
    res.send("server is running");
})


const PORT = process.env.PORT || 5000;

app.listen(PORT,()=>{
console.log(`Server Is running on port ${PORT}`);
})

