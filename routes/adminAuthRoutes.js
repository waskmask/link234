// routes/adminAuthRoutes.js
const express = require("express");
const adminAuthController = require("../controllers/adminAuthController");
const adminAuthMiddleware = require("../middleware/adminAuthMiddleware");

const router = express.Router();

router.post("/signup", adminAuthController.signup); // optional
router.post("/login", adminAuthController.login);
router.post("/logout", adminAuthController.logout);
router.post(
  "/change-password",
  adminAuthMiddleware,
  adminAuthController.changePassword
);

module.exports = router;
