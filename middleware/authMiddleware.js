// API: middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // adjust path if needed

module.exports = async (req, res, next) => {
  try {
    let token = null;

    // Prefer Bearer
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) token = auth.slice(7);

    // Fallback: cookie
    if (!token && req.cookies?.token) token = req.cookies.token;

    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Load a fresh user doc (safer than just decoded payload)
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(403).json({ message: "Unauthorized" });

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalid or expired" });
  }
};
