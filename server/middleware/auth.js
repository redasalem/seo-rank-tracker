import jwt from "jsonwebtoken";


const auth = (req,res,next)=>{
    try{
        let token;

        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith("Bearer")) {
            token = authHeader.split(" ")[1];
        }
        else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }
        else{
            res.status(401).json({ message: "Not authorized, no token found" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.userId = decoded.id

        if (!req.user) {
            return res.status(404).json({ message: "User not found with this token" });
        }

        next();

  } catch (error) {
        console.error("Auth Middleware Error:", error.message);
        
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Unauthorized, token has expired" });
        }
        
        return res.status(401).json({ message: "Not authorized, invalid token" });
    }

}

export default auth;