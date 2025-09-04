// apis/controllers/membershipPayController.js
const MembershipPlan = require("../models/MembershipPlan");
const MembershipPurchase = require("../models/MembershipPurchase");
const Coupon = require("../models/Coupon");
const User = require("../models/User");

// libs (install: npm i razorpay stripe)
const Razorpay = require("razorpay");
const getStripe = require("../utils/stripeClient");

// helpers
function findPriceForRegion(plan, region) {
  const entry = plan.priceBook.find(
    (p) => p.region === region && p.isActive !== false
  );
  return entry || null;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

async function computeDiscount({
  couponCode,
  userId,
  region,
  baseAmountMinor,
}) {
  if (!couponCode) return { discountMinor: 0, coupon: null };

  const code = String(couponCode).trim().toUpperCase();
  const coupon = await Coupon.findOne({ code, isActive: true });
  if (!coupon) return { discountMinor: 0, coupon: null };

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now)
    return { discountMinor: 0, coupon: null };
  if (coupon.endsAt && coupon.endsAt < now)
    return { discountMinor: 0, coupon: null };
  if (coupon.regions?.length && !coupon.regions.includes(region))
    return { discountMinor: 0, coupon: null };

  if (coupon.perUserLimit > 0) {
    const usedByUser = await MembershipPurchase.countDocuments({
      user: userId,
      couponCode: code,
      paid: true,
    });
    if (usedByUser >= coupon.perUserLimit)
      return { discountMinor: 0, coupon: null };
  }
  if (
    coupon.usageLimit > 0 &&
    coupon.stats.totalRedemptions >= coupon.usageLimit
  ) {
    return { discountMinor: 0, coupon: null };
  }

  let discountMinor = 0;
  if (coupon.type === "percent") {
    discountMinor = Math.round((baseAmountMinor * coupon.value) / 100);
    if (coupon.maxDiscountMinor > 0)
      discountMinor = Math.min(discountMinor, coupon.maxDiscountMinor);
  } else {
    discountMinor = Math.round(coupon.value);
  }

  discountMinor = clamp(discountMinor, 0, baseAmountMinor);
  return { discountMinor, coupon };
}

// POST /api/membership/start
// body: { planSlugOrId, couponCode?, countryCode? }  (countryCode optional; auto-detected)
exports.startPayment = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    // ... all your code ...

    if (region === "IN" && price.currency === "INR") {
      // Razorpay path unchanged
      // ...
      return res.json({
        /* ... */
      });
    } else {
      // ✅ Stripe path uses lazy getter here (not at top)
      const stripe = getStripe();
      if (!stripe) {
        return res
          .status(500)
          .json({ message: "Stripe is not configured on the server." });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: price.currency.toLowerCase(),
              product_data: {
                name: `${plan.displayName} (${plan.durationDays} days)`,
              },
              unit_amount: finalMinor,
            },
            quantity: 1,
          },
        ],
        customer_email: user.email,
        client_reference_id: String(purchase._id),
        success_url: `${process.env.FRONT_SUCCESS_URL}?purchase={CHECKOUT_SESSION_ID}`,
        cancel_url: process.env.FRONT_CANCEL_URL,
        metadata: { purchaseId: String(purchase._id), plan: plan.slug },
      });

      return res.json({
        gateway: "stripe",
        url: session.url,
        sessionId: session.id,
        purchaseId: purchase._id,
        summary,
      });
    }
  } catch (err) {
    console.error("startPayment:", err);
    res.status(500).json({ message: "Failed to start payment." });
  }
};
