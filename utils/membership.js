// ./utils/membership.js
const MembershipPlan = require("../models/MembershipPlan");
const User = require("../models/User");

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

exports.applyPaidPurchaseToUser = async function applyPaidPurchaseToUser(
  purchase,
  provider = "manual"
) {
  if (!purchase?.user) {
    console.error(
      "[applyPaidPurchaseToUser] No user in purchase:",
      purchase?._id
    );
    return;
  }

  const userId = purchase.user._id || purchase.user;
  const user = await User.findById(userId);
  if (!user) {
    console.error("[applyPaidPurchaseToUser] User not found:", userId);
    return;
  }

  let planSlug = purchase.plan?.slug;
  let planName = purchase.plan?.displayName;
  if (!planSlug || !planName) {
    const planDoc = await MembershipPlan.findById(purchase.plan);
    planSlug = planDoc?.slug || "";
    planName = planDoc?.displayName || "";
    console.log("[applyPaidPurchaseToUser] Fetched plan:", planSlug, planName);
  }

  const now = new Date();
  const anchor =
    user.membership?.currentPeriodEnd && user.membership.currentPeriodEnd > now
      ? user.membership.currentPeriodEnd
      : now;

  const snapshot = {
    plan: purchase.plan,
    planKey: planSlug,
    planName,
    provider,
    lastPurchaseId: purchase._id,
    region: purchase.region,
    currency: purchase.currency,
    baseAmountMinor: purchase.baseAmountMinor || 0,
    discountMinor: purchase.discountMinor || 0,
    finalAmountMinor: purchase.finalAmountMinor || 0,
    couponCode: (purchase.couponCode || "").toUpperCase(),
    durationDays: purchase.durationDays || 0,
    currentPeriodStart: now,
    currentPeriodEnd: addDays(anchor, purchase.durationDays || 0),
    status: "active",
    updatedAt: now,
  };

  const result = await User.updateOne(
    { _id: user._id },
    { $set: { membership: snapshot } }
  );

  return snapshot;
};
