// routes/authRoutes.js
const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.get("/verify-email", authController.verifyEmail);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
// New route to resend verification email
router.post("/resend-verification", authController.resendVerificationEmail);
const authMiddleware = require("../middleware/authMiddleware");
// Route to change email address
router.put("/change-email", authMiddleware, authController.changeEmailAddress);

module.exports = router;
