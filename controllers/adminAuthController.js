// controllers/adminAuthController.js
const { AdminUser } = require("../models/AdminUser");
const jwt = require("jsonwebtoken");

const isProd = process.env.NODE_ENV === "production";
const CROSS_SITE = process.env.CROSS_SITE === "true";

const cookieOpts = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: CROSS_SITE ? "none" : "lax",
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
});

const generateAdminToken = (admin) =>
  jwt.sign({ id: admin._id, role: admin.role }, process.env.ADMIN_JWT_SECRET, {
    expiresIn: "1d",
  });

exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const exists = await AdminUser.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Email already registered" });

    const admin = new AdminUser({ name, email, password, role });
    await admin.save();
    res.status(201).json({ message: "Admin created successfully", admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await AdminUser.findOne({ email }).select("+password");
    if (!admin) return res.status(400).json({ message: "Invalid credentials" });

    const ok = await admin.comparePassword(password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });
    if (!admin.isActive)
      return res.status(403).json({ message: "Account is inactive" });

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = generateAdminToken(admin);
    res.cookie("adminToken", token, cookieOpts());
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const base = { ...cookieOpts(), maxAge: 0 };
    res.clearCookie("adminToken", base);
    res.clearCookie("adminToken", { ...base, domain: undefined });
    res.clearCookie("adminToken", { ...base, path: req.baseUrl || "/" });
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const admin = await AdminUser.findById(req.admin.id).select("+password");
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const ok = await admin.comparePassword(oldPassword);
    if (!ok) return res.status(400).json({ message: "Old password incorrect" });

    admin.password = newPassword;
    await admin.save();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
