// apis/controllers/membershipPayController.js
const MembershipPlan = require("../models/MembershipPlan");
const MembershipPurchase = require("../models/MembershipPurchase");
const Coupon = require("../models/Coupon");
const User = require("../models/User");

// libs (install: npm i razorpay stripe)
const Razorpay = require("razorpay");
const Stripe = require("stripe");
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("⚠️ STRIPE_SECRET_KEY not set in .env");
    return null;
  }
  return new Stripe(key, { apiVersion: "2024-06-20" });
}
// ENV needed:
// RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// STRIPE_SECRET_KEY
// FRONT_SUCCESS_URL, FRONT_CANCEL_URL (your frontend pages)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

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

    const { planSlugOrId, couponCode } = req.body;
    const user = await User.findById(req.user.id);
    const plan =
      (await MembershipPlan.findOne({ slug: planSlugOrId })) ||
      (await MembershipPlan.findById(planSlugOrId));
    if (!plan || !plan.isActive)
      return res.status(404).json({ message: "Plan not found." });

    // Country → Region (from geo middleware)
    const countryCode = req.geo?.countryCode || "INTL";
    const region = req.geo?.region || "INTL";

    // Price
    const price = findPriceForRegion(plan, region);
    if (!price)
      return res.status(400).json({ message: "No price for region." });

    // Discount
    const { discountMinor, coupon } = await computeDiscount({
      couponCode,
      userId: user._id,
      region,
      baseAmountMinor: price.amountMinor,
    });
    const finalMinor = price.amountMinor - discountMinor;

    // Create purchase snapshot (unpaid yet)
    const purchase = await MembershipPurchase.create({
      user: user._id,
      plan: plan._id,
      region,
      currency: price.currency,
      durationDays: plan.durationDays,
      baseAmountMinor: price.amountMinor,
      discountMinor,
      finalAmountMinor: finalMinor,
      couponCode: coupon ? coupon.code : (couponCode || "").toUpperCase(),
      paid: false,
    });

    // If coupon equals a user referralCode and user not yet referred, link it
    if (!user.referred_by && couponCode) {
      const referredByCode = String(couponCode).trim().toUpperCase();
      const refUser = await User.findOne({ referralCode: referredByCode });
      if (refUser) {
        user.referred_by = referredByCode;
        user.referredByUser = refUser._id;
        user.referredAt = new Date();
        await user.save();
        purchase.referrerCode = referredByCode;
        purchase.referrerUser = refUser._id;
        await purchase.save();
      } else if (coupon) {
        user.referred_by = coupon.code;
        user.referredAt = new Date();
        await user.save();
        purchase.referrerCode = coupon.code;
        await purchase.save();
      }
    }

    const summary = {
      plan: {
        id: plan._id,
        slug: plan.slug,
        displayName: plan.displayName,
        durationDays: plan.durationDays,
      },
      region, // e.g. "EU"
      countryCode, // e.g. "DE"
      currency: price.currency, // "EUR" | "USD" | "INR"
      baseAmountMinor: price.amountMinor,
      discountMinor,
      finalAmountMinor: finalMinor, // what you actually charge
      customerEmail: user.email,
    };

    // Decide gateway: Razorpay (INR+IN) vs Stripe (all others)
    if (region === "IN" && price.currency === "INR") {
      const rzp = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      const order = await rzp.orders.create({
        amount: finalMinor, // paise
        currency: "INR",
        receipt: `mp_${purchase._id}`,
      });

      // Return what FE needs to open Razorpay
      return res.json({
        gateway: "razorpay",
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        purchaseId: purchase._id,
        customer: {
          name: user.profileName || user.username,
          email: user.email,
          contact: user.phoneNumber || "",
        },
        summary,
      });
    } else {
      // Stripe path
      const stripe = getStripe();
      if (!stripe) {
        return res.status(500).json({
          message: "Stripe is not configured on the server.",
        });
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
