// apis/routes/couponAdminRoutes.js
const express = require("express");
const router = express.Router();
const Coupon = require("../models/Coupon");
const { verifyAdminToken } = require("../middleware/verifyAdminToken");
const { allowAdminRoles } = require("../middleware/adminRoles");

router.post(
  "/",
  verifyAdminToken,
  allowAdminRoles("superadmin", "admin", "sales", "moderator"),
  async (req, res) => {
    try {
      const body = req.body || {};
      body.code = String(body.code || "")
        .toUpperCase()
        .trim();
      const exists = await Coupon.findOne({ code: body.code });
      if (exists) return res.status(409).json({ message: "Code exists." });

      const c = await Coupon.create(body);
      res.status(201).json({ message: "Coupon created.", coupon: c });
    } catch (e) {
      res.status(500).json({ message: "Failed to create coupon." });
    }
  }
);

// toggle coupon status
// Toggle isActive
router.patch(
  "/:id/toggle",
  verifyAdminToken,
  allowAdminRoles("superadmin", "admin", "sales", "moderator"),
  async (req, res) => {
    try {
      const couponId = req.params.id;
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        return res.status(400).json({ message: "isActive must be boolean." });
      }

      const coupon = await Coupon.findByIdAndUpdate(
        couponId,
        { isActive },
        { new: true }
      );

      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found." });
      }

      res.json({
        message: `Coupon ${
          isActive ? "activated" : "deactivated"
        } successfully.`,
        coupon,
      });
    } catch (e) {
      console.error("Toggle coupon error:", e);
      res.status(500).json({ message: "Failed to toggle coupon." });
    }
  }
);

router.post("/validate", async (req, res) => {
  try {
    const raw = String(req.body.code || "").trim();
    if (!raw)
      return res.status(400).json({ valid: false, reason: "CODE_REQUIRED" });

    const code = raw.toUpperCase();
    const coupon = await Coupon.findOne({ code }).lean();

    if (!coupon)
      return res.status(404).json({ valid: false, reason: "NOT_FOUND" });

    if (!coupon.isActive) {
      return res.status(200).json({ valid: false, reason: "INACTIVE" });
    }

    // (Optional future checks – keep but inactive by default)
    const now = new Date();
    if (coupon.startsAt && now < new Date(coupon.startsAt)) {
      return res.status(200).json({ valid: false, reason: "NOT_STARTED" });
    }
    if (coupon.endsAt && now > new Date(coupon.endsAt)) {
      return res.status(200).json({ valid: false, reason: "EXPIRED" });
    }

    // Minimal coupon snapshot for UI (avoid exposing internals)
    const snapshot = {
      id: String(coupon._id),
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxDiscountMinor: coupon.maxDiscountMinor || 0,
    };

    return res.status(200).json({ valid: true, coupon: snapshot });
  } catch (err) {
    console.error("Coupon validate error:", err);
    return res.status(500).json({ valid: false, reason: "SERVER_ERROR" });
  }
});

// List coupons with pagination, optional search and filters
router.get(
  "/",
  verifyAdminToken,
  allowAdminRoles("superadmin", "admin", "sales", "moderator"),
  async (req, res) => {
    try {
      // query params
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 20, 1),
        200
      );
      const q = (req.query.q || "").trim();
      const sort = (req.query.sort || "-createdAt").trim(); // e.g. "code" or "-createdAt"
      const isActiveParam = req.query.isActive;

      // build filter
      const filter = {};
      if (q) {
        filter.$or = [
          { code: { $regex: q, $options: "i" } },
          { name: { $regex: q, $options: "i" } }, // if you have a name/label
          { description: { $regex: q, $options: "i" } }, // if you store description
        ];
      }
      if (typeof isActiveParam !== "undefined") {
        // accepts "true"/"false" or boolean
        filter.isActive = String(isActiveParam).toLowerCase() === "true";
      }

      const skip = (page - 1) * limit;

      // query
      const [items, total] = await Promise.all([
        Coupon.find(filter)
          .sort(sort) // "-createdAt" newest first
          .skip(skip)
          .limit(limit)
          .lean(),
        Coupon.countDocuments(filter),
      ]);

      const pages = Math.max(Math.ceil(total / limit), 1);

      return res.json({
        page,
        pages,
        limit,
        total,
        items,
      });
    } catch (e) {
      console.error("List coupons error:", e);
      return res.status(500).json({ message: "Failed to fetch coupons." });
    }
  }
);

module.exports = router;
