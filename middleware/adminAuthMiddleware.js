// middleware/adminAuthMiddleware.js
const jwt = require("jsonwebtoken");
const { AdminUser } = require("../models/AdminUser");

module.exports = async (req, res, next) => {
  try {
    let token = null;
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) token = auth.slice(7);
    if (!token && req.cookies?.adminToken) token = req.cookies.adminToken;

    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    const admin = await AdminUser.findById(decoded.id).select("-password");
    if (!admin) return res.status(403).json({ message: "Unauthorized" });

    req.admin = admin;
    next();
  } catch {
    res.status(401).json({ message: "Token invalid or expired" });
  }
};
