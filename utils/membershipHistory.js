const path = require("path");
const User = require("../models/User");
const MembershipPurchase = require("../models/MembershipPurchase");
const { sendMembershipSuccessEmail } = require("./mailer");

function fmtCurrency(minor, cur) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
    }).format((Number(minor) || 0) / 100);
  } catch {
    return "";
  }
}

/**
 * Push a snapshot row into user.membershipHistory and send email.
 * Keeps your existing purchase/apply flow untouched.
 */
async function snapshotAndNotify({
  purchaseId,
  transactionId = "",
  receiptUrl = "",
}) {
  const p = await MembershipPurchase.findById(purchaseId).populate("plan user");
  if (!p || !p.user) return;

  const user = await User.findById(p.user._id);
  if (!user) return;

  const planDoc = p.plan;
  const planKey = planDoc?.slug || "";
  const planName = planDoc?.displayName || planDoc?.slug || "";

  // current active period is already set by your apply function
  const periodStart = user?.membership?.currentPeriodStart || null;
  const periodEnd = user?.membership?.currentPeriodEnd || null;

  await User.updateOne(
    { _id: user._id },
    {
      $push: {
        membershipHistory: {
          purchase: p._id,
          provider: p.provider || "other",
          transactionId: transactionId || p.providerRef || "",
          receiptUrl,
          plan: p.plan,
          planKey,
          planName,
          region: p.region,
          currency: p.currency,
          baseAmountMinor: p.baseAmountMinor,
          discountMinor: p.discountMinor,
          finalAmountMinor: p.finalAmountMinor,
          couponCode: p.couponCode || "",
          durationDays: p.durationDays,
          periodStart,
          periodEnd,
          purchasedAt: new Date(),
        },
      },
    }
  );

  // Send email
  await sendMembershipSuccessEmail({
    user,
    purchase: p,
    plan: planDoc,
    receiptUrl,
    totalFormatted: fmtCurrency(p.finalAmountMinor, p.currency),
    baseFormatted: fmtCurrency(p.baseAmountMinor, p.currency),
    discountFormatted: fmtCurrency(p.discountMinor, p.currency),
  });
}

module.exports = { snapshotAndNotify };
