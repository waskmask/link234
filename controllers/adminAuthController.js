// controllers/adminAuthController.js
const { AdminUser } = require("../models/AdminUser");
const jwt = require("jsonwebtoken");

const isProd = process.env.NODE_ENV === "production";
const CROSS_SITE = String(process.env.CROSS_SITE).toLowerCase() === "true";

const allowList = (process.env.API_URL_WHITELIST || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const cookieOpts = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: CROSS_SITE ? "none" : "lax",
  path: "/",
  maxAge: 24 * 60 * 60 * 1000,
  domain: process.env.FRONT_COOKIE_DOMAIN || undefined,
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

    // ---- CRITICAL: manually set CORS headers on this response ----
    const origin = req.headers.origin;
    if (allowList.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin); // exact origin
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.logout = async (req, res) => {
  const base = cookieOpts({ maxAge: 0 });

  // Clear on exact origin
  res.clearCookie("adminToken", base);

  // Also clear on shared parent (in case it was set there)
  if (process.env.FRONT_COOKIE_DOMAIN) {
    res.clearCookie("adminToken", {
      ...base,
      domain: process.env.FRONT_COOKIE_DOMAIN,
    });
  }

  const origin = req.headers.origin;
  if (allowList.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");

  res.json({ success: true });
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

exports.me = async (req, res) => {
  const admin = await AdminUser.findById(req.admin.id).select(
    "_id name email role isActive lastLoginAt createdAt"
  );
  if (!admin) return res.status(404).json({ message: "not_found" });
  res.json({ admin });
};

exports.toggleActive = async (req, res) => {
  try {
    const targetId = req.params.id;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be boolean" });
    }

    if (targetId === req.admin.id) {
      return res
        .status(400)
        .json({ message: "You cannot toggle your own active status" });
    }

    const target = await AdminUser.findById(targetId);
    if (!target) return res.status(404).json({ message: "Admin not found" });

    target.isActive = isActive;
    await target.save();

    res.json({
      message: `Admin ${target.email} is now ${
        isActive ? "active" : "inactive"
      }`,
      admin: {
        _id: target._id,
        name: target.name,
        email: target.email,
        role: target.role,
        isActive: target.isActive,
        updatedAt: target.updatedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Change own password (must provide old password).
 * Body: { oldPassword: string, newPassword: string }
 */
exports.changeOwnPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "oldPassword and newPassword required" });
    }

    const admin = await AdminUser.findById(req.admin.id).select("+password");
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const ok = await admin.comparePassword(oldPassword);
    if (!ok) return res.status(400).json({ message: "Old password incorrect" });

    // (Optional) add your own strength checks here
    admin.password = newPassword;
    await admin.save();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Change another admin's password (Admin or Super Admin).
 * - Cannot target self here; use change-own-password route for that.
 * Body: { newPassword: string }
 */
exports.changeOtherPassword = async (req, res) => {
  try {
    const targetId = req.params.id;
    const { newPassword } = req.body || {};

    if (!newPassword) {
      return res.status(400).json({ message: "newPassword required" });
    }

    if (targetId === req.admin.id) {
      return res
        .status(400)
        .json({ message: "Use /change-own-password to change your password" });
    }

    const target = await AdminUser.findById(targetId).select("+password");
    if (!target) return res.status(404).json({ message: "Admin not found" });

    target.password = newPassword;
    await target.save();

    res.json({ message: `Password updated for ${target.email}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const SAFE_SELECT = "_id name email role isActive createdAt updatedAt";

exports.listAdmins = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page ?? "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit ?? "20", 10), 1),
      100
    );
    const q = (req.query.q || "").trim();
    const role = (req.query.role || "").trim().toLowerCase(); // optional filter
    const status = (req.query.status || "").trim().toLowerCase(); // "active" | "inactive"

    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }
    if (role) {
      filter.role = role; // e.g., "admin" | "superadmin"
    }
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    const [items, total] = await Promise.all([
      AdminUser.find(filter)
        .select(SAFE_SELECT)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AdminUser.countDocuments(filter),
    ]);

    res.json({
      items,
      page,
      limit,
      total,
    });
  } catch (err) {
    console.error("[GET /admins] error:", err);
    res.status(500).json({ message: "failed_to_list_admins" });
  }
};

exports.getAdminById = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await AdminUser.findById(id).select(SAFE_SELECT).lean();
    if (!admin) return res.status(404).json({ message: "not_found" });
    res.json({ admin });
  } catch (err) {
    console.error("[GET /admins/:id] error:", err);
    res.status(500).json({ message: "failed_to_get_admin" });
  }
};
