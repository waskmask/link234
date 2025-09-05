// apis/routes/membershipPayRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/membershipPayController");
const MembershipPurchase = require("../models/MembershipPurchase");
const auth = require("../middleware/authMiddleware"); // your app user token/cookie

router.post("/start", auth, ctrl.startPayment);

router.get("/purchase/:id", auth, async (req, res) => {
  const p = await MembershipPurchase.findOne({
    _id: req.params.id,
    user: req.user._id,
  }) // ✅ ownership check
    .populate("plan", "displayName slug")
    .select(
      "provider providerRef currency baseAmountMinor discountMinor finalAmountMinor region paid"
    );
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json({
    id: p._id,
    provider: p.provider,
    transactionId: p.providerRef, // payment_id (Razorpay) or PI id (Stripe)
    currency: p.currency,
    baseAmountMinor: p.baseAmountMinor,
    discountMinor: p.discountMinor,
    finalAmountMinor: p.finalAmountMinor,
    planName: p.plan?.displayName || p.plan?.slug,
    region: p.region,
    paid: p.paid,
  });
});

// GET /api/membership/me/last-purchase
router.get("/me/last-purchase", auth, async (req, res) => {
  const p = await MembershipPurchase.findOne({ user: req.user._id, paid: true })
    .sort({ createdAt: -1 })
    .select(
      "provider providerRef currency finalAmountMinor baseAmountMinor discountMinor region plan"
    )
    .populate("plan", "displayName slug");
  if (!p) return res.status(404).json({ message: "No purchases" });
  res.json({
    provider: p.provider,
    transactionId: p.providerRef, // <- real one
    currency: p.currency,
    finalAmountMinor: p.finalAmountMinor,
    baseAmountMinor: p.baseAmountMinor,
    discountMinor: p.discountMinor,
    region: p.region,
    planName: p.plan?.displayName || p.plan?.slug || "Membership",
  });
});

module.exports = router;
