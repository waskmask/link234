const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ROLES = ["superadmin", "admin", "moderator", "sales"];

const AdminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: { type: String, trim: true, default: "" },
    role: { type: String, enum: ROLES, default: "admin", index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    isActive: { type: Boolean, default: true, index: true },
    tokenVersion: { type: Number, default: 0 }, // bump to invalidate tokens
    lastLoginAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true }
);

AdminUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

AdminUserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = {
  AdminUser: mongoose.model("AdminUser", AdminUserSchema),
  ADMIN_ROLES: ROLES,
};
