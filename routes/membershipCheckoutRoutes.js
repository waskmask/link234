// apis/routes/membershipCheckoutRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/membershipCheckoutController");
const auth = require("../middleware/authMiddleware"); // your existing app-user JWT cookie "token"

router.post("/quote", ctrl.quoteMembership); // can be public or authed
router.post("/checkout", auth, ctrl.checkoutMembership);
router.post("/purchase/:id/mark-paid", ctrl.markPurchasePaid); // protect via admin if you like

module.exports = router;
