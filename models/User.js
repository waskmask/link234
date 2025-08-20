// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { customAlphabet, nanoid } = require("nanoid");

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    imageUrl: { type: String, trim: true, default: "" },
    price: { type: Number, min: 0, default: 0 }, // keep simple
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
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
        "other",
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    linkUrl: { type: String, required: true, trim: true }, // full URL to media
    posterUrl: { type: String, trim: true, default: "" }, // cover/thumbnail (optional)
    isPublic: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
    releaseDate: { type: Date },
  },
  { _id: true, timestamps: true }
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
    enum: ["business", "private", "creator", "influencer", "model", "musician"],
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
  membershipExpires: Date,
  referralCode: {
    type: String,
    default: () => nanoid("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8),
  },
  shortLink: String,
  qrCodePNG: String,
  qrCodeSVG: String,
  products: { type: [ProductSchema], default: [] },
  releases: { type: [ReleaseSchema], default: [] },
  status: {
    type: String,
    enum: ["inactive", "suspended", "active"],
    default: "active",
  },
  createdAt: { type: Date, default: Date.now },
});

// Password hash middleware
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
