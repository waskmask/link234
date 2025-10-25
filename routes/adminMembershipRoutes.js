// apis/routes/membershipPayRoutes.js
const express = require("express");
const router = express.Router();
const MembershipPurchase = require("../models/MembershipPurchase");
const adminAuth = require("../middleware/adminAuthMiddleware");

// Get all membership purchases admin
router.get("/all/purchases", adminAuth, async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const q = {};
  if (req.query.user) q.user = req.query.user; // user id
  if (req.query.provider) q.provider = req.query.provider; // 'stripe' | 'razorpay'
  if (req.query.paid !== undefined) q.paid = req.query.paid === "true";
  if (req.query.from || req.query.to) {
    q.createdAt = {};
    if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) q.createdAt.$lte = new Date(req.query.to);
  }

  const [items, total] = await Promise.all([
    MembershipPurchase.find(q)
      .populate("user", "username email")
      .populate("plan", "displayName slug ")
      .select(
        "provider providerRef currency couponCode durationDays baseAmountMinor discountMinor finalAmountMinor region paid createdAt"
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    MembershipPurchase.countDocuments(q),
  ]);

  res.json({
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    items: items.map((p) => ({
      id: p._id,
      user: p.user
        ? { id: p.user._id, username: p.user.username, email: p.user.email }
        : null,
      planName: p.plan?.displayName || p.plan?.slug,
      durationDays: p.durationDays ?? p.duration ?? null,
      couponCode: p.couponCode ?? p.couponCode ?? null,
      provider: p.provider,
      transactionId: p.providerRef,
      currency: p.currency,
      baseAmountMinor: p.baseAmountMinor,
      discountMinor: p.discountMinor,
      finalAmountMinor: p.finalAmountMinor,
      region: p.region,
      paid: p.paid,
      createdAt: p.createdAt,
    })),
  });
});

module.exports = router;
