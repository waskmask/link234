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

module.exports = router;
