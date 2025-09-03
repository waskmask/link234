// apis/controllers/membershipCheckoutController.js
const MembershipPlan = require("../models/MembershipPlan");
const Coupon = require("../models/Coupon");
const MembershipPurchase = require("../models/MembershipPurchase");
const { applyPaidPurchaseToUser } = require("../utils/membership");
const User = require("../models/User");

// very small helper for region mapping from a country code
const EU_SET = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

function resolveRegionFromCountry(countryCode = "") {
  const cc = String(countryCode || "").toUpperCase();
  if (cc === "IN") return "IN";
  if (EU_SET.has(cc)) return "EU";
  return "INTL";
}

function findPriceForRegion(plan, region) {
  const entry = plan.priceBook.find(
    (p) => p.region === region && p.isActive !== false
  );
  if (!entry) return null;
  return entry; // {region, currency, amountMinor}
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

  // per-user limit (basic count via purchases)
  if (coupon.perUserLimit > 0) {
    const usedByUser = await MembershipPurchase.countDocuments({
      user: userId,
      couponCode: code,
      paid: true,
    });
    if (usedByUser >= coupon.perUserLimit)
      return { discountMinor: 0, coupon: null };
  }

  // total limit
  if (
    coupon.usageLimit > 0 &&
    coupon.stats.totalRedemptions >= coupon.usageLimit
  ) {
    return { discountMinor: 0, coupon: null };
  }

  let discountMinor = 0;
  if (coupon.type === "percent") {
    const raw = Math.round((baseAmountMinor * coupon.value) / 100);
    discountMinor = raw;
    if (coupon.maxDiscountMinor && coupon.maxDiscountMinor > 0) {
      discountMinor = Math.min(discountMinor, coupon.maxDiscountMinor);
    }
  } else {
    // fixed
    discountMinor = Math.round(coupon.value);
  }

  discountMinor = clamp(discountMinor, 0, baseAmountMinor);
  return { discountMinor, coupon };
}

// --- 1) Quote endpoint (no DB write except reading)
exports.quoteMembership = async (req, res) => {
  try {
    const { planSlugOrId, countryCode, couponCode } = req.body;
    const userId = req.user?.id; // optional; if you call this for logged-in users

    const plan =
      (await MembershipPlan.findOne({ slug: planSlugOrId })) ||
      (await MembershipPlan.findById(planSlugOrId));
    if (!plan || !plan.isActive) {
      return res.status(404).json({ message: "Plan not found." });
    }

    const region = resolveRegionFromCountry(countryCode);
    const price = findPriceForRegion(plan, region);
    if (!price)
      return res.status(400).json({ message: "No price for region." });

    const { discountMinor } = await computeDiscount({
      couponCode,
      userId,
      region,
      baseAmountMinor: price.amountMinor,
    });

    const finalAmountMinor = price.amountMinor - discountMinor;

    res.json({
      plan: {
        id: plan._id,
        slug: plan.slug,
        displayName: plan.displayName,
        durationDays: plan.durationDays,
      },
      region,
      currency: price.currency,
      baseAmountMinor: price.amountMinor,
      discountMinor,
      finalAmountMinor,
    });
  } catch (err) {
    console.error("quoteMembership:", err);
    res.status(500).json({ message: "Failed to quote membership." });
  }
};

// --- 2) Checkout endpoint (creates purchase snapshot; mark paid after gateway)
exports.checkoutMembership = async (req, res) => {
  try {
    const userId = req.user.id; // require app-user auth
    const { planSlugOrId, countryCode, couponCode } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const plan =
      (await MembershipPlan.findOne({ slug: planSlugOrId })) ||
      (await MembershipPlan.findById(planSlugOrId));
    if (!plan || !plan.isActive) {
      return res.status(404).json({ message: "Plan not found." });
    }

    const region = resolveRegionFromCountry(
      countryCode || user?.address?.country
    );
    const price = findPriceForRegion(plan, region);
    if (!price)
      return res.status(400).json({ message: "No price for region." });

    const { discountMinor, coupon } = await computeDiscount({
      couponCode,
      userId,
      region,
      baseAmountMinor: price.amountMinor,
    });

    const finalAmountMinor = price.amountMinor - discountMinor;

    // If coupon matches a user referralCode, capture referral
    let referrerUser = null;
    let referrerCode = "";
    if (!user.referred_by && couponCode) {
      const referredByCode = String(couponCode).trim().toUpperCase();
      referrerUser = await User.findOne({ referralCode: referredByCode });
      if (referrerUser) {
        user.referred_by = referredByCode;
        user.referredByUser = referrerUser._id;
        user.referredAt = new Date();
        await user.save();
        referrerCode = referredByCode;
      } else if (coupon) {
        // If it's not a user referral, but a real coupon, still store the code as referred_by
        user.referred_by = coupon.code;
        user.referredAt = new Date();
        await user.save();
        referrerCode = coupon.code;
      }
    }

    // Create purchase snapshot (set paid=false; flip to true after gateway success)
    const purchase = await MembershipPurchase.create({
      user: user._id,
      plan: plan._id,
      region,
      currency: price.currency,
      durationDays: plan.durationDays,
      baseAmountMinor: price.amountMinor,
      discountMinor,
      finalAmountMinor,
      couponCode: coupon ? coupon.code : (couponCode || "").toUpperCase(),
      referrerCode,
      referrerUser: referrerUser?._id || undefined,
      paid: false, // flip to true after payment success webhook/callback
      provider: "manual",
      providerRef: "",
    });

    res.status(201).json({
      message: "Checkout created.",
      purchase,
    });
  } catch (err) {
    console.error("checkoutMembership:", err);
    res.status(500).json({ message: "Failed to checkout membership." });
  }
};

// --- 3) Mark as paid (after payment gateway succeeds)
exports.markPurchasePaid = async (req, res) => {
  try {
    const { id } = req.params; // purchase id
    const { provider = "manual", providerRef = "" } = req.body;

    const p = await MembershipPurchase.findById(id).populate("plan user");
    if (!p) return res.status(404).json({ message: "Purchase not found." });
    if (p.paid) return res.status(400).json({ message: "Already paid." });

    p.paid = true;
    p.provider = provider;
    p.providerRef = providerRef;
    await p.save();

    await applyPaidPurchaseToUser(p, provider);

    // Increment coupon usage
    if (p.couponCode) {
      await Coupon.updateOne(
        { code: p.couponCode },
        { $inc: { "stats.totalRedemptions": 1 } }
      );
    }

    res.json({ message: "Payment marked, membership extended.", purchase: p });
  } catch (err) {
    console.error("markPurchasePaid:", err);
    res.status(500).json({ message: "Failed to mark paid." });
  }
};
