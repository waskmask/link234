// apis/routes/membershipPayRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/membershipPayController");
const auth = require("../middleware/authMiddleware"); // your app user token/cookie

router.post("/start", auth, ctrl.startPayment);

module.exports = router;
