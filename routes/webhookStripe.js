// routes/webhookStripe.js
const getStripe = require("../utils/stripeClient");
const MembershipPurchase = require("../models/MembershipPurchase");
const Coupon = require("../models/Coupon");
const { applyPaidPurchaseToUser } = require("../utils/membership");

module.exports = async function webhookStripeHandler(req, res) {
  const stripe = getStripe();
  if (!stripe) return res.status(500).send("Stripe not configured");

  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret) return res.status(500).send("Webhook secret missing");

  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
  } catch (err) {
    console.error("❌ stripe webhook signature:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      if (s.payment_status !== "paid")
        return res.json({ received: true, skipped: "not_paid" });

      const purchaseId = s.metadata?.purchaseId || s.client_reference_id;
      if (!purchaseId)
        return res.json({ received: true, skipped: "no_purchase_id" });

      const p = await MembershipPurchase.findById(purchaseId).populate(
        "plan user"
      );
      if (!p)
        return res.json({ received: true, skipped: "purchase_not_found" });

      if (!p.paid) {
        p.paid = true;
        p.provider = "stripe";
        p.providerRef = s.id;
        if (s.currency) p.currency = String(s.currency).toUpperCase();
        if (typeof s.amount_total === "number")
          p.finalAmountMinor = s.amount_total;
        await p.save();

        await applyPaidPurchaseToUser(p, "stripe");

        if (p.couponCode) {
          await Coupon.updateOne(
            { code: String(p.couponCode).toUpperCase() },
            { $inc: { "stats.totalRedemptions": 1 } }
          );
        }
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("stripe webhook handler error:", err);
    return res.status(500).json({ error: "handler_failed" });
  }
};
