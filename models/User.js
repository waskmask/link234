// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const shortid = require("shortid");

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
  membershipExpires: Date,
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

module.exports = mongoose.model("User", userSchema);
