// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { customAlphabet, nanoid } = require("nanoid");

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    imageUrl: { type: String, trim: true, default: "" },
    price: { type: String },
    shopUrl: { type: String, required: true, trim: true },
    isPublic: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { _id: true, timestamps: true }
);

const ReleaseSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["video", "audio"], required: true },
    platform: {
      type: String,
      enum: [
        "youtube",
        "spotify",
        "ytmusic",
        "soundcloud",
        "applemusic",
        "vibrer",
        "other",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 90 },
    linkUrl: { type: String, required: true, trim: true }, // full URL to media
    posterUrl: { type: String, trim: true, default: "" }, // cover/thumbnail (optional)
    isPublic: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
    releaseDate: { type: Date },
  },
  { _id: true, timestamps: true }
);

const TEMPLATE_NAMES = [
  "one_theme", // default gradient
  "sunset_glow", // gradient
  "ocean_breeze", // gradient
  "mint_fresh", // gradient
  "lilac_dream",
  "lagoon_mist",
  "lavender_sky",
  "dark_theme",
  "cappuccino",
  "image_banner", // image-based background
];

const TemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: TEMPLATE_NAMES,
      default: "one_theme",
      required: true,
    },
    background_img: { type: String, default: "" }, // URL or /uploads/...
    accent_color: { type: String, default: "#0b051d" },
    accent_forground_color: { type: String, default: "#ffffff" },
    text_color: { type: String, default: "#0b051d" },
    link_color: { type: String, default: "#0231ebff" },
    background: {
      type: String,
      default: "#ffffff",
    },
  },
  { _id: false }
);

const MembershipSnapshotSchema = new mongoose.Schema(
  {
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "MembershipPlan" },
    planKey: { type: String }, // denormalized from plan.slug
    planName: { type: String }, // denormalized from plan.displayName
    provider: {
      type: String,
      enum: ["stripe", "razorpay", "manual", "other"],
      default: "manual",
    },
    lastPurchaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipPurchase",
    },

    region: { type: String, enum: ["IN", "EU", "INTL"] },
    currency: { type: String }, // "INR" | "EUR" | "USD"
    baseAmountMinor: { type: Number, default: 0 },
    discountMinor: { type: Number, default: 0 },
    finalAmountMinor: { type: Number, default: 0 },
    couponCode: { type: String, uppercase: true, trim: true, default: "" },

    durationDays: { type: Number, default: 0 },
    currentPeriodStart: { type: Date },
    currentPeriodEnd: { type: Date }, // replaces/duplicates membershipExpires
    status: {
      type: String,
      enum: ["inactive", "active", "past_due", "canceled"],
      default: "inactive",
    },
  },
  { _id: false }
);

const MembershipHistorySchema = new mongoose.Schema(
  {
    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MembershipPurchase",
    },
    provider: {
      type: String,
      enum: ["stripe", "razorpay", "manual", "other"],
      required: true,
    },
    transactionId: { type: String }, // Stripe: payment_intent  | Razorpay: payment_id
    receiptUrl: { type: String, default: "" }, // optional (Stripe charge receipt_url)
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "MembershipPlan" },
    planKey: { type: String },
    planName: { type: String },
    region: { type: String, enum: ["IN", "EU", "INTL"] },
    currency: { type: String },
    baseAmountMinor: { type: Number, default: 0 },
    discountMinor: { type: Number, default: 0 },
    finalAmountMinor: { type: Number, default: 0 },
    couponCode: { type: String, uppercase: true, trim: true, default: "" },
    durationDays: { type: Number, default: 0 },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    purchasedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  emailVisibility: { type: Boolean, default: false },
  password: { type: String, required: true, select: false },
  username: {
    type: String,
    unique: true,
    lowercase: true,
    default: () => customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12),
  },
  profileName: { type: String },
  verified: { type: Boolean, default: false },
  profileImage: String,
  coverImage: String,
  aboutUs: String,
  address: {
    street: String,
    houseNo: String,
    city: String,
    country: String,
    postcode: String,
  },
  type: {
    type: String,
    enum: [
      "business",
      "private",
      "artist",
      "actor",
      "accountant",
      "influencer",
      "creator",
      "engineer",
      "model",
      "musician",
      "singer",
      "software",
    ],
  },
  socialLinks: {
    facebook: String,
    instagram: String,
    youtube: String,
    x: String,
    xing: String,
    tiktok: String,
    whatsapp: String,
    spotify: String,
    amazon: String,
    snapchat: String,
    pinterest: String,
    soundcloud: String,
    threads: String,
    website: String,
    linkedin: String,
    reddit: String,
    medium: String,
    buyMeaCoffee: String,
    onlyFans: String,
  },
  phoneNumber: String,
  catelogue: [
    {
      title: String,
      description: String,
      file: String,
    },
  ],
  additionalLinks: [{ title: String, link: String }],
  membership: {
    type: MembershipSnapshotSchema,
    default: () => ({ status: "inactive" }),
  },
  membershipHistory: { type: [MembershipHistorySchema], default: [] },
  referralCode: {
    type: String,
    default: () => nanoid("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8),
  },
  referred_by: { type: String, default: "" }, // code they entered (coupon or referralCode)
  referredByUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // resolved when code belongs to a user
  referredAt: { type: Date },
  shortLink: String,
  qrCodePNG: String,
  qrCodeSVG: String,
  products: { type: [ProductSchema], default: [] },
  releases: { type: [ReleaseSchema], default: [] },
  template: { type: TemplateSchema, default: () => ({}) },
  status: {
    type: String,
    enum: ["inactive", "suspended", "active"],
    default: "active",
  },
  createdAt: { type: Date, default: Date.now },
});

// Optional convenience
userSchema.virtual("isMemberActive").get(function () {
  const end = this.membership?.currentPeriodEnd;
  return !!(end && end > new Date() && this.membership?.status === "active");
});

// Password hash middleware
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
