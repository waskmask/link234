// middleware/adminRoles.js
function allowAdminRoles(...roles) {
  return (req, res, next) => {
    // verifyAdminToken must run before this to set req.admin
    if (!req.admin) return res.status(401).json({ message: "Unauthorized" });
    if (!roles.includes(req.admin.role))
      return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

module.exports = { allowAdminRoles };
