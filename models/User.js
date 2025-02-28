// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const shortid = require("shortid");

const membershipSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      enum: ["free", "basic", "plus"],
      default: "free",
    },
    durationDays: {
      type: Number,
      default: 90, // 3 months for free
    },
    costPerMonth: {
      type: Number,
      default: 0, // free membership costs 0
    },
    addedOn: {
      type: Date,
      default: Date.now,
    },
    expiresOn: Date,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  username: {
    type: String,
    unique: true,
    lowercase: true,
    default: () => shortid.generate(),
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
  memberships: {
    type: membershipSchema,
    default: () => ({}),
  },
  referralCode: { type: String, default: () => shortid.generate() },
  shortLink: String,
  qrCodePNG: String,
  qrCodeSVG: String,
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

// Pre-save hook to adjust membership settings and calculate expiry dates
userSchema.pre("save", function (next) {
  if (this.memberships) {
    // Update duration and cost if the membership title has been modified
    if (this.isModified("memberships.title")) {
      switch (this.memberships.title) {
        case "basic":
          this.memberships.durationDays = 30; // 1 month
          this.memberships.costPerMonth = 2;
          break;
        case "plus":
          this.memberships.durationDays = 30; // 1 month
          this.memberships.costPerMonth = 5;
          break;
        case "free":
        default:
          this.memberships.durationDays = 90; // 3 months free
          this.memberships.costPerMonth = 0;
      }
    }
    // Ensure addedOn is set (if not already)
    if (!this.memberships.addedOn) {
      this.memberships.addedOn = new Date();
    }
    // Calculate expiresOn based on addedOn and durationDays
    this.memberships.expiresOn = new Date(
      this.memberships.addedOn.getTime() +
        this.memberships.durationDays * 24 * 60 * 60 * 1000
    );
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
