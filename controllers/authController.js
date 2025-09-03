// controllers/authController.js
const User = require("../models/User");
const nodemailer = require("nodemailer");
const { customAlphabet, nanoid } = require("nanoid");
const generateToken = require("../utils/jwt");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const qr = require("qr-image");
const path = require("path");
const usernameId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);
// Email verification handler
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(400).json({ message: "Invalid token" });
    }

    user.verified = true;
    await user.save();

    res.json({ message: "Email verified successfully" });
  } catch (error) {
    res.status(400).json({ message: "Invalid or expired token" });
  }
};

exports.signup = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if the email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    // Generate a new user but do not save to the database yet
    const user = new User({
      email,
      password,
      username: usernameId(),
      referralCode: nanoid(12),
      socialLinks: {
        facebook: "",
        instagram: "",
        youtube: "",
        x: "",
        xing: "",
        tiktok: "",
        whatsapp: "",
        spotify: "",
        amazon: "",
        snapchat: "",
        pinterest: "",
        soundcloud: "",
        threads: "",
        website: "",
        linkedin: "",
        reddit: "",
        medium: "",
        buyMeaCoffee: "",
        onlyFans: "",
      },
    });

    // Generate email verification token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Set up the email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Email verification URL
    const verificationUrl = `${process.env.API_URL_FRONT}/email-verification?token=${token}`;

    // Read the email template and replace placeholders
    const templatePath = path.join(__dirname, "../emails/registration.html");
    const template = fs.readFileSync(templatePath, "utf8");
    const emailHtml = template
      .replace("[username]", user.username)
      .replace("[verificationLink]", verificationUrl);

    // Try to send the verification email using the template
    try {
      await transporter.sendMail({
        from: `"Link234" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: "Action needed: Verify your email address on link234.com",
        html: emailHtml,
      });

      // If the email is sent successfully, save the user
      await user.save();

      // Generate the QR codes after saving the user
      const userProfileUrl = `${process.env.API_URL_FRONT}/${user.username}`;
      const qrCodeDir = path.join(__dirname, "..", "qrcodes");

      // Ensure the 'qrcodes' folder exists
      if (!fs.existsSync(qrCodeDir)) {
        fs.mkdirSync(qrCodeDir);
      }

      // Generate and save the QR code images
      const pngQRCode = qr.image(userProfileUrl, { type: "png" });
      const pngFilePath = path.join(qrCodeDir, `${user.username}-qr.png`);
      pngQRCode.pipe(fs.createWriteStream(pngFilePath));

      const svgQRCode = qr.image(userProfileUrl, { type: "svg" });
      const svgFilePath = path.join(qrCodeDir, `${user.username}-qr.svg`);
      svgQRCode.pipe(fs.createWriteStream(svgFilePath));

      // Save the paths to the QR code images in the user model
      user.qrCodePNG = `/qrcodes/${user.username}-qr.png`;
      user.qrCodeSVG = `/qrcodes/${user.username}-qr.svg`;

      // Update the user record with QR code paths
      await user.save();

      res.status(201).json({
        message: "User registered successfully. Please verify your email.",
        user,
        qrCodePNG: user.qrCodePNG,
        qrCodeSVG: user.qrCodeSVG,
      });
    } catch (emailError) {
      return res.status(500).json({
        message: "Failed to send verification email. Please try again.",
        error: emailError.message,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Login
// helper so login + logout use the same flags
const isProd = process.env.NODE_ENV === "production";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined; // e.g. ".your-domain.com"
const CROSS_SITE = process.env.CROSS_SITE === "true"; // set true if API & front are on different sites

const cookieOpts = () => ({
  httpOnly: true,
  secure: isProd, // must be true on HTTPS (required if SameSite=None)
  sameSite: CROSS_SITE ? "none" : "lax", // "none" only when truly cross-site
  path: "/", // keep this constant
  maxAge: 24 * 60 * 60 * 1000, // 1 day
});

exports.login = (req, res, next) => {
  passport.authenticate(
    "local",
    { session: false },
    async (err, user, info) => {
      if (err || !user) {
        return res
          .status(400)
          .json({ message: info ? info.message : "Login failed" });
      }
      const token = generateToken(user);
      res.cookie("token", token, cookieOpts()); // <- unchanged, but now opts are consistent
      return res.json({ success: true });
    }
  )(req, res, next);
};

// Forgot Password - sends reset password link
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Generate reset token (expires in 1 hour)
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const resetUrl = `${process.env.API_URL_FRONT}/reset-password?token=${resetToken}`;

    // Configure SMTP transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Read the email template from the file system
    const templatePath = path.join(__dirname, "../emails/forgotPassword.html");
    const template = fs.readFileSync(templatePath, "utf8");

    // Replace placeholders with actual values
    const emailHtml = template
      .replace("[username]", user.username)
      .replace("[passResetLink]", resetUrl);

    // Send the email using the updated template
    await transporter.sendMail({
      from: `"Link234 Forgot password" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "Set new password",
      html: emailHtml,
    });

    res.status(200).json({
      message: "Password reset link has been sent to your email.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Reset Password - updates the password
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.query;
    const { newPassword } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Verify the reset token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(400)
        .json({ message: "Invalid token or user not found" });
    }

    // Set the new password directly
    user.password = newPassword; // No hashing here, let the pre-save hook handle it

    await user.save();

    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Resend email verification code
exports.resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "user_not_found" });
    }

    // If already verified, no need to resend the verification email
    if (user.verified) {
      return res.status(400).json({ message: "email_is_already_verified" });
    }

    // Generate a new email verification token (expires in 1 day)
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Create the email verification URL (adjust domain/port as needed)
    const verificationUrl = `${process.env.API_URL_FRONT}/email-verification?token=${token}`;

    // Set up the email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_PORT === "465", // true if using port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Read the email template and replace placeholders
    const templatePath = path.join(
      __dirname,
      "../emails/emailVerification.html"
    );
    const template = fs.readFileSync(templatePath, "utf8");
    const emailHtml = template
      .replace("[verificationLink]", verificationUrl)
      .replace("[username]", user.username);

    // Send the verification email using the updated template
    await transporter.sendMail({
      from: `"Link234 new verify link" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "New verification email",
      html: emailHtml,
    });

    res.status(200).json({ message: "verification_email_resent" });
  } catch (error) {
    console.error("Error resending verification email:", error.message);
    res.status(500).json({
      message: "failed_resending_verification_email",
      error: error.message,
    });
  }
};

// changeEmailAddress controller
exports.changeEmailAddress = async (req, res) => {
  try {
    const { newEmail } = req.body;

    // Ensure a new email is provided
    if (!newEmail) {
      return res.status(400).json({ message: "new_email_required" });
    }

    // Check if the new email is already taken
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      return res.status(400).json({ message: "email_already_registered" });
    }

    // Get the current user id from the auth middleware
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "user_not_found" });
    }

    // Update the email and set verified to false
    user.email = newEmail;
    user.verified = false;
    await user.save();

    // Generate a new verification token (expires in 1 day)
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Build the verification URL (adjust host/port as needed)
    const verificationUrl = `${process.env.API_URL_FRONT}/email-verification?token=${token}`;

    // Create the transporter for sending email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_PORT === "465", // true if using port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Read the email template and replace placeholders for username and verification link
    const templatePath = path.join(__dirname, "../emails/changeEmail.html");
    const template = fs.readFileSync(templatePath, "utf8");
    const emailHtml = template
      .replace("[username]", user.username)
      .replace("[verificationLink]", verificationUrl);

    // Send the verification email with the new subject
    await transporter.sendMail({
      from: `"Link234 Email changed" <${process.env.SMTP_USER}>`,
      to: newEmail,
      subject: "Action needed: Verify your new email address on link234.com",
      html: emailHtml,
    });

    res.status(200).json({
      message: "email_changed_successfully_please_verify_new_email",
      user,
    });
  } catch (error) {
    console.error("Error changing email address:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// logout
exports.logout = async (req, res) => {
  try {
    req.session?.destroy?.(() => {});

    // Build the exact same opts we used when setting the cookie
    const base = { ...cookieOpts(), maxAge: 0 };

    // Clear the primary cookie
    res.clearCookie("token", base);

    // Also clear common variants (some browsers are picky about domain/path)
    // without domain
    res.clearCookie("token", { ...base, domain: undefined });
    // with explicit root path is already in base; add a defensive current-path clear:
    res.clearCookie("token", { ...base, path: req.baseUrl || req.path || "/" });

    // If you have refresh token, clear it too:
    res.clearCookie("refreshToken", base);
    res.clearCookie("refreshToken", { ...base, domain: undefined });

    // Tell intermediaries not to cache
    res.setHeader("Cache-Control", "no-store");

    return res.json({ success: true });
  } catch (e) {
    return res.status(200).json({ success: true }); // fail-safe
  }
};
