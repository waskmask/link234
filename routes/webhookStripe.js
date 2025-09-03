// routes/webhookStripe.js
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const MembershipPurchase = require("../models/MembershipPurchase");
const Coupon = require("../models/Coupon");
const { applyPaidPurchaseToUser } = require("../utils/membership");

module.exports = async function webhookStripeHandler(req, res) {
  // Prove the route is hit
  const sig = req.headers["stripe-signature"];
  console.log("[WEBHOOK] hit", {
    method: req.method,
    url: req.originalUrl,
    hasSig: !!sig,
    len: req.headers["content-length"],
    type: req.headers["content-type"],
  });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ stripe webhook signature:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      console.log("[STRIPE] session", {
        id: s.id,
        payment_status: s.payment_status,
        metadata: s.metadata,
        client_reference_id: s.client_reference_id,
      });

      if (s.payment_status !== "paid")
        return res.json({ received: true, skipped: "not_paid" });

      const purchaseId = s.metadata?.purchaseId || s.client_reference_id;
      if (!purchaseId)
        return res.json({ received: true, skipped: "no_purchase_id" });

      let p = await MembershipPurchase.findById(purchaseId).populate(
        "plan user"
      );
      if (!p)
        return res.json({ received: true, skipped: "purchase_not_found" });

      console.log("[PURCHASE] before apply", {
        id: p._id,
        paid: p.paid,
        user: p.user?._id,
        plan: p.plan?._id,
        durationDays: p.durationDays,
      });

      if (!p.paid) {
        p.paid = true;
        p.provider = "stripe";
        p.providerRef = s.id;
        if (s.currency) p.currency = String(s.currency).toUpperCase();
        if (typeof s.amount_total === "number")
          p.finalAmountMinor = s.amount_total;
        await p.save();

        await applyPaidPurchaseToUser(p, "stripe");
        console.log("[APPLY] done");

        if (p.couponCode) {
          await Coupon.updateOne(
            { code: String(p.couponCode).toUpperCase() },
            { $inc: { "stats.totalRedemptions": 1 } }
          );
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("stripe webhook handler error:", err);
    res.status(500).json({ error: "handler_failed" });
  }
};
