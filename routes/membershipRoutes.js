// apis/routes/membershipRoutes.js
const express = require("express");
const router = express.Router();

const C = require("../controllers/membershipController");

// ✅ Admin middlewares (consistent path + names)
const { verifyAdminToken } = require("../middleware/verifyAdminToken");
const { allowAdminRoles } = require("../middleware/adminRoles");

// Public reads (keep or restrict as you like)
router.get("/", C.getMemberships);
router.get("/:id", verifyAdminToken, C.getMembershipById);

// Admin writes (use admin token + role guard everywhere)
router.post(
  "/",
  verifyAdminToken,
  allowAdminRoles("superadmin", "admin", "sales", "moderator"),
  C.createMembership
);

router.patch(
  "/:id",
  verifyAdminToken,
  allowAdminRoles("superadmin", "admin", "sales", "moderator"),
  C.updateMembership
);

router.patch(
  "/:id/toggle",
  verifyAdminToken,
  allowAdminRoles("superadmin", "admin"),
  C.toggleMembershipActive
);

router.delete(
  "/:id",
  verifyAdminToken,
  allowAdminRoles("superadmin", "admin"),
  C.deleteMembership
);

// PriceBook (fine-grained)
router.put(
  "/:id/price",
  verifyAdminToken,
  allowAdminRoles("superadmin", "admin", "sales"),
  C.upsertRegionPrice
);

router.delete(
  "/:id/price/:region",
  verifyAdminToken,
  allowAdminRoles("superadmin", "admin", "sales"),
  C.removeRegionPrice
);

module.exports = router;
