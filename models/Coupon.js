// apis/models/Coupon.js
const mongoose = require("mongoose");

const COUPON_TYPES = ["percent", "fixed"]; // percent => 0-100, fixed => minor units
const REGIONS = ["IN", "EU", "INTL"];

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: { type: String, enum: COUPON_TYPES, required: true },
    value: { type: Number, required: true }, // percent (e.g., 15) or fixed (minor units)
    maxDiscountMinor: { type: Number, default: 0 }, // optional cap for percent
    regions: [{ type: String, enum: REGIONS, default: undefined }], // if empty => all regions
    startsAt: { type: Date },
    endsAt: { type: Date },
    usageLimit: { type: Number, default: 0 }, // 0 = unlimited
    perUserLimit: { type: Number, default: 0 }, // 0 = unlimited
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    notes: { type: String, trim: true, maxlength: 300 },
    stats: {
      totalRedemptions: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coupon", CouponSchema);
