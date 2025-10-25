// routes/adminAuthRoutes.js
const express = require("express");
const adminAuthController = require("../controllers/adminAuthController");
const adminAuthMiddleware = require("../middleware/adminAuthMiddleware");
const { allowAdminRoles } = require("../middleware/adminRoles");

const router = express.Router();

router.post(
  "/signup",
  adminAuthMiddleware,
  allowAdminRoles("superadmin"),
  adminAuthController.signup
);
router.post("/login", adminAuthController.login);
router.post("/logout", adminAuthController.logout);
router.post(
  "/change-password",
  adminAuthMiddleware,
  adminAuthController.changePassword
);

// my profile:
router.get("/me", adminAuthMiddleware, adminAuthController.me);

// status toggle
router.patch(
  "/admins/:id/active",
  adminAuthMiddleware,
  allowAdminRoles("superadmin"),
  adminAuthController.toggleActive
);

/**
 * Change own password (must provide old password)
 */
router.post(
  "/admins/change-own-password",
  adminAuthMiddleware,
  adminAuthController.changeOwnPassword
);

/**
 * Change another admin's password (Admin or Super Admin)
 * Cannot target self via this route.
 */
router.post(
  "/admins/:id/change-password",
  adminAuthMiddleware,
  allowAdminRoles("admin", "superadmin"),
  adminAuthController.changeOtherPassword
);

// List all admin users (Admin & Super Admin only)
router.get(
  "/admins",
  adminAuthMiddleware,
  allowAdminRoles("admin", "superadmin"),
  adminAuthController.listAdmins
);

// View a specific admin user (Admin & Super Admin only)
router.get(
  "/admins/:id",
  adminAuthMiddleware,
  allowAdminRoles("admin", "superadmin"),
  adminAuthController.getAdminById
);

module.exports = router;
