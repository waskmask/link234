// routes/geoRoutes.js
const express = require("express");
const router = express.Router();

const {
  geoCountryGeoip,
  resolveRegionFromCountry,
} = require("../middleware/geoCountryGeoip");
const MembershipPlan = require("../models/MembershipPlan");

// GET /api/geo/whereami  -> { countryCode, region }
router.get("/whereami", geoCountryGeoip, (req, res) => {
  // You already set this in the middleware
  // Dev override supported: /api/geo/whereami?country=DE
  return res.json({
    countryCode: req.geo?.countryCode || null,
    region: req.geo?.region || "INTL",
  });
});

// GET /api/geo/plan-price?slug=plus[&country=DE]
// Uses geoCountryGeoip by default; can override with ?country=XX for testing.
router.get("/plan-price", geoCountryGeoip, async (req, res) => {
  try {
    const slug = String(req.query.slug || "")
      .trim()
      .toLowerCase();
    if (!slug) return res.status(400).json({ message: "slug is required" });

    const cc = (
      req.query.country ||
      req.geo?.countryCode ||
      "INTL"
    ).toUpperCase();
    const region = resolveRegionFromCountry(cc);

    const plan = await MembershipPlan.findOne({ slug, isActive: true }).lean();
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const price = (plan.priceBook || []).find(
      (p) => p.region === region && p.isActive !== false
    );
    if (!price) return res.status(404).json({ message: "No price for region" });

    const amountMinor = Number(price.amountMinor) || 0;
    const currency = price.currency || "USD";
    const formatted = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amountMinor / 100);

    res.json({
      plan: {
        slug: plan.slug,
        displayName: plan.displayName,
        durationDays: plan.durationDays,
      },
      region,
      currency,
      amountMinor,
      formatted, // e.g., "€10.00", "₹1,000.00", "$10.00"
    });
  } catch (err) {
    console.error("plan-price error:", err);
    res.status(500).json({ message: "Failed to get plan price" });
  }
});

module.exports = router;
