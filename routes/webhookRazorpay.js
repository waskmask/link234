// apis/routes/webhookRazorpay.js
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const MembershipPurchase = require("../models/MembershipPurchase");
const Coupon = require("../models/Coupon");
const User = require("../models/User");
const { applyPaidPurchaseToUser } = require("../utils/membership");

// Simple in-memory de-dupe (optionally move to Mongo collection if needed)
const seenEvents = new Set();
const SEEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
setInterval(() => seenEvents.clear(), SEEN_TTL_MS);

router.post("/", express.raw({ type: "*/*" }), async (req, res) => {
  const signature = req.get("x-razorpay-signature");
  const eventId = req.get("x-razorpay-event-id"); // unique per event
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  try {
    if (!signature || !secret)
      return res.status(400).send("Missing signature/secret");

    // Verify HMAC SHA256 over raw body (as string)
    const body = req.body.toString("utf8");
    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");
    if (expected !== signature)
      return res.status(400).send("Invalid signature");

    // Idempotency guard
    if (eventId) {
      if (seenEvents.has(eventId))
        return res.status(200).json({ deduped: true });
      seenEvents.add(eventId);
    }

    const parsed = JSON.parse(body);
    const ev = parsed.event;
    const payload = parsed.payload || {};
    const order = payload.order?.entity;
    const payment = payload.payment?.entity;

    // Resolve purchaseId from either order.receipt ("mp_<id>") or payment.notes.purchaseId
    let purchaseId = "";
    if (order?.receipt?.startsWith("mp_"))
      purchaseId = order.receipt.replace("mp_", "");
    if (!purchaseId && payment?.notes?.purchaseId)
      purchaseId = String(payment.notes.purchaseId);

    // Handle success events
    if (ev === "order.paid" || ev === "payment.captured") {
      if (!purchaseId)
        return res
          .status(200)
          .json({ ok: true, note: "No purchaseId; ignored" });

      const p = await MembershipPurchase.findById(purchaseId).populate(
        "plan user"
      );
      if (!p)
        return res
          .status(200)
          .json({ ok: true, note: "Purchase not found; ignored" });
      if (p.paid)
        return res.status(200).json({ ok: true, note: "Already paid; dedupe" });

      // Optional sanity checks (uncomment if you store expected totals/currency on the purchase)
      // if (order?.amount && p.amount_cents && order.amount !== p.amount_cents) { ... }
      // if (order?.currency && p.currency && order.currency.toLowerCase() !== p.currency.toLowerCase()) { ... }

      p.paid = true;
      p.provider = "razorpay";
      p.providerRef = payment?.id || order?.id || "";
      await p.save();

      await applyPaidPurchaseToUser(p, "razorpay");

      if (p.couponCode) {
        await Coupon.updateOne(
          { code: String(p.couponCode).toUpperCase() },
          { $inc: { "stats.totalRedemptions": 1 } }
        );
      }

      const updatedUser = await User.findById(p.user._id).select("membership");
      console.log(
        "[RAZORPAY] Updated user membership:",
        updatedUser.membership
      );
    }

    // Optional: log failures
    if (ev === "payment.failed") {
      console.warn("[RAZORPAY] payment.failed", {
        reason: payment?.error_reason,
        code: payment?.error_code,
        order_id: payment?.order_id,
      });
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error("razorpay webhook:", e);
    return res.status(500).end();
  }
});

module.exports = router;
