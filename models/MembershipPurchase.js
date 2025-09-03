// apis/models/MembershipPurchase.js
const mongoose = require("mongoose");

const MembershipPurchaseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipPlan",
      required: true,
    },
    region: { type: String, enum: ["IN", "EU", "INTL"], required: true },
    currency: { type: String, required: true }, // "INR" | "EUR" | "USD"
    durationDays: { type: Number, required: true },

    // pricing snapshot
    baseAmountMinor: { type: Number, required: true }, // from plan.priceBook
    discountMinor: { type: Number, default: 0 }, // applied discount
    finalAmountMinor: { type: Number, required: true },

    // coupon / referral
    couponCode: { type: String, default: "" }, // coupon used (if any)
    referrerCode: { type: String, default: "" }, // a user's referralCode if used
    referrerUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // bookkeeping
    paid: { type: Boolean, default: false }, // set true after payment gateway success
    provider: { type: String, default: "manual" }, // "razorpay" | "stripe" | etc
    providerRef: { type: String, default: "" }, // payment id from provider
  },
  { timestamps: true }
);

module.exports = mongoose.model("MembershipPurchase", MembershipPurchaseSchema);
