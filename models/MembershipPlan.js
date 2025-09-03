// apis/models/MembershipPlan.js
const mongoose = require("mongoose");

const ALLOWED_DURATIONS = [7, 30, 60, 90, 180, 365];
const ALLOWED_REGIONS = ["IN", "EU", "INTL"]; // India, European Union, Rest of World

const PriceBookSchema = new mongoose.Schema(
  {
    region: { type: String, enum: ALLOWED_REGIONS, required: true },
    currency: { type: String, required: true, uppercase: true, trim: true }, // INR | EUR | USD
    amountMinor: { type: Number, required: true, min: 0 }, // paise/cents
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

const MembershipPlanSchema = new mongoose.Schema(
  {
    // Stable id for code: "free", "basic", "plus"
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 2,
      maxlength: 40,
    },

    // Marketing/display: "Free", "Basic", "Plus"
    displayName: { type: String, required: true, trim: true, maxlength: 80 },

    // Exact constraint requested
    durationDays: { type: Number, enum: ALLOWED_DURATIONS, required: true },

    // Region prices (e.g., IN: ₹1000, EU: €10, INTL: $10)
    priceBook: { type: [PriceBookSchema], default: [] },

    // Feature flags (plain strings; localize in FE)
    features: [{ type: String, trim: true }],

    // Visibility/purchasability
    isActive: { type: Boolean, default: true },

    // Dashboard sort
    sort: { type: Number, default: 0 },

    // Admin-only note
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// Optional helpers
MembershipPlanSchema.statics.allowedDurations = () => ALLOWED_DURATIONS;
MembershipPlanSchema.statics.allowedRegions = () => ALLOWED_REGIONS;

module.exports = mongoose.model("MembershipPlan", MembershipPlanSchema);
