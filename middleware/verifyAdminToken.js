// middleware/verifyAdminToken.js
const jwt = require("jsonwebtoken");
const { AdminUser } = require("../models/AdminUser");

async function verifyAdminToken(req, res, next) {
  try {
    let token = null;

    // Prefer Bearer
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) token = auth.slice(7);

    // Fallback: cookie
    if (!token && req.cookies?.adminToken) token = req.cookies.adminToken;

    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    const admin = await AdminUser.findById(decoded.id).select("-password");
    if (!admin || !admin.isActive)
      return res.status(403).json({ message: "Unauthorized" });

    req.admin = admin; // make admin available to next handlers
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token invalid or expired" });
  }
}

module.exports = { verifyAdminToken };
